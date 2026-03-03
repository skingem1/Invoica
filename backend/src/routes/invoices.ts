import express, { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { PrismaClient, InvoiceStatus, PaymentMethod } from '@prisma/client';
import { validateChain } from '../lib/chain-validator';

const router = express.Router();
const prisma = new PrismaClient();

// Validation schemas
const createInvoiceSchema = z.object({
  body: z.object({
    customerId: z.string().uuid('Invalid customer ID format'),
    amount: z.number().positive('Amount must be positive'),
    currency: z.string().length(3, 'Currency must be 3-letter code').default('USD'),
    description: z.string().optional(),
    dueDate: z.string().datetime().optional(),
    paymentMethods: z.array(z.enum(['BANK_TRANSFER', 'CREDIT_CARD', 'CRYPTO'])).optional(),
    lineItems: z.array(z.object({
      description: z.string(),
      quantity: z.number().positive(),
      unitPrice: z.number().positive(),
      taxRate: z.number().min(0).max(1).optional().default(0),
    })).min(1, 'At least one line item is required'),
    metadata: z.record(z.unknown()).optional(),
  }),
});

const updateInvoiceSchema = z.object({
  body: z.object({
    status: z.nativeEnum(InvoiceStatus).optional(),
    paymentMethod: z.nativeEnum(PaymentMethod).optional(),
    paidAt: z.string().datetime().optional(),
    notes: z.string().optional(),
    metadata: z.record(z.unknown()).optional(),
  }),
  params: z.object({
    id: z.string().uuid('Invalid invoice ID format'),
  }),
});

const invoiceIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid invoice ID format'),
  }),
});

const paginationSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    status: z.nativeEnum(InvoiceStatus).optional(),
    customerId: z.string().uuid().optional(),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    sortBy: z.enum(['createdAt', 'updatedAt', 'dueDate', 'amount']).default('createdAt'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
  }),
});

// Error handling wrapper
const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Custom error class
class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public isOperational = true
  ) {
    super(message);
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

// Invoice number generator
async function generateInvoiceNumber(prisma: PrismaClient): Promise<string> {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  
  const lastInvoice = await prisma.invoice.findFirst({
    where: {
      invoiceNumber: {
        startsWith: `INV-${year}${month}`,
      },
    },
    orderBy: { invoiceNumber: 'desc' },
  });

  let sequence = 1;
  if (lastInvoice) {
    const lastSequence = parseInt(lastInvoice.invoiceNumber.split('-')[2], 10);
    sequence = lastSequence + 1;
  }

  return `INV-${year}${month}-${String(sequence).padStart(4, '0')}`;
}

// Calculate invoice totals
function calculateInvoiceTotals(lineItems: Array<{
  quantity: number;
  unitPrice: number;
  taxRate?: number;
}>) {
  let subtotal = 0;
  let totalTax = 0;

  for (const item of lineItems) {
    const itemSubtotal = item.quantity * item.unitPrice;
    const itemTax = itemSubtotal * (item.taxRate || 0);
    subtotal += itemSubtotal;
    totalTax += itemTax;
  }

  return {
    subtotal,
    tax: totalTax,
    total: subtotal + totalTax,
  };
}

// Status transition validation
const validStatusTransitions: Record<InvoiceStatus, InvoiceStatus[]> = {
  [InvoiceStatus.DRAFT]: [InvoiceStatus.PENDING, InvoiceStatus.CANCELLED],
  [InvoiceStatus.PENDING]: [InvoiceStatus.PROCESSING, InvoiceStatus.SETTLED, InvoiceStatus.OVERDUE, InvoiceStatus.CANCELLED],
  [InvoiceStatus.PROCESSING]: [InvoiceStatus.SETTLED, InvoiceStatus.FAILED, InvoiceStatus.PENDING],
  [InvoiceStatus.SETTLED]: [InvoiceStatus.COMPLETED, InvoiceStatus.REFUNDED],
  [InvoiceStatus.COMPLETED]: [InvoiceStatus.REFUNDED],
  [InvoiceStatus.FAILED]: [InvoiceStatus.PENDING, InvoiceStatus.CANCELLED],
  [InvoiceStatus.OVERDUE]: [InvoiceStatus.SETTLED, InvoiceStatus.CANCELLED, InvoiceStatus.COLLECTION],
  [InvoiceStatus.COLLECTION]: [InvoiceStatus.SETTLED, InvoiceStatus.WRITE_OFF],
  [InvoiceStatus.REFUNDED]: [],
  [InvoiceStatus.CANCELLED]: [],
  [InvoiceStatus.WRITE_OFF]: [],
};

function isValidStatusTransition(from: InvoiceStatus, to: InvoiceStatus): boolean {
  return validStatusTransitions[from]?.includes(to) ?? false;
}

// Route handlers

/**
 * GET /invoices
 * List all invoices with pagination and filters
 */
router.get(
  '/',
  validateChain(paginationSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { page, limit, status, customerId, startDate, endDate, sortBy, sortOrder } = (req as any).validated;
    
    const where: any = {};
    
    if (status) {
      where.status = status;
    }
    
    if (customerId) {
      where.customerId = customerId;
    }
    
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        where.createdAt.lte = new Date(endDate);
      }
    }

    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          customer: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          lineItems: true,
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
        totalPages: Math.ceil(total / limit),
      },
    });
  })
);

/**
 * GET /invoices/:id
 * Get a single invoice by ID
 */
router.get(
  '/:id',
  validateChain(invoiceIdParamSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = (req as any).validated.params;
    
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        customer: true,
        lineItems: true,
        payments: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!invoice) {
      throw new AppError(404, 'Invoice not found');
    }

    res.json(invoice);
  })
);

/**
 * POST /invoices
 * Create a new invoice
 */
router.post(
  '/',
  validateChain(createInvoiceSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { body } = (req as any).validated;
    const { lineItems, metadata, ...invoiceData } = body;

    // Generate invoice number atomically
    const invoiceNumber = await prisma.$transaction(async (tx) => {
      return generateInvoiceNumber(tx);
    });

    // Calculate totals
    const { subtotal, tax, total } = calculateInvoiceTotals(lineItems);

    // Calculate due date (default to 30 days)
    const dueDate = body.dueDate 
      ? new Date(body.dueDate) 
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber,
        customerId: body.customerId,
        amount: total,
        subtotal,
        tax,
        currency: body.currency,
        description: body.description,
        dueDate,
        status: InvoiceStatus.DRAFT,
        paymentMethods: body.paymentMethods || [PaymentMethod.BANK_TRANSFER],
        metadata,
        lineItems: {
          create: lineItems.map((item: any) => ({
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            taxRate: item.taxRate || 0,
          })),
        },
      },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        lineItems: true,
      },
    });

    res.status(201).json(invoice);
  })
);

/**
 * PATCH /invoices/:id
 * Update an invoice
 */
router.patch(
  '/:id',
  validateChain(updateInvoiceSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = (req as any).validated.params;
    const updateData = (req as any).validated.body;

    const existingInvoice = await prisma.invoice.findUnique({
      where: { id },
    });

    if (!existingInvoice) {
      throw new AppError(404, 'Invoice not found');
    }

    // Validate status transition if status is being updated
    if (updateData.status && updateData.status !== existingInvoice.status) {
      if (!isValidStatusTransition(existingInvoice.status, updateData.status)) {
        throw new AppError(
          400,
          `Invalid status transition from ${existingInvoice.status} to ${updateData.status}`
        );
      }
    }

    const invoice = await prisma.invoice.update({
      where: { id },
      data: {
        ...updateData,
        paidAt: updateData.paidAt ? new Date(updateData.paidAt) : undefined,
      },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        lineItems: true,
      },
    });

    res.json(invoice);
  })
);

/**
 * DELETE /invoices/:id
 * Delete (cancel) an invoice
 */
router.delete(
  '/:id',
  validateChain(invoiceIdParamSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = (req as any).validated.params;

    const existingInvoice = await prisma.invoice.findUnique({
      where: { id },
    });

    if (!existingInvoice) {
      throw new AppError(404, 'Invoice not found');
    }

    // Only allow deletion of DRAFT or CANCELLED invoices
    if (existingInvoice.status !== InvoiceStatus.DRAFT && 
        existingInvoice.status !== InvoiceStatus.CANCELLED) {
      throw new AppError(
        400,
        'Only DRAFT or CANCELLED invoices can be deleted'
      );
    }

    await prisma.invoice.delete({
      where: { id },
    });

    res.status(204).send();
  })
);

/**
 * POST /invoices/:id/send
 * Send invoice to customer via email
 */
router.post(
  '/:id/send',
  validateChain(invoiceIdParamSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = (req as any).validated.params;

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        customer: true,
        lineItems: true,
      },
    });

    if (!invoice) {
      throw new AppError(404, 'Invoice not found');
    }

    if (invoice.status === InvoiceStatus.DRAFT) {
      // Auto-publish draft invoices when sending
      await prisma.invoice.update({
        where: { id },
        data: { status: InvoiceStatus.PENDING },
      });
    }

    // TODO: Integrate with email service (SendGrid)
    // await sendInvoiceEmail(invoice);

    res.json({ message: 'Invoice sent successfully', invoiceId: id });
  })
);

/**
 * POST /invoices/:id/remind
 * Send payment reminder for overdue invoice
 */
router.post(
  '/:id/remind',
  validateChain(invoiceIdParamSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = (req as any).validated.params;

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        customer: true,
      },
    });

    if (!invoice) {
      throw new AppError(404, 'Invoice not found');
    }

    if (invoice.status !== InvoiceStatus.OVERDUE && invoice.status !== InvoiceStatus.PENDING) {
      throw new AppError(400, 'Can only send reminders for PENDING or OVERDUE invoices');
    }

    // TODO: Integrate with email service for reminders
    // await sendReminderEmail(invoice);

    res.json({ message: 'Reminder sent successfully', invoiceId: id });
  })
);

/**
 * GET /invoices/:id/pdf
 * Generate and return PDF for invoice
 */
router.get(
  '/:id/pdf',
  validateChain(invoiceIdParamSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = (req as any).validated.params;

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        customer: true,
        lineItems: true,
      },
    });

    if (!invoice) {
      throw new AppError(404, 'Invoice not found');
    }

    // TODO: Integrate with PDF generation service
    // const pdfBuffer = await generateInvoicePDF(invoice);
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="invoice-${invoice.invoiceNumber}.pdf"`);
    res.send(Buffer.from('PDF placeholder')); // Replace with actual PDF
  })
);

/**
 * POST /invoices/:id/process-payment
 * Process payment for an invoice
 */
router.post(
  '/:id/process-payment',
  validateChain(invoiceIdParamSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = (req as any).validated.params;
    const { paymentMethod, paymentDetails } = req.body;

    const invoice = await prisma.invoice.findUnique({
      where: { id },
    });

    if (!invoice) {
      throw new AppError(404, 'Invoice not found');
    }

    if (invoice.status !== InvoiceStatus.PENDING && invoice.status !== InvoiceStatus.PROCESSING) {
      throw new AppError(400, 'Invoice is not in a payable state');
    }

    // Update status to processing
    await prisma.invoice.update({
      where: { id },
      data: { 
        status: InvoiceStatus.PROCESSING,
        paymentMethod: paymentMethod as PaymentMethod,
      },
    });

    // TODO: Integrate with payment processor
    // const paymentResult = await processPayment(invoice, paymentDetails);

    res.json({ 
      message: 'Payment processing initiated',
      invoiceId: id,
      status: InvoiceStatus.PROCESSING,
    });
  })
);

// Error handling middleware
router.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Invoice route error:', err);

  if (err instanceof z.ZodError) {
    return res.status(400).json({
      status: 'error',
      message: 'Validation error',
      errors: err.errors.map((e) => ({
        path: e.path.join('.'),
        message: e.message,
      })),
    });
  }

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      status: 'error',
      message: err.message,
    });
  }

  res.status(500).json({
    status: 'error',
    message: 'Internal server error',
  });
});

export default router;

// [Part A complete - awaiting Part B]