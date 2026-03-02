/**
 * Invoice Routes
 * 
 * REST API endpoints for invoice CRUD operations.
 * Chain validation uses the chain registry for dynamic supported chains.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { PrismaClient, InvoiceStatus, Prisma } from '@prisma/client';
import { getSupportedChains, getChainBySlug, ChainInfo } from '../lib/chain-registry';
import { InvoiceNotFoundError, ValidationError } from '../lib/errors';
import { logger } from '../lib/logger';
import { paginateSchema, createPaginationResponse } from '../lib/pagination';

const router = Router();
const prisma = new PrismaClient();

// ============================================
// Validation Schemas
// ============================================

/**
 * Schema for creating a new invoice
 * Chain field validated against chain registry
 */
export const createInvoiceSchema = z.object({
  merchantId: z.string().uuid({ message: 'Invalid merchant ID format' }),
  amount: z.number().positive({ message: 'Amount must be positive' }),
  currency: z.string().length(3).toUpperCase({ message: 'Currency must be 3-letter ISO code' }).default('USD'),
  description: z.string().max(500).optional(),
  customerId: z.string().uuid().optional(),
  metadata: z.record(z.unknown()).optional(),
  chain: z.string().refine(
    (c) => getSupportedChains().includes(c),
    { message: `Chain must be one of: ${getSupportedChains().join(', ')}` }
  ).default('base'),
  walletAddress: z.string().min(32).max(44).optional(),
}).strict();

export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;

/**
 * Schema for updating an invoice
 */
export const updateInvoiceSchema = z.object({
  status: z.nativeEnum(InvoiceStatus).optional(),
  description: z.string().max(500).optional(),
  metadata: z.record(z.unknown()).optional(),
}).strict();

export type UpdateInvoiceInput = z.infer<typeof updateInvoiceSchema>;

/**
 * Schema for listing invoices query params
 */
export const listInvoicesQuerySchema = z.object({
  merchantId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
  status: z.nativeEnum(InvoiceStatus).optional(),
  chain: z.string().refine(
    (c) => getSupportedChains().includes(c),
    { message: `Chain must be one of: ${getSupportedChains().join(', ')}` }
  ).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.enum(['createdAt', 'updatedAt', 'amount', 'dueDate']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type ListInvoicesQuery = z.infer<typeof listInvoicesQuerySchema>;

// ============================================
// Type Helpers
// ============================================

/**
 * Invoice response type with chain display name
 */
export interface InvoiceResponse {
  id: string;
  invoiceNumber: string;
  merchantId: string;
  customerId: string | null;
  amount: string;
  currency: string;
  status: InvoiceStatus;
  description: string | null;
  chain: string;
  chainDisplayName: string;
  walletAddress: string | null;
  metadata: Record<string, unknown> | null;
  dueDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// Response Transformers
// ============================================

/**
 * Transform Prisma invoice to API response with chain info
 */
function toInvoiceResponse(invoice: Awaited<ReturnType<typeof prisma.invoice.findUnique>>): InvoiceResponse {
  if (!invoice) {
    throw new InvoiceNotFoundError('Invoice not found');
  }

  const chainInfo: ChainInfo | undefined = getChainBySlug(invoice.chain);
  
  return {
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    merchantId: invoice.merchantId,
    customerId: invoice.customerId,
    amount: invoice.amount.toString(),
    currency: invoice.currency,
    status: invoice.status,
    description: invoice.description,
    chain: invoice.chain,
    chainDisplayName: chainInfo?.displayName || invoice.chain,
    walletAddress: invoice.walletAddress,
    metadata: invoice.metadata as Record<string, unknown> | null,
    dueDate: invoice.dueDate,
    createdAt: invoice.createdAt,
    updatedAt: invoice.updatedAt,
  };
}

/**
 * Transform multiple invoices to API responses
 */
function toInvoiceListResponse(invoices: Awaited<ReturnType<typeof prisma.invoice.findMany>>): InvoiceResponse[] {
  return invoices.map(toInvoiceResponse);
}

// ============================================
// Middleware
// ============================================

/**
 * Validate request body against schema
 */
export function validateBody<T extends z.ZodType>(schema: T) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = await schema.parseAsync(req.body);
      req.body = validated;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        logger.warn({ errors: error.errors }, 'Validation failed');
        next(new ValidationError(error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')));
      } else {
        next(error);
      }
    }
  };
}

/**
 * Validate request query against schema
 */
export function validateQuery<T extends z.ZodType>(schema: T) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = await schema.parseAsync(req.query);
      req.query = validated;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        logger.warn({ errors: error.errors }, 'Query validation failed');
        next(new ValidationError(error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')));
      } else {
        next(error);
      }
    }
  };
}

// ============================================
// Routes
// ============================================

/**
 * POST /v1/invoices
 * Create a new invoice
 */
router.post('/', validateBody(createInvoiceSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = req.body as CreateInvoiceInput;
    
    // Get chain info for display name
    const chainInfo = getChainBySlug(data.chain);
    
    // Generate sequential invoice number atomically
    const invoiceNumber = await prisma.$transaction(async (tx) => {
      const count = await tx.invoice.count({
        where: { merchantId: data.merchantId },
      });
      const prefix = `INV-${new Date().getFullYear()}-`;
      return `${prefix}${(count + 1).toString().padStart(6, '0')}`;
    });

    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber,
        merchantId: data.merchantId,
        customerId: data.customerId,
        amount: new Prisma.Decimal(data.amount),
        currency: data.currency,
        description: data.description,
        chain: data.chain,
        walletAddress: data.walletAddress,
        status: InvoiceStatus.PENDING,
        metadata: data.metadata,
      },
    });

    logger.info({ invoiceId: invoice.id, merchantId: invoice.merchantId }, 'Invoice created');

    res.status(201).json(toInvoiceResponse(invoice));
  } catch (error) {
    next(error);
  }
});

/**
 * GET /v1/invoices
 * List invoices with filtering and pagination
 */
router.get('/', validateQuery(listInvoicesQuerySchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = req.query as ListInvoicesQuery;
    
    const where: Prisma.InvoiceWhereInput = {};
    
    if (query.merchantId) {
      where.merchantId = query.merchantId;
    }
    
    if (query.customerId) {
      where.customerId = query.customerId;
    }
    
    if (query.status) {
      where.status = query.status;
    }
    
    if (query.chain) {
      where.chain = query.chain;
    }

    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: {
          [query.sortBy]: query.sortOrder,
        },
      }),
      prisma.invoice.count({ where }),
    ]);

    const pagination = createPaginationResponse({
      page: query.page,
      limit: query.limit,
      total,
    });

    logger.debug({ query, count: invoices.length }, 'Invoices listed');

    res.json({
      data: toInvoiceListResponse(invoices),
      pagination,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /v1/invoices/:id
 * Get a single invoice by ID
 */
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const invoice = await prisma.invoice.findUnique({
      where: { id },
    });

    if (!invoice) {
      throw new InvoiceNotFoundError(`Invoice with ID ${id} not found`);
    }

    res.json(toInvoiceResponse(invoice));
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /v1/invoices/:id
 * Update an existing invoice
 */
router.patch('/:id', validateBody(updateInvoiceSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const data = req.body as UpdateInvoiceInput;

    // Check if invoice exists
    const existing = await prisma.invoice.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new InvoiceNotFoundError(`Invoice with ID ${id} not found`);
    }

    // Validate status transition
    if (data.status) {
      const validTransitions: Record<InvoiceStatus, InvoiceStatus[]> = {
        [InvoiceStatus.PENDING]: [InvoiceStatus.PROCESSING, InvoiceStatus.SETTLED],
        [InvoiceStatus.SETTLED]: [InvoiceStatus.PROCESSING],
        [InvoiceStatus.PROCESSING]: [InvoiceStatus.COMPLETED, InvoiceStatus.FAILED],
        [InvoiceStatus.COMPLETED]: [],
        [InvoiceStatus.FAILED]: [InvoiceStatus.PENDING],
      };

      if (!validTransitions[existing.status].includes(data.status)) {
        throw new ValidationError(`Invalid status transition from ${existing.status} to ${data.status}`);
      }
    }

    const invoice = await prisma.invoice.update({
      where: { id },
      data: {
        ...data,
        ...(data.status === InvoiceStatus.SETTLED && { settledAt: new Date() }),
        ...(data.status === InvoiceStatus.COMPLETED && { completedAt: new Date() }),
      },
    });

    logger.info({ invoiceId: invoice.id, status: invoice.status }, 'Invoice updated');

    res.json(toInvoiceResponse(invoice));
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /v1/invoices/:id
 * Delete (cancel) an invoice
 */
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const existing = await prisma.invoice.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new InvoiceNotFoundError(`Invoice with ID ${id} not found`);
    }

    // Only allow deletion of pending invoices
    if (existing.status !== InvoiceStatus.PENDING) {
      throw new ValidationError('Only pending invoices can be deleted');
    }

    await prisma.invoice.delete({
      where: { id },
    });

    logger.info({ invoiceId: id }, 'Invoice deleted');

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
