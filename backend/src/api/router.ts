import { Router, Request, Response, NextFunction } from 'express';
import asyncHandler from '../middleware/async-handler';
import { getHealth } from './health';
import { getSettlements, getSettlementById, createSettlement } from './settlements';
import { 
  getInvoices, 
  getInvoiceById, 
  createInvoice, 
  updateInvoice,
  deleteInvoice 
} from './invoices';
import { getMerchants, getMerchantById, createMerchant, updateMerchant } from './merchants';
import { getPayments, getPaymentById, createPayment } from './payments';
import { getDashboardStats } from './dashboard-stats';
import { getDashboardActivity } from './dashboard-activity';
import { getInvoicesWithSettlements } from './invoices-settlements';

const router = Router();

// Health check
router.get('/health', asyncHandler(getHealth));

// Settlements
router.get('/v1/settlements', asyncHandler(getSettlements));
router.get('/v1/settlements/:id', asyncHandler(getSettlementById));
router.post('/v1/settlements', asyncHandler(createSettlement));

// Invoices
router.get('/v1/invoices', asyncHandler(getInvoices));
router.get('/v1/invoices/:id', asyncHandler(getInvoiceById));
router.post('/v1/invoices', asyncHandler(createInvoice));
router.put('/v1/invoices/:id', asyncHandler(updateInvoice));
router.delete('/v1/invoices/:id', asyncHandler(deleteInvoice));

// Merchants
router.get('/v1/merchants', asyncHandler(getMerchants));
router.get('/v1/merchants/:id', asyncHandler(getMerchantById));
router.post('/v1/merchants', asyncHandler(createMerchant));
router.put('/v1/merchants/:id', asyncHandler(updateMerchant));

// Payments
router.get('/v1/payments', asyncHandler(getPayments));
router.get('/v1/payments/:id', asyncHandler(getPaymentById));
router.post('/v1/payments', asyncHandler(createPayment));

// Dashboard
router.get('/v1/dashboard/stats', asyncHandler(getDashboardStats));
router.get('/v1/dashboard/activity', asyncHandler(getDashboardActivity));

// Invoices with Settlements
router.get('/v1/invoices-settlements', asyncHandler(getInvoicesWithSettlements));

// 404 handler
router.use((req: Request, res: Response, next: NextFunction) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.path} not found`
    }
  });
});

// Global error handler
router.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred'
    }
  });
});

export default router;