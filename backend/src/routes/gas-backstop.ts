import { Router, Request, Response } from 'express';
import { gasManager } from '../services/gas-backstop/gas-manager';

const router = Router();

router.get('/v1/gas/status', async (req: Request, res: Response) => {
  const { wallet, chain = 'base' } = req.query;
  if (!wallet || typeof wallet !== 'string') {
    res.status(400).json({ error: 'wallet query param is required' });
    return;
  }
  if (!/^0x[0-9a-fA-F]{40}$/.test(wallet)) {
    res.status(400).json({ error: 'wallet must be a valid 0x EVM address (42 hex chars)' });
    return;
  }
  try {
    const status = await gasManager.checkBalance(wallet, String(chain));
    res.json(status);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const statusCode = message.includes('Unsupported') || message.includes('non-EVM') ? 400 : 503;
    res.status(statusCode).json({ error: message });
  }
});

export default router;