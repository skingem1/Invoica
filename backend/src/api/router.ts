import { Router } from 'express';
import { health } from './health';
import { listInvoices, getInvoice, createInvoice } from './invoices';
import { settlements } from './settlements';
import { registerWebhook, getWebhooks } from './webhooks';
import { getDashboardStats } from './dashboard-stats';
import { getRecentActivity } from './recent-activity';

const router = Router();

router.get('/v1/dashboard/stats', getDashboardStats);
router.get('/v1/dashboard/activity', getRecentActivity);
router.get('/v1/health', health);
router.get('/v1/invoices', listInvoices);
router.get('/v1/invoices/:id', getInvoice);
router.post('/v1/invoices', createInvoice);
router.get('/v1/settlements', settlements);
router.post('/v1/webhooks', registerWebhook);
router.get('/v1/webhooks', getWebhooks);

export default router;