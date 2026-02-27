import { Router, Response, NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';
import { requireApiKey, AuthedRequest } from '../middleware/apiKeyAuth';

const router = Router();

function getSb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function toEntry(inv: any, lineNumber: number) {
  const pd = typeof inv.paymentDetails === 'string'
    ? JSON.parse(inv.paymentDetails)
    : (inv.paymentDetails || {});

  const debitAgent  = inv.customerEmail || inv.customerName || 'Unknown';
  const creditAgent = pd.paidBy || inv.customerName || 'Unknown';
  const statusLabel = inv.status === 'COMPLETED'  ? 'Confirmed'
                    : inv.status === 'SETTLED'     ? 'Settled'
                    : inv.status === 'PROCESSING'  ? 'Processing'
                    : 'Pending';

  const description = pd.memo
    || (inv.customerName ? `${inv.customerName} — Invoice #${inv.invoiceNumber}` : `Invoice #${inv.invoiceNumber}`);

  return {
    lineNumber,
    entryDate:     inv.settledAt || inv.createdAt,
    invoiceId:     inv.id,
    invoiceNumber: inv.invoiceNumber,
    description,
    debitAgent,
    creditAgent,
    amount:        inv.amount,
    currency:      inv.currency || 'USD',
    status:        statusLabel,
    txHash:        pd.txHash    || null,
    network:       pd.network   || 'base-mainnet',
    blockExplorer: pd.txHash ? `https://basescan.org/tx/${pd.txHash}` : null,
    createdAt:     inv.createdAt,
    settledAt:     inv.settledAt   || null,
    completedAt:   inv.completedAt || null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /v1/ledger  — your company's agent transactions only
// Requires: Authorization: Bearer sk_<key>
// ─────────────────────────────────────────────────────────────────────────────
router.get('/v1/ledger', requireApiKey, async (req: AuthedRequest, res: Response, next: NextFunction) => {
  try {
    const companyId = req.companyId!;
    const limit    = Math.min(parseInt(req.query.limit  as string || '50', 10) || 50, 500);
    const offset   = parseInt(req.query.offset as string || '0', 10) || 0;
    const agent    = req.query.agent  as string | undefined;
    const status   = req.query.status as string | undefined;
    const from     = req.query.from   as string | undefined;
    const to       = req.query.to     as string | undefined;

    const sb = getSb();
    let query = sb
      .from('Invoice')
      .select(
        'id, invoiceNumber, status, amount, currency, customerEmail, customerName, paymentDetails, settledAt, completedAt, createdAt',
        { count: 'exact' }
      )
      .eq('companyId', companyId)                 // ← company-scoped
      .order('createdAt', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) query = query.eq('status', status.toUpperCase());
    if (from)   query = query.gte('createdAt', from);
    if (to)     query = query.lte('createdAt', to);

    const { data, error, count } = await query;
    if (error) throw error;

    let entries = (data || []).map((inv: any, i: number) => toEntry(inv, offset + i + 1));

    if (agent) {
      const a = agent.toLowerCase();
      entries = entries.filter((e: any) =>
        e.debitAgent.toLowerCase().includes(a) || e.creditAgent.toLowerCase().includes(a)
      );
    }

    const total = count || 0;
    res.json({
      success: true,
      data: entries,
      meta: {
        companyId,
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
        description: 'Invoica Immutable Ledger — your company\'s agent transactions only.',
      }
    });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /v1/ledger/summary  — per-agent balance sheet (company-scoped)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/v1/ledger/summary', requireApiKey, async (req: AuthedRequest, res: Response, next: NextFunction) => {
  try {
    const companyId = req.companyId!;
    const sb = getSb();
    const { data, error } = await sb
      .from('Invoice')
      .select('id, amount, currency, customerEmail, customerName, status, paymentDetails')
      .eq('companyId', companyId);

    if (error) throw error;

    const agentMap: Record<string, {
      name: string; totalDebits: number; totalCredits: number;
      confirmedDebits: number; confirmedCredits: number; txCount: number;
    }> = {};

    function ensure(key: string, name: string) {
      if (!agentMap[key]) agentMap[key] = { name, totalDebits: 0, totalCredits: 0, confirmedDebits: 0, confirmedCredits: 0, txCount: 0 };
    }

    for (const inv of (data || [])) {
      const pd = typeof inv.paymentDetails === 'string' ? JSON.parse(inv.paymentDetails) : (inv.paymentDetails || {});
      const debitKey  = inv.customerEmail || inv.customerName || 'unknown';
      const creditKey = pd.paidBy || inv.customerName || 'unknown';
      const amt = Number(inv.amount) || 0;
      const confirmed = inv.status === 'COMPLETED';

      ensure(debitKey, debitKey);
      ensure(creditKey, creditKey);

      agentMap[debitKey].totalDebits   += amt;
      agentMap[debitKey].txCount       += 1;
      agentMap[creditKey].totalCredits += amt;
      if (confirmed) {
        agentMap[debitKey].confirmedDebits   += amt;
        agentMap[creditKey].confirmedCredits += amt;
      }
    }

    const summary = Object.entries(agentMap).map(([id, v]) => ({
      agentId:             id,
      agentName:           v.name,
      totalDebits:         Number(v.totalDebits.toFixed(2)),
      totalCredits:        Number(v.totalCredits.toFixed(2)),
      netBalance:          Number((v.totalCredits - v.totalDebits).toFixed(2)),
      confirmedDebits:     Number(v.confirmedDebits.toFixed(2)),
      confirmedCredits:    Number(v.confirmedCredits.toFixed(2)),
      confirmedNetBalance: Number((v.confirmedCredits - v.confirmedDebits).toFixed(2)),
      transactionCount:    v.txCount,
    })).sort((a, b) => Math.abs(b.confirmedDebits) - Math.abs(a.confirmedDebits));

    const totalLocked = summary.reduce((s, a) => s + a.confirmedDebits, 0);

    res.json({
      success: true,
      data: summary,
      meta: {
        companyId,
        agentCount:       summary.length,
        totalValueLocked: Number(totalLocked.toFixed(2)),
        currency:         'USD',
      }
    });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /v1/ledger/export.csv  — download your company's ledger as CSV
// ─────────────────────────────────────────────────────────────────────────────
router.get('/v1/ledger/export.csv', requireApiKey, async (req: AuthedRequest, res: Response, next: NextFunction) => {
  try {
    const companyId = req.companyId!;
    const from      = req.query.from   as string | undefined;
    const to        = req.query.to     as string | undefined;
    const status    = req.query.status as string | undefined;
    const agent     = req.query.agent  as string | undefined;

    const sb = getSb();
    let query = sb
      .from('Invoice')
      .select('id, invoiceNumber, status, amount, currency, customerEmail, customerName, paymentDetails, settledAt, completedAt, createdAt')
      .eq('companyId', companyId)                 // ← company-scoped
      .order('createdAt', { ascending: true });

    if (status) query = query.eq('status', status.toUpperCase());
    if (from)   query = query.gte('createdAt', from);
    if (to)     query = query.lte('createdAt', to);

    const { data, error } = await query;
    if (error) throw error;

    let entries = (data || []).map((inv: any, i: number) => toEntry(inv, i + 1));
    if (agent) {
      const a = agent.toLowerCase();
      entries = entries.filter((e: any) =>
        e.debitAgent.toLowerCase().includes(a) || e.creditAgent.toLowerCase().includes(a)
      );
    }

    const cols = [
      'Line#', 'Date', 'Invoice#', 'Description',
      'Debit Agent (Payer)', 'Credit Agent (Recipient)',
      'Amount', 'Currency', 'Status',
      'TxHash (On-Chain Proof)', 'Network', 'Block Explorer URL',
      'Invoice ID', 'CreatedAt', 'SettledAt', 'CompletedAt',
    ];

    const esc = (v: any): string => {
      if (v == null) return '';
      const s = String(v);
      return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
    };

    const rows = entries.map((e: any) => [
      e.lineNumber, e.entryDate, e.invoiceNumber, e.description,
      e.debitAgent, e.creditAgent, e.amount, e.currency, e.status,
      e.txHash, e.network, e.blockExplorer,
      e.invoiceId, e.createdAt, e.settledAt, e.completedAt,
    ].map(esc).join(','));

    const now = new Date().toISOString().split('T')[0];
    const csv = [
      `# Invoica Agent Ledger Export — Company: ${companyId}`,
      `# Generated: ${now}`,
      `# Immutable proof: settled entries carry on-chain TxHash verifiable at basescan.org`,
      '',
      cols.join(','),
      ...rows,
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="invoica-ledger-${companyId}-${now}.csv"`);
    res.setHeader('X-Company-Id', companyId);
    res.setHeader('X-Ledger-Entries', String(entries.length));
    res.send('\uFEFF' + csv);
  } catch (err) { next(err); }
});

export default router;
