#!/usr/bin/env ts-node

/**
 * nexus-monitor.ts — Invoica US Economic Nexus Monitor (AGENTTAX-03)
 *
 * Queries the Invoice DB for revenue and transaction counts per US state/jurisdiction
 * over a rolling 12-month window and compares against economic nexus thresholds.
 *
 * Jurisdiction is sourced from `paymentDetails->>'jurisdiction'` on each Invoice row.
 * That field is populated by the taxLine.jurisdiction param in the invoice creation API
 * (see AGENTTAX-02: invoices-create.ts).
 *
 * Output: logs/nexus-alerts/YYYY-MM-DD.json
 *
 * Status values per state:
 *   safe    — below 80% of the lower threshold
 *   warning — ≥80% of either threshold (revenue OR tx count)
 *   alert   — ≥100% of either threshold
 *
 * Usage:
 *   npx ts-node scripts/nexus-monitor.ts            # full run + write report
 *   npx ts-node scripts/nexus-monitor.ts --dry-run  # run + print, no file write
 *   npx ts-node scripts/nexus-monitor.ts --state CA # single state check
 *
 * ⚠️  HARVEY INTEL REMINDER: This script surfaces data signals ONLY.
 *     It is NOT a substitute for advice from a licensed tax attorney or CPA.
 *     Economic nexus rules vary by state, product category, and transaction type.
 *     Always confirm thresholds and obligations with qualified counsel.
 */

import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient, InvoiceStatus } from '@prisma/client';
import 'dotenv/config';

// ─── Types ────────────────────────────────────────────────────────────────────

interface NexusThreshold {
  revenueUSD: number;        // annual revenue threshold in USD (0 = no threshold)
  txCount: number;           // annual transaction count threshold (0 = no threshold)
  notes?: string;            // state-specific notes
}

interface StateResult {
  state: string;             // 2-letter ISO 3166-2 US state code
  revenue_ttm: number;       // trailing-12-month revenue in USD
  tx_count_ttm: number;      // trailing-12-month transaction count
  threshold_revenue: number;
  threshold_tx: number;
  pct_of_revenue_threshold: number;   // 0–100+
  pct_of_tx_threshold: number;        // 0–100+
  status: 'safe' | 'warning' | 'alert';
  notes?: string;
}

interface NexusReport {
  generated_at: string;
  window_start: string;
  window_end: string;
  states_with_activity: number;
  alerts: number;
  warnings: number;
  results: StateResult[];
  disclaimer: string;
}

// ─── Threshold Map — 51 jurisdictions (50 states + DC) ───────────────────────
// Defaults: $100,000 revenue OR 200 transactions (post-Wayfair standard)
// NOTE: Confirm current thresholds with qualified tax counsel before relying on these.

const NEXUS_THRESHOLDS: Record<string, NexusThreshold> = {
  AL: { revenueUSD: 250_000, txCount: 0,   notes: 'Revenue-only threshold via Simplified Sellers Use Tax' },
  AK: { revenueUSD: 100_000, txCount: 200  },
  AZ: { revenueUSD: 100_000, txCount: 0,   notes: 'Revenue-only since 2022' },
  AR: { revenueUSD: 100_000, txCount: 200  },
  CA: { revenueUSD: 500_000, txCount: 0,   notes: 'Revenue-only, $500K threshold' },
  CO: { revenueUSD: 100_000, txCount: 0,   notes: 'Revenue-only since 2019' },
  CT: { revenueUSD: 100_000, txCount: 200  },
  DC: { revenueUSD: 100_000, txCount: 200  },
  DE: { revenueUSD: 0,       txCount: 0,   notes: 'No sales tax' },
  FL: { revenueUSD: 100_000, txCount: 0,   notes: 'Revenue-only since 2021' },
  GA: { revenueUSD: 100_000, txCount: 200  },
  HI: { revenueUSD: 100_000, txCount: 200  },
  ID: { revenueUSD: 100_000, txCount: 0    },
  IL: { revenueUSD: 100_000, txCount: 200  },
  IN: { revenueUSD: 100_000, txCount: 200  },
  IA: { revenueUSD: 100_000, txCount: 0,   notes: 'Revenue-only since 2023' },
  KS: { revenueUSD: 1,       txCount: 0,   notes: 'De minimis — any revenue creates nexus' },
  KY: { revenueUSD: 100_000, txCount: 200  },
  LA: { revenueUSD: 100_000, txCount: 200  },
  ME: { revenueUSD: 100_000, txCount: 200  },
  MD: { revenueUSD: 100_000, txCount: 200  },
  MA: { revenueUSD: 100_000, txCount: 0,   notes: 'Revenue-only since 2019' },
  MI: { revenueUSD: 100_000, txCount: 200  },
  MN: { revenueUSD: 100_000, txCount: 200  },
  MS: { revenueUSD: 250_000, txCount: 0    },
  MO: { revenueUSD: 100_000, txCount: 0,   notes: 'Revenue-only, effective Jan 2023' },
  MT: { revenueUSD: 0,       txCount: 0,   notes: 'No sales tax' },
  NE: { revenueUSD: 100_000, txCount: 200  },
  NV: { revenueUSD: 100_000, txCount: 200  },
  NH: { revenueUSD: 0,       txCount: 0,   notes: 'No sales tax' },
  NJ: { revenueUSD: 100_000, txCount: 200  },
  NM: { revenueUSD: 100_000, txCount: 0    },
  NY: { revenueUSD: 500_000, txCount: 100, notes: '$500K revenue AND 100 transactions' },
  NC: { revenueUSD: 100_000, txCount: 200  },
  ND: { revenueUSD: 100_000, txCount: 200  },
  OH: { revenueUSD: 100_000, txCount: 200  },
  OK: { revenueUSD: 100_000, txCount: 0    },
  OR: { revenueUSD: 0,       txCount: 0,   notes: 'No sales tax' },
  PA: { revenueUSD: 100_000, txCount: 0    },
  RI: { revenueUSD: 100_000, txCount: 200  },
  SC: { revenueUSD: 100_000, txCount: 200  },
  SD: { revenueUSD: 100_000, txCount: 200, notes: 'Wayfair origin state' },
  TN: { revenueUSD: 100_000, txCount: 0    },
  TX: { revenueUSD: 500_000, txCount: 0,   notes: 'Revenue-only, $500K threshold' },
  UT: { revenueUSD: 100_000, txCount: 200  },
  VT: { revenueUSD: 100_000, txCount: 200  },
  VA: { revenueUSD: 100_000, txCount: 200  },
  WA: { revenueUSD: 100_000, txCount: 0    },
  WV: { revenueUSD: 100_000, txCount: 200  },
  WI: { revenueUSD: 100_000, txCount: 200  },
  WY: { revenueUSD: 100_000, txCount: 200  },
};

// States with no sales tax — skip nexus alerting
const NO_SALES_TAX = new Set(['AK', 'DE', 'MT', 'NH', 'OR']);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ensureDir(d: string): void {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
}

function computeStatus(
  revenue: number,
  txCount: number,
  threshold: NexusThreshold
): { status: 'safe' | 'warning' | 'alert'; pctRev: number; pctTx: number } {
  const pctRev = threshold.revenueUSD > 0
    ? Math.round((revenue / threshold.revenueUSD) * 100)
    : 0;
  const pctTx = threshold.txCount > 0
    ? Math.round((txCount / threshold.txCount) * 100)
    : 0;

  const maxPct = Math.max(pctRev, pctTx);

  let status: 'safe' | 'warning' | 'alert';
  if (maxPct >= 100) {
    status = 'alert';
  } else if (maxPct >= 80) {
    status = 'warning';
  } else {
    status = 'safe';
  }

  return { status, pctRev, pctTx };
}

// ─── DB Query ─────────────────────────────────────────────────────────────────

interface RawStateRow {
  state: string;
  revenue_ttm: string | number;   // Prisma may return Decimal as string
  tx_count_ttm: string | number;  // BigInt from COUNT
}

async function queryStateRevenue(
  prisma: PrismaClient,
  windowStart: Date
): Promise<RawStateRow[]> {
  // Only count invoices that are actually settled/completed (real revenue).
  // PENDING invoices are excluded — they have not been paid.
  const settledStatuses = [
    InvoiceStatus.SETTLED,
    InvoiceStatus.PROCESSING,
    InvoiceStatus.COMPLETED,
  ];

  const placeholders = settledStatuses.map((_, i) => `$${i + 2}`).join(', ');

  const rows = await prisma.$queryRawUnsafe<RawStateRow[]>(
    `
    SELECT
      (paymentDetails->>'jurisdiction') AS state,
      SUM(amount)                        AS revenue_ttm,
      COUNT(*)                           AS tx_count_ttm
    FROM "Invoice"
    WHERE
      "createdAt"     >= $1
      AND status       IN (${placeholders})
      AND paymentDetails->>'jurisdiction' IS NOT NULL
      AND paymentDetails->>'jurisdiction' != ''
    GROUP BY state
    ORDER BY revenue_ttm DESC
    `,
    windowStart,
    ...settledStatuses
  );

  return rows;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const isDryRun   = args.includes('--dry-run');
  const stateFilter = (() => {
    const idx = args.indexOf('--state');
    return idx >= 0 ? args[idx + 1]?.toUpperCase() : null;
  })();

  const NOW          = new Date();
  const TODAY        = NOW.toISOString().slice(0, 10);
  const WINDOW_START = new Date(NOW);
  WINDOW_START.setFullYear(WINDOW_START.getFullYear() - 1);

  const ROOT         = path.resolve(__dirname, '..');
  const ALERTS_DIR   = path.join(ROOT, 'logs', 'nexus-alerts');
  const OUTPUT_FILE  = path.join(ALERTS_DIR, `${TODAY}.json`);

  console.log('[nexus-monitor] Starting — window:', WINDOW_START.toISOString().slice(0, 10), '→', TODAY);
  if (isDryRun)   console.log('[nexus-monitor] DRY RUN — no file will be written');
  if (stateFilter) console.log('[nexus-monitor] State filter:', stateFilter);

  const prisma = new PrismaClient();

  try {
    const rows = await queryStateRevenue(prisma, WINDOW_START);
    console.log(`[nexus-monitor] States with activity: ${rows.length}`);

    const results: StateResult[] = [];

    for (const row of rows) {
      const state   = (row.state ?? '').toUpperCase().trim();
      const revenue = Number(row.revenue_ttm) || 0;
      const txCount = Number(row.tx_count_ttm) || 0;

      if (!state || state.length !== 2) continue;
      if (stateFilter && state !== stateFilter) continue;
      if (NO_SALES_TAX.has(state)) continue;  // no nexus risk in no-sales-tax states

      const threshold = NEXUS_THRESHOLDS[state] ?? { revenueUSD: 100_000, txCount: 200 };

      // Skip if no thresholds defined (no sales tax states already filtered above)
      if (threshold.revenueUSD === 0 && threshold.txCount === 0) continue;

      const { status, pctRev, pctTx } = computeStatus(revenue, txCount, threshold);

      results.push({
        state,
        revenue_ttm: revenue,
        tx_count_ttm: txCount,
        threshold_revenue: threshold.revenueUSD,
        threshold_tx: threshold.txCount,
        pct_of_revenue_threshold: pctRev,
        pct_of_tx_threshold: pctTx,
        status,
        ...(threshold.notes && { notes: threshold.notes }),
      });
    }

    // Sort: alerts first, then warnings, then safe
    results.sort((a, b) => {
      const rank = { alert: 0, warning: 1, safe: 2 };
      return rank[a.status] - rank[b.status] || b.revenue_ttm - a.revenue_ttm;
    });

    const alerts   = results.filter(r => r.status === 'alert').length;
    const warnings = results.filter(r => r.status === 'warning').length;

    const report: NexusReport = {
      generated_at: NOW.toISOString(),
      window_start: WINDOW_START.toISOString().slice(0, 10),
      window_end: TODAY,
      states_with_activity: results.length,
      alerts,
      warnings,
      results,
      disclaimer:
        'HARVEY INTEL REMINDER: This report surfaces data signals only. ' +
        'It is NOT a substitute for advice from a licensed tax attorney or CPA. ' +
        'Economic nexus rules vary by state, product category, and transaction type. ' +
        'Confirm thresholds and obligations with qualified counsel before taking any action.',
    };

    // Console summary
    console.log('\n─── Nexus Monitor Summary ────────────────────────────────');
    console.log(`  Window : ${report.window_start} → ${report.window_end}`);
    console.log(`  States : ${report.states_with_activity}`);
    console.log(`  Alerts : ${alerts}`);
    console.log(`  Warnings: ${warnings}`);
    console.log('──────────────────────────────────────────────────────────');

    if (results.length === 0) {
      console.log('  No invoices with jurisdiction data found in window.');
      console.log('  Ensure taxLine.jurisdiction is populated on invoices (AGENTTAX-02).');
    } else {
      for (const r of results) {
        const icon = r.status === 'alert' ? '🔴' : r.status === 'warning' ? '🟡' : '🟢';
        console.log(
          `  ${icon} ${r.state.padEnd(4)} | Rev: $${r.revenue_ttm.toLocaleString('en-US', { maximumFractionDigits: 2 }).padStart(12)} (${r.pct_of_revenue_threshold}%) | Tx: ${String(r.tx_count_ttm).padStart(6)} (${r.pct_of_tx_threshold}%)`
        );
      }
    }
    console.log('──────────────────────────────────────────────────────────\n');

    if (!isDryRun) {
      ensureDir(ALERTS_DIR);
      fs.writeFileSync(OUTPUT_FILE, JSON.stringify(report, null, 2));
      console.log(`[nexus-monitor] Report written → ${OUTPUT_FILE}`);
    }

    if (alerts > 0) {
      console.warn(`[nexus-monitor] ⚠️  ${alerts} state(s) have crossed nexus threshold. Review immediately.`);
      process.exit(2);  // Non-zero exit for CI/alerting integration
    }

  } finally {
    await prisma.$disconnect();
  }
}

main().catch(e => {
  console.error('[nexus-monitor] Fatal:', e);
  process.exit(1);
});
