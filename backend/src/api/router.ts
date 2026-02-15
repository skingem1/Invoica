import { Router } from 'express';
import { checkHealth } from './health';
import { getSettlement } from './settlements';

export const router = Router();

router.get('/health', checkHealth);
router.get('/v1/settlements/:invoiceId', getSettlement);

export default router;