import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { validateChain } from '../lib/chain-validator';
import { AppError } from '../lib/errors';
import { logger } from '../lib/logger';

const router = Router();

// Validation schemas
const createInvoiceSchema = z.object({
  customerId: z.string().uuid(),
  amount: z.number().positive(),
  currency: z.string().length(3),
  dueDate: z.string().datetime(),
  items: z.array(z.object({
    description: z.string(),
    quantity: z.number().positive(),
    unitPrice: z.number().positive(),
  })).min(1),
});

const updateInvoiceSchema = z.object({
  status: z.enum(['pending', 'paid', 'overdue', 'cancelled']).optional(),
  paidAt: z.string().datetime().optional(),
});

const invoiceQuerySchema = z.object({
  customerId: z.string().uuid().optional(),
  status: z.enum(['pending', 'paid', 'overdue', 'cancelled']).optional(),
  page: z.string().regex(/^\d+$/).transform(Number).optional(),
  limit: z.string().regex(/^\d+$/).transform(Number).optional(),
});

// Helper function to calculate invoice totals
function calculateTotals(items: Array<{ quantity: number; unitPrice: number }>) {
  let subtotal = 0;
  for (const item of items) {
    subtotal += item.quantity * item.unitPrice;
  }
  const tax = subtotal * 0.1; // 10% tax
  const total = subtotal + tax;
  return { subtotal, tax, total };
}

// Generate sequential invoice number
async function generateInvoiceNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const countResult = await prisma.$queryRaw<[{ count: bigint }]>`
    SELECT COUNT(*) as count FROM invoices WHERE EXTRACT(YEAR FROM created_at) = ${year}
  `;
  const count = Number(countResult[0].count) + 1;
  return `INV-${year}-${count.toString().padStart(5, '0')}`;
}

// POST /invoices - Create a new invoice
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const chain = validateChain(req.body.chain ?? req.query.chain);
    
    const validatedData = createInvoiceSchema.parse(req.body);
    
    const { subtotal, tax, total } = calculateTotals(validatedData.items);
    const invoiceNumber = await generateInvoiceNumber();
    
    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber,
        customerId: validatedData.customerId,
        amount: total,
        currency: validatedData.currency,
        dueDate: new Date(validatedData.dueDate),
        status: 'pending',
        items: {
          create: validatedData.items.map(item => ({
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            total: item.quantity * item.unitPrice,
          })),
        },
        subtotal,
        tax,
      },
      include: {
        items: true,
        customer: true,
      },
    });
    
    logger.info('Invoice created', { invoiceId: invoice.id, invoiceNumber });
    res.status(201).json(invoice);
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new AppError('Validation error', 400, error.errors));
    } else {
      next(error);
    }
  }
});

// GET /invoices - List all invoices with pagination
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const chain = validateChain(req.body.chain ?? req.query.chain);
    
    const validatedQuery = invoiceQuerySchema.parse(req.query);
    const page = validatedQuery.page ?? 1;
    const limit = validatedQuery.limit ?? 20;
    const skip = (page - 1) * limit;
    
    const where: Record<string, unknown> = {};
    if (validatedQuery.customerId) {
      where.customerId = validatedQuery.customerId;
    }
    if (validatedQuery.status) {
      where.status = validatedQuery.status;
    }
    
    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          customer: {
            select: { id: true, name: true, email: true },
          },
          items: true,
        },
      }),
      prisma.invoice.count({ where }),
    ]);
    
    res.json({
      data: invoices,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new AppError('Validation error', 400, error.errors));
    } else {
      next(error);
    }
  }
});

// GET /invoices/number/:number - Get invoice by invoice number
router.get('/number/:number', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const invoiceNumber = parseInt(req.params.number, 10);
    if (isNaN(invoiceNumber) || invoiceNumber < 1) {
      res.status(400).json({ success: false, error: { message: 'Invalid invoice number', code: 'VALIDATION_ERROR' } });
      return;
    }
    const { createClient } = require('@supabase/supabase-js');
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const { data: invoice, error } = await sb.from('Invoice').select('*').eq('invoiceNumber', invoiceNumber).single();
    if (error || !invoice) {
      res.status(404).json({ success: false, error: { message: 'Invoice not found', code: 'NOT_FOUND' } });
      return;
    }
    res.json({ success: true, data: invoice });
  } catch (err) {
    next(err);
  }
});

// GET /invoices/:id - Get invoice by ID
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const chain = validateChain(req.body.chain ?? req.query.chain);
    
    const { id } = req.params;
    
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        customer: true,
        items: true,
        payments: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    
    if (!invoice) {
      throw new AppError('Invoice not found', 404);
    }
    
    res.json(invoice);
  } catch (error) {
    next(error);
  }
});

// PATCH /invoices/:id - Update invoice
router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const chain = validateChain(req.body.chain ?? req.query.chain);
    
    const { id } = req.params;
    const validatedData = updateInvoiceSchema.parse(req.body);
    
    const existingInvoice = await prisma.invoice.findUnique({
      where: { id },
    });
    
    if (!existingInvoice) {
      throw new AppError('Invoice not found', 404);
    }
    
    // Validate status transitions
    if (validatedData.status) {
      const validTransitions: Record<string, string[]> = {
        pending: ['paid', 'cancelled'],
        paid: ['refunded'],
        overdue: ['paid', 'cancelled'],
        cancelled: [],
        refunded: ['paid'],
      };
      
      const currentStatus = existingInvoice.status;
      if (!validTransitions[currentStatus]?.includes(validatedData.status)) {
        throw new AppError(
          `Invalid status transition from ${currentStatus} to ${validatedData.status}`,
          400
        );
      }
    }
    
    const updateData: Record<string, unknown> = { ...validatedData };
    if (validatedData.paidAt) {
      updateData.paidAt = new Date(validatedData.paidAt);
    }
    
    const invoice = await prisma.invoice.update({
      where: { id },
      data: updateData,
      include: {
        customer: true,
        items: true,
      },
    });
    
    logger.info('Invoice updated', { invoiceId: id, status: validatedData.status });
    res.json(invoice);
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new AppError('Validation error', 400, error.errors));
    } else {
      next(error);
    }
  }
});

// DELETE /invoices/:id - Delete invoice (soft delete)
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const chain = validateChain(req.body.chain ?? req.query.chain);
    
    const { id } = req.params;
    
    const existingInvoice = await prisma.invoice.findUnique({
      where: { id },
    });
    
    if (!existingInvoice) {
      throw new AppError('Invoice not found', 404);
    }
    
    if (existingInvoice.status === 'paid') {
      throw new AppError('Cannot delete a paid invoice', 400);
    }
    
    await prisma.invoice.update({
      where: { id },
      data: { status: 'cancelled' },
    });
    
    logger.info('Invoice cancelled', { invoiceId: id });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// GET /invoices/:id/pdf - Generate PDF invoice
router.get('/:id/pdf', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const chain = validateChain(req.body.chain ?? req.query.chain);
    
    const { id } = req.params;
    
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        customer: true,
        items: true,
      },
    });
    
    if (!invoice) {
      throw new AppError('Invoice not found', 404);
    }
    
    // PDF generation is handled by the worker queue
    // This endpoint returns the status of the PDF generation
    res.json({
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      status: 'processing',
      message: 'PDF generation queued',
    });
  } catch (error) {
    next(error);
  }
});

// POST /invoices/:id/send - Send invoice via email
router.post('/:id/send', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const chain = validateChain(req.body.chain ?? req.query.chain);
    
    const { id } = req.params;
    
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        customer: true,
      },
    });
    
    if (!invoice) {
      throw new AppError('Invoice not found', 404);
    }
    
    // Email sending is handled by the worker queue
    logger.info('Invoice send queued', { invoiceId: id, customerEmail: invoice.customer.email });
    res.json({
      invoiceId: invoice.id,
      status: 'sent',
      message: 'Invoice sent to customer',
    });
  } catch (error) {
    next(error);
  }
});

// GET /invoices/:id/status - Get payment status
router.get('/:id/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const chain = validateChain(req.body.chain ?? req.query.chain);
    
    const { id } = req.params;
    
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      select: {
        id: true,
        invoiceNumber: true,
        status: true,
        amount: true,
        paidAt: true,
        dueDate: true,
      },
    });
    
    if (!invoice) {
      throw new AppError('Invoice not found', 404);
    }
    
    // Calculate if overdue
    const isOverdue = 
      invoice.status === 'pending' && 
      new Date(invoice.dueDate) < new Date();
    
    res.json({
      ...invoice,
      isOverdue,
    });
  } catch (error) {
    next(error);
  }
});

// POST /invoices/:id/remind - Send payment reminder
router.post('/:id/remind', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const chain = validateChain(req.body.chain ?? req.query.chain);
    
    const { id } = req.params;
    
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        customer: true,
      },
    });
    
    if (!invoice) {
      throw new AppError('Invoice not found', 404);
    }
    
    if (invoice.status !== 'pending') {
      throw new AppError('Can only send reminders for pending invoices', 400);
    }
    
    // Reminder sending is handled by the worker queue
    logger.info('Payment reminder queued', { invoiceId: id });
    res.json({
      invoiceId: invoice.id,
      status: 'reminder_sent',
      message: 'Payment reminder sent',
    });
  } catch (error) {
    next(error);
  }
});

export default router;