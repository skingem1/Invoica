import { Router } from 'express';
import { getInvoiceById } from './invoices-get';
import { createInvoice } from './invoices-create';
import { registerWebhook } from './webhooks-register';

const router = Router();

// Existing routes
router.get('/health', (req, res) => res.json({ status: 'ok' }));

// New invoice routes
router.get('/v1/invoices/:id', getInvoiceById);
router.post('/v1/invoices', createInvoice);
router.post('/v1/webhooks', registerWebhook);

export default router;