/**
 * GET /v1/invoices/export
 * Returns invoice data as a CSV file download.
 * Query params: status (pending|processing|completed|failed), limit (default 500, max 1000)
 */
import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';

const router = Router();

const CSV_COLUMNS = ['id', 'invoiceNumber', 'status', 'amount', 'currency', 'customerEmail', 'customerName', 'createdAt', 'settledAt'] as const;

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !key) throw new Error('Supabase env vars not set');
  return createClient(url, key);
}

function escapeCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCsv(rows: Record<string, unknown>[]): string {
  const header = CSV_COLUMNS.join(',');
  const body = rows.map(row =>
    CSV_COLUMNS.map(col => escapeCell(row[col])).join(',')
  ).join('\n');
  return body.length > 0 ? `${header}\n${body}` : header;
}

const VALID_STATUSES = ['pending', 'processing', 'completed', 'failed'];

router.get('/v1/invoices/export', async (req: Request, res: Response): Promise<void> => {
  try {
    const status = req.query.status as string | undefined;
    const limit = Math.min(parseInt(req.query.limit as string || '500', 10) || 500, 1000);

    const sb = getSupabase();
    let query = sb
      .from('Invoice')
      .select('id, invoiceNumber, status, amount, currency, customerEmail, customerName, createdAt, settledAt')
      .order('createdAt', { ascending: false })
      .limit(limit);

    if (status && VALID_STATUSES.includes(status)) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;
    if (error) throw error;

    const csv = toCsv(data || []);
    const filename = `invoices-${new Date().toISOString().slice(0, 10)}.csv`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.status(200).send(csv);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Export failed';
    res.status(500).json({ success: false, error: message });
  }
});

export default router;
