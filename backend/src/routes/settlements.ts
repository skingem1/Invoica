import { Router, Request, Response, NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';

const router = Router();

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key);
}

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
