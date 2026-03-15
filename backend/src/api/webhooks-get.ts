import { Request, Response } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { WebhookRepository } from '../services/webhook/types';

const repo = new WebhookRepository(new PrismaClient());

const idSchema = z.string().min(1);

export async function getWebhook(req: Request, res: Response): Promise<void> {
  const parsed = idSchema.safeParse(req.params.id);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid id' });
    return;
  }

  const registration = await repo.findById(parsed.data);
  if (!registration) {
    res.status(404).json({ error: 'Webhook registration not found' });
    return;
  }

  res.status(200).json(registration);
}