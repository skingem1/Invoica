import { Router, Request, Response, NextFunction } from 'express';
import { createApiKey, getCustomerApiKeys, invalidateApiKey, rotateApiKey, validateApiKeyInput } from '../services/api-keys';

const router = Router();

router.post('/v1/api-keys', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = validateApiKeyInput(req.body);
    const apiKey = await createApiKey(input);
    res.status(201).json({ success: true, data: apiKey });
  } catch (err) { next(err); }
});

router.get('/v1/api-keys', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const customerId = req.headers['x-customer-id'] as string;
    if (!customerId) {
      res.status(400).json({ success: false, error: { message: 'Missing x-customer-id header', code: 'MISSING_HEADER' } });
      return;
    }
    const keys = await getCustomerApiKeys(customerId);
    res.json({ success: true, data: keys });
  } catch (err) { next(err); }
});

router.post('/v1/api-keys/:id/revoke', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const key = await invalidateApiKey(req.params.id);
    res.json({ success: true, data: key });
  } catch (err) { next(err); }
});

router.post('/v1/api-keys/:id/rotate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const newKey = await rotateApiKey(req.params.id);
    res.json({ success: true, data: newKey });
  } catch (err) { next(err); }
});

export default router;