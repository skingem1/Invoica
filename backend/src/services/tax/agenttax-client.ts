/**
 * AgentTax x402 API client — AMD-22 compliant US tax calculation
 * TICKET-017-AGENTTAX-02
 *
 * Routes POST /api/v1/calculate via AGENTTAX_API_KEY (free tier, 100 calls/month).
 * Falls back to local calculator when API key absent or request fails.
 *
 * Compliance rules:
 *  - Demo mode responses are REJECTED (missing jurisdiction + statute)
 *  - Confidence < CONFIDENCE_FLOOR → requires_review = true
 *  - Statute citation (sales_tax.note) required for AMD-22 invoice line
 */

import * as https from 'https';

const AGENTTAX_HOST = 'www.agenttax.io';
const AGENTTAX_PATH = '/api/v1/calculate';
const CONFIDENCE_FLOOR = 70;
const TIMEOUT_MS = 8000;

// ─── Transaction type mapping for Invoica contexts ─────────────────────────

export type AgentTaxTransactionType =
  | 'compute' | 'api_access' | 'data_purchase' | 'saas' | 'ai_labor'
  | 'storage' | 'digital_good' | 'consulting' | 'data_processing'
  | 'cloud_infrastructure' | 'ai_model_access' | 'marketplace_fee'
  | 'subscription' | 'license' | 'service';

/** Maps Invoica invoice context names to AgentTax transaction types */
export const INVOICA_TX_TYPE_MAP: Record<string, AgentTaxTransactionType> = {
  pact_session:   'api_access',
  bond_mandate:   'subscription',
  erc8183_spot:   'ai_labor',
  drs_receipt:    'data_purchase',
  ksl_compute:    'compute',
  saas:           'saas',
  api_access:     'api_access',
  subscription:   'subscription',
  ai_labor:       'ai_labor',
  data_purchase:  'data_purchase',
  compute:        'compute',
  storage:        'storage',
  digital_good:   'digital_good',
  consulting:     'consulting',
  license:        'license',
  service:        'service',
};

// ─── Interfaces ────────────────────────────────────────────────────────────

export interface AgentTaxRequest {
  role: 'seller';
  amount: number;
  buyer_state: string;
  transaction_type: AgentTaxTransactionType;
  counterparty_id: string;
  work_type?: 'compute' | 'consulting' | 'creative' | 'data';
  is_b2b?: boolean;
}

export interface AgentTaxApiResult {
  success: boolean;
  mode?: string;             // 'demo' | 'authenticated' — demo mode must be rejected
  engine_version?: string;
  total_tax: number;
  combined_rate: number;
  sales_tax?: {
    rate: number;
    jurisdiction: string;
    note?: string;           // Statutory citation, e.g. "80% taxable (§151.351)"
  };
  confidence: {
    score: number;           // 0–100
    level: 'high' | 'medium' | 'low';
  };
  classification_basis: string;
}

/** Enriched result stored in invoice paymentDetails.tax_line (AMD-22) */
export interface AgentTaxLine {
  source: 'agenttax' | 'local_fallback';
  total_tax: number;
  rate: number;
  jurisdiction: string;
  statute?: string;          // AMD-22: statutory citation
  confidence_score: number;
  confidence_level: string;
  requires_review: boolean;  // true when confidence < CONFIDENCE_FLOOR
  classification_basis: string;
  engine_version?: string;
  calculated_at: string;     // ISO timestamp
}

// ─── HTTPS helper ─────────────────────────────────────────────────────────

function httpsPost(payload: object, apiKey: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(payload);
    const req = https.request(
      {
        hostname: AGENTTAX_HOST,
        path: AGENTTAX_PATH,
        method: 'POST',
        timeout: TIMEOUT_MS,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
          'Accept': 'application/json',
          'X-API-Key': apiKey,
        },
      },
      (res) => {
        let body = '';
        res.on('data', (d) => (body += d));
        res.on('end', () => resolve({ status: res.statusCode ?? 0, body }));
      },
    );
    req.on('timeout', () => { req.destroy(); reject(new Error('AgentTax request timeout')); });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// ─── Main export ──────────────────────────────────────────────────────────

/**
 * Calculate US sales tax via AgentTax API.
 * Returns null on error (caller should fall back to local calculator).
 * Throws AgentTaxDemoModeError when API returns demo mode response.
 */
export async function calculateAgentTax(
  request: AgentTaxRequest,
): Promise<AgentTaxLine | null> {
  const apiKey = process.env.AGENTTAX_API_KEY;
  if (!apiKey) {
    // No API key — return local mock tax line so SAP capabilities work without external deps
    console.info('[AgentTax] No AGENTTAX_API_KEY — returning local estimate');
    const rate = 0.0725; // CA default rate as baseline
    return {
      source: 'local_fallback' as const,
      total_tax: request.amount * rate,
      rate,
      jurisdiction: `US-${request.buyer_state || 'XX'}`,
      statute: 'Local estimate — set AGENTTAX_API_KEY for production accuracy',
      confidence_score: 50,
      confidence_level: 'low',
      requires_review: true,
      classification_basis: request.transaction_type || 'api_access',
      engine_version: 'local-fallback-1.0',
      calculated_at: new Date().toISOString(),
    };
  }

  let raw: AgentTaxApiResult;
  try {
    const { status, body } = await httpsPost(request, apiKey);
    if (status !== 200) {
      console.warn(`[AgentTax] HTTP ${status} for state=${request.buyer_state}`);
      return null;
    }
    raw = JSON.parse(body) as AgentTaxApiResult;
  } catch (err) {
    console.warn('[AgentTax] request failed, falling back to local:', (err as Error).message);
    return null;
  }

  if (!raw.success) {
    console.warn('[AgentTax] API returned success=false, falling back to local');
    return null;
  }

  // REJECT demo mode — missing jurisdiction + statute = AMD-22 non-compliant
  if (raw.mode === 'demo') {
    console.warn('[AgentTax] Demo mode response rejected for compliance (AMD-22)');
    return null; // fall back to local calculator
  }

  const confidenceScore = raw.confidence?.score ?? 0;
  const requiresReview = confidenceScore < CONFIDENCE_FLOOR;

  if (requiresReview) {
    console.warn(
      `[AgentTax] Low confidence ${confidenceScore}/100 for ${request.buyer_state} ` +
      `${request.transaction_type} — requires_review flagged`,
    );
  }

  return {
    source: 'agenttax',
    total_tax: raw.total_tax,
    rate: raw.sales_tax?.rate ?? raw.combined_rate,
    jurisdiction: raw.sales_tax?.jurisdiction ?? `US-${request.buyer_state}`,
    statute: raw.sales_tax?.note,
    confidence_score: confidenceScore,
    confidence_level: raw.confidence?.level ?? 'unknown',
    requires_review: requiresReview,
    classification_basis: raw.classification_basis,
    engine_version: raw.engine_version,
    calculated_at: new Date().toISOString(),
  };
}

/**
 * Resolve AgentTax transaction type from invoice request body fields.
 * Falls back to 'api_access' (most common Invoica context).
 */
export function resolveTransactionType(
  rawType?: string,
  companyId?: string | null,
): AgentTaxTransactionType {
  if (rawType) {
    const mapped = INVOICA_TX_TYPE_MAP[rawType.toLowerCase()];
    if (mapped) return mapped;
  }
  // Heuristic: companyId present → likely B2B api_access
  return 'api_access';
}
