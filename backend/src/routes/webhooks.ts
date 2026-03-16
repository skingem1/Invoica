import { Router, Request, Response, NextFunction } from 'express';
import { WebhookRepository } from '../services/webhook/types';
import { prisma } from '../lib/prisma';

const router = Router();
const repo = new WebhookRepository(prisma);

// POST /v1/webhooks — register a new webhook endpoint
router.post('/v1/webhooks', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { url, events, secret } = req.body;
    if (!url || typeof url !== 'string' || !events || !Array.isArray(events) || events.length === 0) {
      res.status(400).json({ success: false, error: { message: 'url and events[] are required', code: 'VALIDATION_ERROR' } });
      return;
    }
    if (!secret || typeof secret !== 'string' || secret.length < 16) {
      res.status(400).json({ success: false, error: { message: 'secret must be at least 16 characters', code: 'VALIDATION_ERROR' } });
      return;
    }
    const registration = await repo.register(url, events, secret);
    res.status(201).json({ success: true, data: registration });
  } catch (err) { next(err); }
});

// GET /v1/webhooks — list all registered webhooks
router.get('/v1/webhooks', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const webhooks = await repo.listAll();
    res.json({ success: true, data: webhooks, meta: { total: webhooks.length } });
  } catch (err) { next(err); }
});

// DELETE /v1/webhooks/:id — permanently delete a webhook
router.delete('/v1/webhooks/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const existing = await repo.findById(id);
    if (!existing) {
      res.status(404).json({ success: false, error: { message: 'Webhook not found', code: 'NOT_FOUND' } });
      return;
    }
    await repo.delete(id);
    res.json({ success: true, data: { id, deleted: true } });
  } catch (err) { next(err); }
});

// POST /v1/webhooks/:id/test — send a test ping to the webhook endpoint
router.post('/v1/webhooks/:id/test', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const webhook = await repo.findById(id);
    if (!webhook) {
      res.status(404).json({ success: false, error: { message: 'Webhook not found', code: 'NOT_FOUND' } });
      return;
    }

    const start = Date.now();
    let status: 'delivered' | 'failed' = 'failed';
    let responseCode: number | null = null;

    try {
      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'test.ping', timestamp: new Date().toISOString(), webhookId: id }),
        signal: AbortSignal.timeout(5000),
      });
      responseCode = response.status;
      if (response.status < 500) status = 'delivered';
    } catch { /* status stays failed */ }

    res.json({ success: true, data: { status, responseCode, latencyMs: Date.now() - start } });
  } catch (err) { next(err); }
});

export default router;
