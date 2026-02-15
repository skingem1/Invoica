import { Router } from 'express';
import { checkHealth } from './health';
import { getSettlement } from './settlements';
import { getInvoiceById } from './invoices-get';
import { createInvoice } from './invoices-create';
import { listInvoices } from './invoices-list';
import { registerWebhook } from './webhooks-register';
import { getWebhook } from './webhooks-get';

const router = Router();

router.get('/health', checkHealth);
router.get('/v1/settlements/:invoiceId', getSettlement);
router.get('/v1/invoices/:id', getInvoiceById);
router.get('/v1/invoices', listInvoices);
router.post('/v1/invoices', createInvoice);
router.post('/v1/webhooks', registerWebhook);
router.get('/v1/webhooks/:id', getWebhook);

export { router };
export default router;