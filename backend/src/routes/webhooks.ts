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
router.get('/v1/webhooks', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit  = Math.min(parseInt((req.query.limit  as string) || '20', 10), 100);
    const offset = Math.max(parseInt((req.query.offset as string) || '0',  10), 0);
    const webhooks = await repo.listAll();
    const total = webhooks.length;
    const page = webhooks.slice(offset, offset + limit);
    res.json({ success: true, data: page, meta: { total, limit, offset } });
  } catch (err) { next(err); }
});

// GET /v1/webhooks/by-event/:eventType — webhooks subscribed to a specific event
// Must be registered before /:id to avoid param capture
router.get('/v1/webhooks/by-event/:eventType', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { eventType } = req.params;
    const webhooks = await repo.listAll();
    const filtered = webhooks.filter((wh: any) =>
      Array.isArray(wh.events) && wh.events.includes(eventType)
    );
    res.json({ success: true, data: filtered, meta: { total: filtered.length, eventType } });
  } catch (err) { next(err); }
});

// GET /v1/webhooks/stats — webhook subscription statistics
// Must be registered before /:id to avoid param capture
router.get('/v1/webhooks/stats', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const webhooks = await repo.listAll();
    const byEvent: Record<string, number> = {};
    for (const wh of webhooks) {
      const events: string[] = Array.isArray((wh as any).events) ? (wh as any).events : [];
      for (const event of events) {
        byEvent[event] = (byEvent[event] || 0) + 1;
      }
    }
    res.json({ success: true, data: { total: webhooks.length, byEvent } });
  } catch (err) { next(err); }
});

// GET /v1/webhooks/events — list available webhook event types (no DB call)
// Must be registered before /:id to avoid param capture
const WEBHOOK_EVENT_TYPES = [
  'invoice.created',
  'invoice.settled',
  'invoice.completed',
  'settlement.confirmed',
  'agent.reputation_changed',
];
router.get('/v1/webhooks/events', (_req: Request, res: Response) => {
  res.json({ success: true, data: WEBHOOK_EVENT_TYPES });
});

// GET /v1/webhooks/:id — get a single webhook registration by ID
router.get('/v1/webhooks/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const webhook = await repo.findById(id);
    if (!webhook) {
      res.status(404).json({ success: false, error: { message: 'Webhook not found', code: 'NOT_FOUND' } });
      return;
    }
    res.json({ success: true, data: webhook });
  } catch (err) { next(err); }
});

// PUT /v1/webhooks/:id — update webhook URL or events
router.put('/v1/webhooks/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const { url, events } = req.body || {};

    if (!url && !events) {
      res.status(400).json({ success: false, error: { message: 'At least one of url or events must be provided', code: 'NO_FIELDS' } });
      return;
    }

    const existing = await repo.findById(id);
    if (!existing) {
      res.status(404).json({ success: false, error: { message: 'Webhook not found', code: 'NOT_FOUND' } });
      return;
    }

    const fields: { url?: string; events?: string[] } = {};
    if (url) fields.url = url;
    if (events) fields.events = events;

    const updated = await repo.update(id, fields);
    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
});

// DELETE /v1/webhooks/bulk — delete multiple webhook registrations by IDs
// Must be registered before /:id to avoid param capture
router.delete('/v1/webhooks/bulk', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { ids } = req.body || {};
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      res.status(400).json({ success: false, error: { message: 'ids array is required', code: 'MISSING_IDS' } });
      return;
    }
    if (ids.length > 20) {
      res.status(400).json({ success: false, error: { message: 'Cannot delete more than 20 webhooks at once', code: 'TOO_MANY_IDS' } });
      return;
    }
    const deleted: string[] = [];
    for (const id of ids) {
      const existing = await repo.findById(String(id));
      if (existing) {
        await repo.delete(String(id));
        deleted.push(String(id));
      }
    }
    res.json({ success: true, data: { deleted: deleted.length, ids: deleted } });
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
