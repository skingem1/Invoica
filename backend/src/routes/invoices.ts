import { Router, Request, Response, NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';
import { calculateTax } from '../services/tax/calculator';

const router = Router();

/** EVM-compatible address format (0x + 40 hex chars) */
const EVM_ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
/** Solana base58 public key format (32–44 chars, no 0/O/I/l) */
const SOLANA_ADDRESS_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const SOLANA_TOKEN_PROGRAM = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
const SOLANA_USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const SUPPORTED_CHAINS = ['base', 'polygon', 'arbitrum', 'solana'] as const;
type SupportedChain = typeof SUPPORTED_CHAINS[number];

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !key) throw new Error('Supabase env vars not set');
  return createClient(url, key);
}

const SELECT_FIELDS = 'id, invoiceNumber, status, amount, currency, customerEmail, customerName, companyId, paymentDetails, settledAt, completedAt, createdAt, updatedAt';

function mapInvoice(inv: any) {
  const pd = inv.paymentDetails
    ? (typeof inv.paymentDetails === 'string' ? JSON.parse(inv.paymentDetails) : inv.paymentDetails)
    : {};
  return {
    id: inv.id,
    invoiceNumber: inv.invoiceNumber,
    status: inv.status,
    amount: inv.amount,
    currency: inv.currency,
    customerEmail: inv.customerEmail,
    customerName: inv.customerName,
    companyId: inv.companyId || null,
    paymentDetails: {
      txHash: pd.txHash || null,
      network: pd.network || null,
      paidBy: pd.paidBy || null,
      ...pd,
    },
    tax: pd.tax || null,
    settledAt: inv.settledAt,
    completedAt: inv.completedAt,
    createdAt: inv.createdAt,
    updatedAt: inv.updatedAt,
  };
}

/**
 * GET /v1/invoices/search/advanced
 * Multi-field search with filters. Must be before /search to avoid shadowing.
 */
router.get('/v1/invoices/search/advanced', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      q, status, currency,
      minAmount, maxAmount,
      fromDate, toDate,
    } = req.query as Record<string, string | undefined>;

    const limit  = Math.min(parseInt((req.query.limit  as string) || '20', 10), 100);
    const offset = Math.max(parseInt((req.query.offset as string) || '0',  10), 0);

    const sb = getSupabase();
    let query = sb.from('Invoice').select(SELECT_FIELDS);

    if (status)    query = (query as any).eq('status', status);
    if (currency)  query = (query as any).eq('currency', currency);
    if (minAmount) query = (query as any).gte('amount', Number(minAmount));
    if (maxAmount) query = (query as any).lte('amount', Number(maxAmount));
    if (fromDate)  query = (query as any).gte('createdAt', fromDate);
    if (toDate)    query = (query as any).lte('createdAt', toDate);

    if (q && q.length >= 2) {
      const term = `%${q}%`;
      query = (query as any).or(`customerEmail.ilike.${term},customerName.ilike.${term},invoiceNumber.ilike.${term}`);
    }

    const { data, error } = await (query as any)
      .order('createdAt', { ascending: false });

    if (error) throw error;

    const all = (data || []).map(mapInvoice);
    const total = all.length;
    const page = all.slice(offset, offset + limit);

    res.json({ success: true, data: page, meta: { total, limit, offset } });
  } catch (err) { next(err); }
});

/**
 * GET /v1/invoices/search?q=
 * Search invoices by customer email or name (case-insensitive).
 * Query param: q (min 2 chars). Returns up to 20 matches.
 * IMPORTANT: Must be registered BEFORE /v1/invoices/number/:number and /:id
 * to prevent Express matching "search" as a parameter value.
 */
router.get('/v1/invoices/search', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = (req.query.q as string | undefined) || '';

    if (q.length < 2) {
      res.status(400).json({
        success: false,
        error: { message: 'Search query must be at least 2 characters', code: 'QUERY_TOO_SHORT' },
      });
      return;
    }

    const sb = getSupabase();
    const term = `%${q}%`;

    const { data, error } = await sb
      .from('Invoice')
      .select(SELECT_FIELDS)
      .or(`customerEmail.ilike.${term},customerName.ilike.${term}`)
      .order('createdAt', { ascending: false })
      .limit(20);

    if (error) throw error;

    res.json({
      success: true,
      data: (data || []).map(mapInvoice),
      meta: { query: q, count: (data || []).length },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /v1/invoices/number/:number
 * Lookup invoice by sequential invoice number (e.g. 15).
 * IMPORTANT: This route MUST be registered before /v1/invoices/:id
 * to prevent Express matching "number" as an :id value.
 */
router.get('/v1/invoices/number/:number', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const invoiceNumber = parseInt(req.params.number as string, 10);
    if (isNaN(invoiceNumber) || invoiceNumber <= 0) {
      res.status(400).json({
        success: false,
        error: { message: 'Invalid invoice number — must be a positive integer', code: 'INVALID_NUMBER' },
      });
      return;
    }

    const sb = getSupabase();
    const { data, error } = await sb
      .from('Invoice')
      .select(SELECT_FIELDS)
      .eq('invoiceNumber', invoiceNumber)
      .single();

    if (error || !data) {
      res.status(404).json({
        success: false,
        error: { message: `Invoice #${invoiceNumber} not found`, code: 'NOT_FOUND' },
      });
      return;
    }

    res.json({ success: true, data: mapInvoice(data) });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /v1/invoices/count
 * Invoice counts grouped by status. Registered before /:id.
 */
router.get('/v1/invoices/count', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const sb = getSupabase();
    const { data, error } = await sb.from('Invoice').select('status');
    if (error) throw error;

    const ALL_STATUSES = ['PENDING', 'PROCESSING', 'SETTLED', 'COMPLETED', 'CANCELLED', 'REFUNDED'];
    const byStatus: Record<string, number> = {};
    for (const s of ALL_STATUSES) byStatus[s] = 0;
    for (const row of (data || [])) {
      if (row.status in byStatus) byStatus[row.status]++;
    }

    res.json({ success: true, data: { total: (data || []).length, byStatus } });
  } catch (err) { next(err); }
});

/**
 * GET /v1/invoices/stats/status
 * Global invoice count breakdown by status. Registered before /:id.
 */
router.get('/v1/invoices/stats/status', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const sb = getSupabase();
    const { data, error } = await sb.from('Invoice').select('status');
    if (error) throw error;

    const ALL_STATUSES = ['PENDING', 'PROCESSING', 'SETTLED', 'COMPLETED', 'CANCELLED', 'REFUNDED'];
    const byStatus: Record<string, number> = {};
    for (const s of ALL_STATUSES) byStatus[s] = 0;
    for (const row of (data || [])) {
      if (row.status in byStatus) byStatus[row.status]++;
    }

    const total = (data || []).length;
    res.json({ success: true, data: { total, byStatus } });
  } catch (err) { next(err); }
});

/**
 * GET /v1/invoices/stats/currency
 * Invoice count and amount grouped by currency, sorted by totalAmount DESC.
 * Registered before /:id.
 */
router.get('/v1/invoices/stats/currency', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const sb = getSupabase();
    const { data, error } = await sb.from('Invoice').select('currency, amount');
    if (error) throw error;

    const currencyMap = new Map<string, { count: number; totalAmount: number }>();
    for (const row of (data || [])) {
      const cur = row.currency || 'UNKNOWN';
      const existing = currencyMap.get(cur) || { count: 0, totalAmount: 0 };
      existing.count += 1;
      existing.totalAmount += Number(row.amount) || 0;
      currencyMap.set(cur, existing);
    }

    const result = Array.from(currencyMap.entries())
      .map(([currency, vals]) => ({ currency, ...vals }))
      .sort((a, b) => b.totalAmount - a.totalAmount);

    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

/**
 * GET /v1/invoices/stats/customers
 * Top customers by invoice count and total amount. Registered before /:id.
 */
router.get('/v1/invoices/stats/customers', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = Math.min(parseInt((req.query.limit as string) || '10', 10), 50);
    const sb = getSupabase();
    const { data, error } = await sb.from('Invoice').select('customerEmail, customerName, amount');
    if (error) throw error;

    const customerMap = new Map<string, { customerEmail: string; customerName: string; count: number; totalAmount: number }>();
    for (const row of (data || [])) {
      const email = row.customerEmail || 'unknown';
      const existing = customerMap.get(email) || {
        customerEmail: email,
        customerName: row.customerName || '',
        count: 0,
        totalAmount: 0,
      };
      existing.count += 1;
      existing.totalAmount += Number(row.amount) || 0;
      if (row.customerName && !existing.customerName) existing.customerName = row.customerName;
      customerMap.set(email, existing);
    }

    const result = Array.from(customerMap.values())
      .sort((a, b) => b.totalAmount - a.totalAmount)
      .slice(0, limit);

    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

/**
 * GET /v1/invoices/stats/void
 * Count and amount of CANCELLED+REFUNDED invoices with recent breakdowns.
 * Registered before /:id.
 */
router.get('/v1/invoices/stats/void', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const sb = getSupabase();
    const { data, error } = await sb.from('Invoice').select('amount, status, updatedAt').in('status', ['CANCELLED', 'REFUNDED']);
    if (error) throw error;

    const rows = data || [];
    const now = Date.now();
    const ms24h = 24 * 60 * 60 * 1000;
    const ms7d  = 7  * 24 * 60 * 60 * 1000;

    let totalAmount = 0;
    const last24h = { count: 0, amount: 0 };
    const last7d  = { count: 0, amount: 0 };

    for (const r of rows) {
      const amt = Number(r.amount) || 0;
      totalAmount += amt;
      const age = now - new Date(r.updatedAt).getTime();
      if (age <= ms24h) { last24h.count++; last24h.amount += amt; }
      if (age <= ms7d)  { last7d.count++;  last7d.amount  += amt; }
    }

    res.json({ success: true, data: { total: rows.length, totalAmount, last24h, last7d } });
  } catch (err) { next(err); }
});

/**
 * GET /v1/invoices/stats/aging
 * Invoice aging report: bucket PENDING invoices by days outstanding.
 * Buckets: 0_30, 31_60, 61_90, over_90 — each has count + totalAmount.
 */
router.get('/v1/invoices/stats/aging', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const sb = getSupabase();
    const { data, error } = await sb.from('Invoice').select('amount, createdAt').eq('status', 'PENDING');
    if (error) throw error;

    const now = Date.now();
    const MS_PER_DAY = 24 * 60 * 60 * 1000;
    const buckets = {
      '0_30':   { count: 0, totalAmount: 0 },
      '31_60':  { count: 0, totalAmount: 0 },
      '61_90':  { count: 0, totalAmount: 0 },
      'over_90': { count: 0, totalAmount: 0 },
    };

    for (const row of (data || [])) {
      const ageDays = (now - new Date(row.createdAt).getTime()) / MS_PER_DAY;
      const amt = Number(row.amount) || 0;
      if (ageDays <= 30)       { buckets['0_30'].count++;   buckets['0_30'].totalAmount += amt; }
      else if (ageDays <= 60)  { buckets['31_60'].count++;  buckets['31_60'].totalAmount += amt; }
      else if (ageDays <= 90)  { buckets['61_90'].count++;  buckets['61_90'].totalAmount += amt; }
      else                     { buckets['over_90'].count++; buckets['over_90'].totalAmount += amt; }
    }

    res.json({ success: true, data: { buckets } });
  } catch (err) { next(err); }
});

/**
 * GET /v1/invoices/overdue
 * Returns PENDING invoices older than 24 hours. Registered before /:id.
 */
router.get('/v1/invoices/overdue', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const sb = getSupabase();
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await sb
      .from('Invoice')
      .select(SELECT_FIELDS)
      .eq('status', 'PENDING')
      .lt('createdAt', cutoff)
      .order('createdAt', { ascending: true });
    if (error) throw error;
    const invoices = (data || []).map(mapInvoice);
    res.json({ success: true, data: invoices, meta: { total: invoices.length, cutoffISO: cutoff } });
  } catch (err) { next(err); }
});

/**
 * GET /v1/invoices/export.csv
 * CSV export of invoices. Optional ?status= filter. Registered before /:id.
 */
router.get('/v1/invoices/export.csv', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sb = getSupabase();
    const { status } = req.query as { status?: string };

    let query = sb.from('Invoice').select('id, invoiceNumber, status, amount, currency, customerEmail, customerName, createdAt, settledAt').order('createdAt', { ascending: false });
    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) throw error;

    const rows = data || [];
    const header = 'id,invoiceNumber,status,amount,currency,customerEmail,customerName,createdAt,settledAt';
    const lines = rows.map((r: any) => [
      r.id, r.invoiceNumber, r.status, r.amount, r.currency,
      r.customerEmail || '', r.customerName || '',
      r.createdAt || '', r.settledAt || '',
    ].map((v: any) => `"${String(v).replace(/"/g, '""')}"`).join(','));

    const csv = [header, ...lines].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=invoices.csv');
    res.send(csv);
  } catch (err) { next(err); }
});

/**
 * GET /v1/invoices/:id
 * Lookup invoice by UUID.
 * Registered AFTER /v1/invoices/number/:number to avoid shadowing.
 */
router.get('/v1/invoices/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const sb = getSupabase();
    const { data, error } = await sb
      .from('Invoice')
      .select(SELECT_FIELDS)
      .eq('id', id)
      .single();

    if (error || !data) {
      res.status(404).json({
        success: false,
        error: { message: 'Invoice not found', code: 'NOT_FOUND' },
      });
      return;
    }

    res.json({ success: true, data: mapInvoice(data) });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /v1/invoices/:id/timeline
 * Returns a derived status timeline for an invoice.
 */
router.get('/v1/invoices/:id/timeline', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const sb = getSupabase();
    const { data, error } = await sb
      .from('Invoice')
      .select('id, status, createdAt, settledAt, completedAt')
      .eq('id', id)
      .single();

    if (error || !data) {
      res.status(404).json({ success: false, error: { message: 'Invoice not found', code: 'NOT_FOUND' } });
      return;
    }

    const events: Array<{ status: string; timestamp: string; note: string }> = [];
    events.push({ status: 'PENDING', timestamp: data.createdAt, note: 'Invoice created' });
    if (data.settledAt) events.push({ status: 'SETTLED', timestamp: data.settledAt, note: 'Payment settled on-chain' });
    if (data.completedAt) events.push({ status: 'COMPLETED', timestamp: data.completedAt, note: 'Invoice completed' });
    if (data.status === 'CANCELLED') events.push({ status: 'CANCELLED', timestamp: data.completedAt || data.settledAt || data.createdAt, note: 'Invoice cancelled' });

    res.json({ success: true, data: events, meta: { invoiceId: id, currentStatus: data.status } });
  } catch (err) { next(err); }
});

const VALID_SORT_FIELDS = ['createdAt', 'amount', 'updatedAt'];

function buildInvoiceFilters(query: any, params: {
  status?: string; customerEmail?: string; companyId?: string; chain?: string;
  fromDate?: string; toDate?: string; minAmount?: string; maxAmount?: string;
}): any {
  if (params.status) query = query.eq('status', params.status.toUpperCase());
  if (params.customerEmail) query = query.eq('customerEmail', params.customerEmail);
  if (params.companyId) query = query.eq('companyId', params.companyId);
  if (params.fromDate) query = query.gte('createdAt', params.fromDate);
  if (params.toDate) query = query.lte('createdAt', params.toDate);
  if (params.minAmount) query = query.gte('amount', parseFloat(params.minAmount));
  if (params.maxAmount) query = query.lte('amount', parseFloat(params.maxAmount));
  if (params.chain) query = query.contains('paymentDetails', { network: params.chain.toLowerCase() });
  return query;
}

/**
 * GET /v1/invoices
 * List invoices with pagination and optional filters.
 * Query params: status, customerEmail, companyId, chain, from, to, minAmount, maxAmount,
 *               sortBy (createdAt|amount|updatedAt), sortDir (asc|desc), limit (max 100), offset
 */
router.get('/v1/invoices', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string || '20', 10) || 20, 100);
    const offset = parseInt(req.query.offset as string || '0', 10) || 0;
    const sortBy = VALID_SORT_FIELDS.includes(req.query.sortBy as string) ? req.query.sortBy as string : 'createdAt';
    const sortDir = (req.query.sortDir as string) === 'asc';

    const sb = getSupabase();
    let query: any = sb.from('Invoice').select(SELECT_FIELDS, { count: 'exact' });

    query = buildInvoiceFilters(query, {
      status: req.query.status as string | undefined,
      customerEmail: req.query.customerEmail as string | undefined,
      companyId: req.query.companyId as string | undefined,
      chain: req.query.chain as string | undefined,
      fromDate: req.query.from as string | undefined,
      toDate: req.query.to as string | undefined,
      minAmount: req.query.minAmount as string | undefined,
      maxAmount: req.query.maxAmount as string | undefined,
    });

    query = query.order(sortBy, { ascending: sortDir }).range(offset, offset + limit - 1);

    const { data, error, count } = await query;
    if (error) throw error;

    const total = count || 0;
    res.json({
      success: true,
      data: (data || []).map(mapInvoice),
      meta: { total, limit, offset, hasMore: offset + limit < total },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /v1/invoices
 * Create a new invoice. Supports EVM chains (base, polygon, arbitrum) and Solana.
 * Body: { customerEmail, customerName, amount, currency?, chain?, paymentAddress?,
 *         programId?, tokenMint?, companyId? }
 */
router.post('/v1/invoices', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      customerEmail,
      customerName,
      amount,
      currency = 'USD',
      companyId,
      chain = 'base',
      paymentAddress,
      programId,
      tokenMint,
      buyerCountryCode,
      buyerStateCode,
      buyerVatNumber,
    } = req.body;

    if (!customerEmail || typeof customerEmail !== 'string') {
      res.status(400).json({ success: false, error: { message: 'customerEmail is required', code: 'MISSING_FIELD' } });
      return;
    }
    if (!customerName || typeof customerName !== 'string') {
      res.status(400).json({ success: false, error: { message: 'customerName is required', code: 'MISSING_FIELD' } });
      return;
    }
    if (amount === undefined || amount === null || isNaN(Number(amount)) || Number(amount) <= 0) {
      res.status(400).json({ success: false, error: { message: 'amount must be a positive number', code: 'INVALID_AMOUNT' } });
      return;
    }
    if (!SUPPORTED_CHAINS.includes(chain as SupportedChain)) {
      res.status(400).json({ success: false, error: { message: `chain must be one of: ${SUPPORTED_CHAINS.join(', ')}`, code: 'INVALID_CHAIN' } });
      return;
    }

    // Chain-aware address validation
    if (paymentAddress) {
      const isSolana = chain === 'solana';
      const valid = isSolana ? SOLANA_ADDRESS_RE.test(paymentAddress) : EVM_ADDRESS_RE.test(paymentAddress);
      if (!valid) {
        res.status(400).json({
          success: false,
          error: {
            message: isSolana
              ? 'Payment address must be a valid Solana public key (base58, 32–44 characters)'
              : 'Payment address must be a valid EVM address (0x + 40 hex characters)',
            code: 'INVALID_ADDRESS',
          },
        });
        return;
      }
    }

    // Solana-specific field validation
    if (chain === 'solana') {
      if (programId && programId !== SOLANA_TOKEN_PROGRAM) {
        res.status(400).json({ success: false, error: { message: `Solana programId must be the SPL Token Program: ${SOLANA_TOKEN_PROGRAM}`, code: 'INVALID_PROGRAM_ID' } });
        return;
      }
      if (tokenMint && tokenMint !== SOLANA_USDC_MINT) {
        res.status(400).json({ success: false, error: { message: `Only USDC is supported. tokenMint must be: ${SOLANA_USDC_MINT}`, code: 'INVALID_TOKEN_MINT' } });
        return;
      }
    } else if (programId || tokenMint) {
      res.status(400).json({ success: false, error: { message: 'programId and tokenMint are only valid for Solana chain invoices', code: 'INVALID_PARAMS' } });
      return;
    }

    // Build paymentDetails with chain context
    const paymentDetails: Record<string, any> = { chain };
    if (paymentAddress) paymentDetails.paymentAddress = paymentAddress;
    if (chain === 'solana') {
      paymentDetails.programId = programId || SOLANA_TOKEN_PROGRAM;
      paymentDetails.tokenMint = tokenMint || SOLANA_USDC_MINT;
    }

    // Wire tax calculation when buyer location is provided
    if (buyerCountryCode && typeof buyerCountryCode === 'string') {
      const taxResult = calculateTax({
        amount: Number(amount),
        buyerLocation: {
          countryCode: buyerCountryCode,
          stateCode: buyerStateCode,
          vatNumber: buyerVatNumber,
        },
      });
      paymentDetails.tax = {
        taxRate: taxResult.taxRate,
        taxAmount: taxResult.taxAmount,
        jurisdiction: taxResult.jurisdiction,
        invoiceNote: taxResult.invoiceNote || null,
        buyerCountryCode,
        buyerStateCode: buyerStateCode || null,
        buyerVatNumber: buyerVatNumber || null,
      };
    }

    const sb = getSupabase();

    // Determine next invoice number via MAX query (atomic-safe for low throughput)
    const { data: maxData } = await sb
      .from('Invoice')
      .select('invoiceNumber')
      .order('invoiceNumber', { ascending: false })
      .limit(1)
      .single();

    const nextNumber = ((maxData?.invoiceNumber as number) || 0) + 1;
    const now = new Date().toISOString();

    const record = {
      invoiceNumber: nextNumber,
      status: 'PENDING',
      amount: Number(amount),
      currency: currency.toUpperCase(),
      customerEmail,
      customerName,
      companyId: companyId || null,
      paymentDetails,
      createdAt: now,
      updatedAt: now,
    };

    const { data, error } = await sb.from('Invoice').insert(record).select(SELECT_FIELDS).single();
    if (error) throw error;

    res.status(201).json({ success: true, data: mapInvoice(data) });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /v1/invoices/bulk/status
 * Update status for up to 50 invoices in one call.
 */
router.post('/v1/invoices/bulk/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { ids, status } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      res.status(400).json({ success: false, error: { message: 'ids must be a non-empty array', code: 'MISSING_IDS' } });
      return;
    }
    if (ids.length > 50) {
      res.status(400).json({ success: false, error: { message: 'ids array must not exceed 50 items', code: 'TOO_MANY_IDS' } });
      return;
    }
    const VALID_STATUSES = ['PENDING', 'PROCESSING', 'SETTLED', 'COMPLETED', 'CANCELLED', 'REFUNDED'];
    if (!status || !VALID_STATUSES.includes(status)) {
      res.status(400).json({ success: false, error: { message: `status must be one of: ${VALID_STATUSES.join(', ')}`, code: 'INVALID_STATUS' } });
      return;
    }
    const sb = getSupabase();
    const { data, error } = await sb
      .from('Invoice')
      .update({ status, updatedAt: new Date().toISOString() })
      .in('id', ids)
      .select('id');
    if (error) throw error;
    const updatedIds = (data || []).map((r: any) => r.id);
    res.json({ success: true, data: { updated: updatedIds.length, ids: updatedIds } });
  } catch (err) { next(err); }
});

/**
 * POST /v1/invoices/bulk/cancel
 * Cancel up to 50 PENDING invoices in one call. Skips non-PENDING.
 * Returns { cancelled, ids, skipped }.
 */
router.post('/v1/invoices/bulk/cancel', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      res.status(400).json({ success: false, error: { message: 'ids must be a non-empty array', code: 'MISSING_IDS' } });
      return;
    }
    if (ids.length > 50) {
      res.status(400).json({ success: false, error: { message: 'ids array must not exceed 50 items', code: 'TOO_MANY_IDS' } });
      return;
    }
    const sb = getSupabase();
    const { data: pending, error: fetchErr } = await sb
      .from('Invoice')
      .select('id')
      .in('id', ids)
      .eq('status', 'PENDING');
    if (fetchErr) throw fetchErr;
    const pendingIds = (pending || []).map((r: any) => r.id);
    if (pendingIds.length > 0) {
      const { error: updateErr } = await sb
        .from('Invoice')
        .update({ status: 'CANCELLED', updatedAt: new Date().toISOString() })
        .in('id', pendingIds);
      if (updateErr) throw updateErr;
    }
    res.json({ success: true, data: { cancelled: pendingIds.length, ids: pendingIds, skipped: ids.length - pendingIds.length } });
  } catch (err) { next(err); }
});

/**
 * PATCH /v1/invoices/:id/status
 * Update invoice status with transition validation.
 * Body: { status: 'PENDING' | 'SETTLED' | 'PROCESSING' | 'COMPLETED' }
 */
router.patch('/v1/invoices/:id/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const VALID_STATUSES = ['PENDING', 'SETTLED', 'PROCESSING', 'COMPLETED'];
    if (!status || !VALID_STATUSES.includes(status)) {
      res.status(400).json({
        success: false,
        error: { message: `status must be one of: ${VALID_STATUSES.join(', ')}`, code: 'INVALID_STATUS' },
      });
      return;
    }

    const VALID_TRANSITIONS: Record<string, string[]> = {
      PENDING: ['PROCESSING', 'SETTLED', 'COMPLETED'],
      SETTLED: ['PROCESSING', 'COMPLETED'],
      PROCESSING: ['COMPLETED', 'PENDING'],
      COMPLETED: [],
    };

    const sb = getSupabase();
    const { data: existing, error: fetchErr } = await sb
      .from('Invoice')
      .select('id, status')
      .eq('id', id)
      .single();

    if (fetchErr || !existing) {
      res.status(404).json({ success: false, error: { message: 'Invoice not found', code: 'NOT_FOUND' } });
      return;
    }

    if (!VALID_TRANSITIONS[existing.status]?.includes(status)) {
      res.status(400).json({
        success: false,
        error: { message: `Invalid transition: ${existing.status} → ${status}`, code: 'INVALID_TRANSITION' },
      });
      return;
    }

    const now = new Date().toISOString();
    const updateData: Record<string, any> = { status, updatedAt: now };
    if (status === 'SETTLED') updateData.settledAt = now;
    if (status === 'COMPLETED') updateData.completedAt = now;

    const { data, error } = await sb
      .from('Invoice')
      .update(updateData)
      .eq('id', id)
      .select(SELECT_FIELDS)
      .single();

    if (error) throw error;
    res.json({ success: true, data: mapInvoice(data) });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /v1/invoices/:id/metadata
 * Merge additional metadata into invoice paymentDetails.
 * Body: { metadata: Record<string, unknown> } — max 20 keys
 */
router.patch('/v1/invoices/:id/metadata', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { metadata } = req.body;

    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
      res.status(400).json({ success: false, error: { message: 'metadata must be a non-array object', code: 'INVALID_METADATA' } });
      return;
    }
    if (Object.keys(metadata).length > 20) {
      res.status(400).json({ success: false, error: { message: 'metadata must not exceed 20 keys', code: 'INVALID_METADATA' } });
      return;
    }

    const sb = getSupabase();
    const { data: existing, error: fetchErr } = await sb.from('Invoice').select('id, paymentDetails').eq('id', id).single();
    if (fetchErr || !existing) {
      res.status(404).json({ success: false, error: { message: 'Invoice not found', code: 'NOT_FOUND' } });
      return;
    }

    const pd = typeof existing.paymentDetails === 'string'
      ? JSON.parse(existing.paymentDetails)
      : (existing.paymentDetails || {});
    const merged = { ...pd, ...metadata };

    const { data, error } = await sb.from('Invoice').update({ paymentDetails: merged, updatedAt: new Date().toISOString() }).eq('id', id).select(SELECT_FIELDS).single();
    if (error) throw error;
    res.json({ success: true, data: mapInvoice(data) });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /v1/invoices/:id/duplicate
 * Clone an existing invoice as a new PENDING invoice.
 * Copies customerEmail, customerName, amount, currency, companyId, paymentDetails.
 * Returns 201 with the new invoice. Returns 404 if source not found.
 */
router.post('/v1/invoices/:id/duplicate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const sb = getSupabase();

    const { data: source, error: fetchErr } = await sb
      .from('Invoice')
      .select(SELECT_FIELDS)
      .eq('id', id)
      .single();

    if (fetchErr || !source) {
      res.status(404).json({ success: false, error: { message: 'Invoice not found', code: 'NOT_FOUND' } });
      return;
    }

    const { data: maxData } = await sb
      .from('Invoice')
      .select('invoiceNumber')
      .order('invoiceNumber', { ascending: false })
      .limit(1)
      .single();

    const nextNumber = ((maxData?.invoiceNumber as number) || 0) + 1;
    const now = new Date().toISOString();

    const { data: created, error: insertErr } = await sb
      .from('Invoice')
      .insert({
        invoiceNumber: nextNumber,
        status: 'PENDING',
        amount: source.amount,
        currency: source.currency,
        customerEmail: source.customerEmail,
        customerName: source.customerName,
        companyId: source.companyId || null,
        paymentDetails: source.paymentDetails || null,
        createdAt: now,
        updatedAt: now,
      })
      .select(SELECT_FIELDS)
      .single();

    if (insertErr) throw insertErr;

    res.status(201).json({ success: true, data: mapInvoice(created) });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /v1/invoices/:id/remind
 * Send a payment reminder for a pending invoice.
 * Returns 400 if already settled/completed/cancelled.
 */
router.post('/v1/invoices/:id/remind', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const sb = getSupabase();

    const { data: existing, error: fetchErr } = await sb
      .from('Invoice')
      .select('id, status, customerEmail')
      .eq('id', id)
      .single();

    if (fetchErr || !existing) {
      res.status(404).json({ success: false, error: { message: 'Invoice not found', code: 'NOT_FOUND' } });
      return;
    }

    if (['SETTLED', 'COMPLETED', 'CANCELLED'].includes(existing.status)) {
      res.status(400).json({ success: false, error: { message: `Cannot send reminder for invoice with status ${existing.status}`, code: 'INVALID_STATUS' } });
      return;
    }

    res.json({ success: true, data: { sent: true, to: existing.customerEmail, invoiceId: id } });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /v1/invoices/:id/cancel
 * Cancel a PENDING invoice. Returns 400 if not PENDING, 404 if not found.
 */
router.post('/v1/invoices/:id/cancel', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const sb = getSupabase();

    const { data: existing, error: fetchErr } = await sb
      .from('Invoice')
      .select('id, status')
      .eq('id', id)
      .single();

    if (fetchErr || !existing) {
      res.status(404).json({ success: false, error: { message: 'Invoice not found', code: 'NOT_FOUND' } });
      return;
    }

    if (existing.status === 'CANCELLED') {
      res.status(400).json({ success: false, error: { message: 'Invoice is already cancelled', code: 'ALREADY_CANCELLED' } });
      return;
    }

    if (existing.status !== 'PENDING') {
      res.status(400).json({ success: false, error: { message: `Cannot cancel invoice with status ${existing.status}`, code: 'INVALID_STATUS' } });
      return;
    }

    const { data, error } = await sb
      .from('Invoice')
      .update({ status: 'CANCELLED', updatedAt: new Date().toISOString() })
      .eq('id', id)
      .select(SELECT_FIELDS)
      .single();

    if (error) throw error;
    res.json({ success: true, data: mapInvoice(data) });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /v1/invoices/:id/void
 * Void an invoice by setting its status to CANCELLED.
 * Returns 400 if already CANCELLED, 404 if not found.
 */
router.post('/v1/invoices/:id/void', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const sb = getSupabase();

    const { data: existing, error: fetchErr } = await sb
      .from('Invoice')
      .select('id, status')
      .eq('id', id)
      .single();

    if (fetchErr || !existing) {
      res.status(404).json({ success: false, error: { message: 'Invoice not found', code: 'NOT_FOUND' } });
      return;
    }

    if (existing.status === 'CANCELLED') {
      res.status(400).json({ success: false, error: { message: 'Invoice is already cancelled', code: 'ALREADY_CANCELLED' } });
      return;
    }

    const { data, error } = await sb
      .from('Invoice')
      .update({ status: 'CANCELLED', updatedAt: new Date().toISOString() })
      .eq('id', id)
      .select(SELECT_FIELDS)
      .single();

    if (error) throw error;
    res.json({ success: true, data: mapInvoice(data) });
  } catch (err) {
    next(err);
  }
});

export default router;
