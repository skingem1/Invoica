import { Router, Request, Response, NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';

const router = Router();

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key);
}

// ─────────────────────────────────────────────
// GET /v1/settlements/stats
// Aggregate statistics for SETTLED+COMPLETED invoices.
// Must be before /:id to avoid param capture.
// ─────────────────────────────────────────────
router.get('/v1/settlements/stats', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const sb = getSupabase();
    const { data, error } = await sb
      .from('Invoice')
      .select('amount, updatedAt')
      .in('status', ['SETTLED', 'COMPLETED']);

    if (error) throw error;

    const rows = data || [];
    const now = Date.now();
    const ms24h = 24 * 60 * 60 * 1000;
    const ms7d  = 7  * 24 * 60 * 60 * 1000;
    const ms30d = 30 * 24 * 60 * 60 * 1000;

    let totalAmount = 0;
    const last24h = { count: 0, amount: 0 };
    const last7d  = { count: 0, amount: 0 };
    const last30d = { count: 0, amount: 0 };

    for (const r of rows) {
      const amt = Number(r.amount) || 0;
      totalAmount += amt;
      const age = now - new Date(r.updatedAt).getTime();
      if (age <= ms24h) { last24h.count++; last24h.amount += amt; }
      if (age <= ms7d)  { last7d.count++;  last7d.amount  += amt; }
      if (age <= ms30d) { last30d.count++; last30d.amount += amt; }
    }

    const total = rows.length;
    const avgAmount = total > 0 ? totalAmount / total : 0;

    res.json({ success: true, data: { total, totalAmount, avgAmount, last24h, last7d, last30d } });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────
// GET /v1/settlements/pending
// Returns PROCESSING invoices awaiting settlement.
// Must be before /:id to avoid param capture.
// ─────────────────────────────────────────────
router.get('/v1/settlements/pending', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const sb = getSupabase();
    const { data, error } = await sb
      .from('Invoice')
      .select('id, invoiceNumber, status, amount, currency, agentId, createdAt, updatedAt')
      .eq('status', 'PROCESSING')
      .order('createdAt', { ascending: false });

    if (error) throw error;

    const rows = data || [];
    res.json({ success: true, data: rows, meta: { total: rows.length } });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────
// GET /v1/settlements/volume
// Settlement volume for last 7d, 30d, and all-time.
// Must be before /:id to avoid param capture.
// ─────────────────────────────────────────────
router.get('/v1/settlements/volume', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const sb = getSupabase();
    const { data, error } = await sb
      .from('Invoice')
      .select('amount, settledAt')
      .in('status', ['SETTLED', 'COMPLETED']);

    if (error) throw error;

    const now = Date.now();
    const cutoff7d = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
    const cutoff30d = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();

    let last7d = { count: 0, amount: 0 };
    let last30d = { count: 0, amount: 0 };
    let allTime = { count: 0, amount: 0 };

    for (const row of (data || [])) {
      const amt = row.amount || 0;
      allTime.count += 1;
      allTime.amount += amt;
      if (row.settledAt && row.settledAt >= cutoff30d) {
        last30d.count += 1;
        last30d.amount += amt;
        if (row.settledAt >= cutoff7d) {
          last7d.count += 1;
          last7d.amount += amt;
        }
      }
    }

    res.json({ success: true, data: { last7d, last30d, allTime } });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────
// GET /v1/settlements/export.csv
// Export settled/completed invoices as CSV
// Must be before /:id to avoid param capture
// ─────────────────────────────────────────────
router.get('/v1/settlements/agent/:agentId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { agentId } = req.params;
    const sb = getSupabase();
    const { data, error } = await sb
      .from('Invoice')
      .select('id, invoiceNumber, status, amount, currency, paymentDetails, settledAt, completedAt, createdAt')
      .eq('agentId', agentId)
      .in('status', ['SETTLED', 'COMPLETED'])
      .order('settledAt', { ascending: false });

    if (error) throw error;

    const settlements = (data || []).map((row: any) => {
      const pd = typeof row.paymentDetails === 'string' ? JSON.parse(row.paymentDetails) : (row.paymentDetails || {});
      return {
        id: row.id,
        invoiceNumber: row.invoiceNumber,
        status: row.status === 'COMPLETED' ? 'confirmed' : 'pending',
        amount: row.amount,
        currency: row.currency,
        txHash: pd.txHash || null,
        network: pd.network || null,
        settledAt: row.settledAt,
        completedAt: row.completedAt,
        createdAt: row.createdAt,
      };
    });

    res.json({ success: true, data: settlements, meta: { total: settlements.length } });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────
router.get('/v1/settlements/export.csv', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const sb = getSupabase();
    const { data, error } = await sb
      .from('Invoice')
      .select('id, invoiceNumber, agentId, amount, currency, paymentDetails, createdAt, settledAt')
      .in('status', ['SETTLED', 'COMPLETED'])
      .order('settledAt', { ascending: false });

    if (error) throw error;

    const rows = data || [];
    const header = ['Date', 'Invoice#', 'AgentId', 'Amount', 'Currency', 'Network', 'TxHash'].join(',');
    const csvRows = rows.map((row: any) => {
      const pd = row.paymentDetails || {};
      return [
        new Date(row.settledAt || row.createdAt).toISOString(),
        row.invoiceNumber,
        row.agentId || '',
        row.amount || 0,
        row.currency || 'USD',
        pd.network || '',
        pd.txHash || '',
      ].join(',');
    });

    const csv = '\uFEFF' + [header, ...csvRows].join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="settlements.csv"');
    res.send(csv);
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────
// GET /v1/settlements/recent
// Most recent SETTLED+COMPLETED invoices sorted by updatedAt DESC.
// Must be before /:id to avoid param capture.
// ─────────────────────────────────────────────
router.get('/v1/settlements/recent', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = Math.min(parseInt((req.query.limit as string) || '10', 10), 50);
    const sb = getSupabase();

    const { data, error } = await sb
      .from('Invoice')
      .select('id, invoiceNumber, amount, currency, agentId, settledAt, updatedAt')
      .in('status', ['SETTLED', 'COMPLETED'])
      .order('updatedAt', { ascending: false })
      .limit(limit);

    if (error) throw error;
    res.json({ success: true, data: data || [] });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────
// GET /v1/settlements/by-currency
// Settlement totals grouped by currency, sorted by totalAmount DESC.
// Must be before /:id to avoid param capture.
// ─────────────────────────────────────────────
router.get('/v1/settlements/by-currency', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const sb = getSupabase();
    const { data, error } = await sb
      .from('Invoice')
      .select('currency, amount, status')
      .in('status', ['SETTLED', 'COMPLETED']);

    if (error) throw error;

    const currencyMap = new Map<string, { currency: string; count: number; totalAmount: number }>();
    for (const row of (data || [])) {
      const key = row.currency || 'UNKNOWN';
      if (!currencyMap.has(key)) currencyMap.set(key, { currency: key, count: 0, totalAmount: 0 });
      const entry = currencyMap.get(key)!;
      entry.count += 1;
      entry.totalAmount += row.amount || 0;
    }

    const sorted = Array.from(currencyMap.values())
      .sort((a, b) => b.totalAmount - a.totalAmount);

    res.json({ success: true, data: sorted });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────
// GET /v1/settlements/by-agent
// Settlement totals grouped by agent. Must be before /:id.
// ─────────────────────────────────────────────
router.get('/v1/settlements/by-agent', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = Math.min(parseInt((req.query.limit as string) || '10', 10), 50);
    const sb = getSupabase();
    const { data, error } = await sb
      .from('Invoice')
      .select('agentId, amount')
      .in('status', ['SETTLED', 'COMPLETED']);

    if (error) throw error;

    const agentMap = new Map<string, { agentId: string; count: number; totalAmount: number }>();
    for (const row of (data || [])) {
      const agentId = row.agentId || 'unknown';
      const existing = agentMap.get(agentId) || { agentId, count: 0, totalAmount: 0 };
      existing.count += 1;
      existing.totalAmount += Number(row.amount) || 0;
      agentMap.set(agentId, existing);
    }

    const sorted = Array.from(agentMap.values())
      .sort((a, b) => b.totalAmount - a.totalAmount)
      .slice(0, limit);

    res.json({ success: true, data: sorted });
  } catch (err) { next(err); }
});

router.get('/v1/settlements/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const sb = getSupabase();
    const { data, error } = await sb
      .from('Invoice')
      .select('id, invoiceNumber, status, amount, currency, customerEmail, customerName, paymentDetails, settledAt, completedAt, createdAt, updatedAt')
      .eq('id', id)
      .in('status', ['SETTLED', 'PROCESSING', 'COMPLETED'])
      .single();

    if (error || !data) {
      res.status(404).json({ success: false, error: { message: 'Settlement not found', code: 'NOT_FOUND' } });
      return;
    }

    const pd = typeof data.paymentDetails === 'string' ? JSON.parse(data.paymentDetails) : (data.paymentDetails || {});
    res.json({
      success: true,
      data: {
        id: data.id,
        invoiceId: data.id,
        invoiceNumber: data.invoiceNumber,
        status: data.status === 'COMPLETED' ? 'confirmed' : 'pending',
        amount: data.amount,
        currency: data.currency,
        customerName: data.customerName,
        customerEmail: data.customerEmail,
        txHash: pd.txHash || null,
        network: pd.network || 'base-mainnet',
        paidBy: pd.paidBy || null,
        settledAt: data.settledAt,
        completedAt: data.completedAt,
        createdAt: data.createdAt,
      }
    });
  } catch (err) { next(err); }
});

router.get('/v1/settlements', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string || '20', 10) || 20, 100);
    const offset = parseInt(req.query.offset as string || '0', 10) || 0;
    const statusFilter = req.query.status as string;
    const agentId = req.query.agentId as string | undefined;
    const from = req.query.from as string | undefined;
    const to = req.query.to as string | undefined;

    const sb = getSupabase();
    let query = sb
      .from('Invoice')
      .select('id, invoiceNumber, status, amount, currency, customerEmail, customerName, paymentDetails, settledAt, completedAt, createdAt, updatedAt', { count: 'exact' })
      .in('status', ['SETTLED', 'PROCESSING', 'COMPLETED'])
      .order('settledAt', { ascending: false })
      .range(offset, offset + limit - 1);

    if (statusFilter === 'confirmed') {
      query = query.eq('status', 'COMPLETED');
    } else if (statusFilter === 'pending') {
      query = query.in('status', ['SETTLED', 'PROCESSING']);
    }

    if (agentId) query = query.eq('companyId', agentId);
    if (from) query = query.gte('settledAt', from);
    if (to) query = query.lte('settledAt', to);

    const { data, error, count } = await query;
    if (error) throw error;

    const settlements = (data || []).map(inv => {
      const pd = typeof inv.paymentDetails === 'string' ? JSON.parse(inv.paymentDetails) : (inv.paymentDetails || {});
      return {
        id: inv.id,
        invoiceId: inv.id,
        invoiceNumber: inv.invoiceNumber,
        status: inv.status === 'COMPLETED' ? 'confirmed' : 'pending',
        amount: inv.amount,
        currency: inv.currency,
        customerName: inv.customerName,
        customerEmail: inv.customerEmail,
        txHash: pd.txHash || null,
        network: pd.network || 'base-mainnet',
        paidBy: pd.paidBy || null,
        settledAt: inv.settledAt,
        completedAt: inv.completedAt,
        createdAt: inv.createdAt,
      };
    });

    const total = count || 0;
    res.json({
      success: true,
      data: settlements,
      meta: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      }
    });
  } catch (err) { next(err); }
});

export default router;
