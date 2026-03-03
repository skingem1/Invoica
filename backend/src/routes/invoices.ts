import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { PrismaClient, InvoiceStatus, Chain } from '@prisma/client';
import { validateChain } from '../lib/chain-validator';

const router = Router();
const prisma = new PrismaClient();

// Validation schemas
const createInvoiceSchema = z.object({
  merchantId: z.string().uuid(),
  amount: z.number().positive(),
  currency: z.string().length(3),
  chain: z.string().optional(),
  description: z.string().optional(),
  dueDate: z.string().datetime().optional(),
});

const updateInvoiceSchema = z.object({
  status: z.enum(['pending', 'settled', 'processing', 'completed', 'failed']).optional(),
  paidAt: z.string().datetime().optional(),
  settlementId: z.string().optional(),
});

const invoiceQuerySchema = z.object({
  merchantId: z.string().uuid().optional(),
  status: z.enum(['pending', 'settled', 'processing', 'completed', 'failed']).optional(),
  chain: z.string().optional(),
  page: z.string().regex(/^\d+$/).optional(),
  limit: z.string().regex(/^\d+$/).optional(),
});

type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;
type UpdateInvoiceInput = z.infer<typeof updateInvoiceSchema>;
type InvoiceQueryInput = z.infer<typeof invoiceQuerySchema>;

// Error class for invoice operations
export class InvoiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400,
    public details?: unknown
  ) {
    super(message);
    this.name = 'InvoiceError';
  }
}

// Helper to handle async route errors
const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Generate sequential invoice number atomically
 * Uses PostgreSQL advisory lock for concurrency safety
 */
async function generateInvoiceNumber(prisma: PrismaClient): Promise<string> {
  const result = await prisma.$transaction(async (tx) => {
    const lock = await tx.$executeRaw`SELECT pg_advisory_xact_lock(1234567)`;
    
    const lastInvoice = await tx.invoice.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { invoiceNumber: true },
    });
    
    const lastNumber = lastInvoice?.invoiceNumber 
      ? parseInt(lastInvoice.invoiceNumber.replace('INV-', ''), 10) 
      : 0;
    
    const newNumber = lastNumber + 1;
    const invoiceNumber = `INV-${newNumber.toString().padStart(8, '0')}`;
    
    return invoiceNumber;
  });
  
  return result;
}

/**
 * POST /api/invoices
 * Create a new invoice
 */
router.post('/', asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const validationResult = createInvoiceSchema.safeParse(req.body);
  
  if (!validationResult.success) {
    throw new InvoiceError(
      'Invalid invoice data',
      'VALIDATION_ERROR',
      400,
      validationResult.error.flatten()
    );
  }

  const data: CreateInvoiceInput = validationResult.data;
  const chain = validateChain(req.body.chain ?? req.body.chain);

  const invoiceNumber = await generateInvoiceNumber(prisma);

  const invoice = await prisma.invoice.create({
    data: {
      invoiceNumber,
      merchantId: data.merchantId,
      amount: data.amount,
      currency: data.currency.toUpperCase(),
      chain,
      description: data.description,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      status: InvoiceStatus.PENDING,
    },
    include: {
      merchant: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  res.status(201).json({
    success: true,
    data: invoice,
  });
}));

/**
 * GET /api/invoices
 * List invoices with filtering and pagination
 */
router.get('/', asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const queryValidation = invoiceQuerySchema.safeParse(req.query);
  
  if (!queryValidation.success) {
    throw new InvoiceError(
      'Invalid query parameters',
      'VALIDATION_ERROR',
      400,
      queryValidation.error.flatten()
    );
  }

  const query: InvoiceQueryInput = queryValidation.data;
  const page = parseInt(query.page ?? '1', 10);
  const limit = Math.min(parseInt(query.limit ?? '20', 10), 100);
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {};
  
  if (query.merchantId) {
    where.merchantId = query.merchantId;
  }
  
  if (query.status) {
    where.status = query.status;
  }
  
  if (query.chain) {
    where.chain = validateChain(query.chain);
  }

  const [invoices, total] = await Promise.all([
    prisma.invoice.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        merchant: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        settlement: true,
      },
    }),
    prisma.invoice.count({ where }),
  ]);

  res.json({
    success: true,
    data: invoices,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}));

/**
 * GET /api/invoices/:id
 * Get a single invoice by ID
 */
router.get('/:id', asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      merchant: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      settlement: true,
    },
  });

  if (!invoice) {
    throw new InvoiceError(
      'Invoice not found',
      'NOT_FOUND',
      404
    );
  }

  res.json({
    success: true,
    data: invoice,
  });
}));

/**
 * PATCH /api/invoices/:id
 * Update an invoice (status, settlement info, etc.)
 */
router.patch('/:id', asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;
  const validationResult = updateInvoiceSchema.safeParse(req.body);

  if (!validationResult.success) {
    throw new InvoiceError(
      'Invalid update data',
      'VALIDATION_ERROR',
      400,
      validationResult.error.flatten()
    );
  }

  const data: UpdateInvoiceInput = validationResult.data;

  // Check if invoice exists
  const existingInvoice = await prisma.invoice.findUnique({
    where: { id },
  });

  if (!existingInvoice) {
    throw new InvoiceError(
      'Invoice not found',
      'NOT_FOUND',
      404
    );
  }

  // Validate status transition
  const validTransitions: Record<InvoiceStatus, InvoiceStatus[]> = {
    [InvoiceStatus.PENDING]: [InvoiceStatus.SETTLED, InvoiceStatus.FAILED],
    [InvoiceStatus.SETTLED]: [InvoiceStatus.PROCESSING],
    [InvoiceStatus.PROCESSING]: [InvoiceStatus.COMPLETED, InvoiceStatus.FAILED],
    [InvoiceStatus.COMPLETED]: [],
    [InvoiceStatus.FAILED]: [InvoiceStatus.PENDING],
  };

  if (data.status && data.status !== existingInvoice.status) {
    const allowed = validTransitions[existingInvoice.status];
    if (!allowed.includes(data.status)) {
      throw new InvoiceError(
        `Invalid status transition from ${existingInvoice.status} to ${data.status}`,
        'INVALID_STATUS_TRANSITION',
        400
      );
    }
  }

  const updateData: Record<string, unknown> = {};
  
  if (data.status) {
    updateData.status = data.status;
  }
  
  if (data.paidAt) {
    updateData.paidAt = new Date(data.paidAt);
  }
  
  if (data.settlementId) {
    updateData.settlementId = data.settlementId;
  }

  const invoice = await prisma.invoice.update({
    where: { id },
    data: updateData,
    include: {
      merchant: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      settlement: true,
    },
  });

  res.json({
    success: true,
    data: invoice,
  });
}));

/**
 * DELETE /api/invoices/:id
 * Delete (cancel) an invoice - only allowed for pending invoices
 */
router.delete('/:id', asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;

  const invoice = await prisma.invoice.findUnique({
    where: { id },
  });

  if (!invoice) {
    throw new InvoiceError(
      'Invoice not found',
      'NOT_FOUND',
      404
    );
  }

  if (invoice.status !== InvoiceStatus.PENDING) {
    throw new InvoiceError(
      'Can only delete pending invoices',
      'INVALID_OPERATION',
      400
    );
  }

  await prisma.invoice.delete({
    where: { id },
  });

  res.status(204).send();
}));

/**
 * GET /api/invoices/merchant/:merchantId
 * Get all invoices for a specific merchant
 */
router.get('/merchant/:merchantId', asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { merchantId } = req.params;
  const { status, chain, page, limit } = req.query;

  const pageNum = parseInt(page as string ?? '1', 10);
  const limitNum = Math.min(parseInt(limit as string ?? '20', 10), 100);
  const skip = (pageNum - 1) * limitNum;

  const where: Record<string, unknown> = { merchantId };
  
  if (status) {
    where.status = status;
  }
  
  if (chain) {
    where.chain = validateChain(chain as string);
  }

  const [invoices, total] = await Promise.all([
    prisma.invoice.findMany({
      where,
      skip,
      take: limitNum,
      orderBy: { createdAt: 'desc' },
      include: {
        merchant: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        settlement: true,
      },
    }),
    prisma.invoice.count({ where }),
  ]);

  res.json({
    success: true,
    data: invoices,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum),
    },
  });
}));

/**
 * POST /api/invoices/:id/retry
 * Retry a failed invoice payment
 */
router.post('/:id/retry', asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;

  const invoice = await prisma.invoice.findUnique({
    where: { id },
  });

  if (!invoice) {
    throw new InvoiceError(
      'Invoice not found',
      'NOT_FOUND',
      404
    );
  }

  if (invoice.status !== InvoiceStatus.FAILED) {
    throw new InvoiceError(
      'Can only retry failed invoices',
      'INVALID_OPERATION',
      400
    );
  }

  const updatedInvoice = await prisma.invoice.update({
    where: { id },
    data: {
      status: InvoiceStatus.PENDING,
      failedAt: null,
      failureReason: null,
    },
    include: {
      merchant: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  res.json({
    success: true,
    data: updatedInvoice,
  });
}));

// Error handling middleware
router.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Invoice route error:', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  if (err instanceof InvoiceError) {
    res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
      },
    });
    return;
  }

  // Handle Prisma errors
  if (err.name === 'PrismaClientKnownRequestError') {
    res.status(400).json({
      success: false,
      error: {
        code: 'DATABASE_ERROR',
        message: 'A database error occurred',
      },
    });
    return;
  }

  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An internal server error occurred',
    },
  });
});

export default router;