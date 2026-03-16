import { registerSchema, WebhookRepository } from '../types';

// ── registerSchema ────────────────────────────────────────────────────────────

describe('registerSchema', () => {
  it('accepts valid url, events array, and secret', () => {
    const result = registerSchema.safeParse({
      url: 'https://example.com/webhook',
      events: ['invoice.created'],
      secret: 'a'.repeat(16),
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid URL', () => {
    const result = registerSchema.safeParse({
      url: 'not-a-url',
      events: ['invoice.created'],
      secret: 'a'.repeat(16),
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty events array', () => {
    const result = registerSchema.safeParse({
      url: 'https://example.com/webhook',
      events: [],
      secret: 'a'.repeat(16),
    });
    expect(result.success).toBe(false);
  });

  it('rejects secret shorter than 16 characters', () => {
    const result = registerSchema.safeParse({
      url: 'https://example.com/webhook',
      events: ['invoice.paid'],
      secret: 'tooshort',
    });
    expect(result.success).toBe(false);
  });

  it('rejects secret longer than 256 characters', () => {
    const result = registerSchema.safeParse({
      url: 'https://example.com/webhook',
      events: ['invoice.paid'],
      secret: 'a'.repeat(257),
    });
    expect(result.success).toBe(false);
  });
});

// ── WebhookRepository ─────────────────────────────────────────────────────────

function makePrisma() {
  return {
    webhookRegistration: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  } as any;
}

const FAKE_WEBHOOK = {
  id: 'wh-001',
  url: 'https://example.com/webhook',
  events: ['invoice.created'],
  secret: 'a'.repeat(16),
  isActive: true,
  createdAt: new Date('2026-01-01T00:00:00Z'),
};

describe('WebhookRepository', () => {
  it('register() calls prisma.webhookRegistration.create with parsed data', async () => {
    const prisma = makePrisma();
    prisma.webhookRegistration.create.mockResolvedValueOnce(FAKE_WEBHOOK);
    const repo = new WebhookRepository(prisma);
    const result = await repo.register('https://example.com/webhook', ['invoice.created'], 'a'.repeat(16));
    expect(prisma.webhookRegistration.create).toHaveBeenCalledWith({
      data: { url: 'https://example.com/webhook', events: ['invoice.created'], secret: 'a'.repeat(16) },
    });
    expect(result).toBe(FAKE_WEBHOOK);
  });

  it('findById() calls prisma.webhookRegistration.findUnique with correct where clause', async () => {
    const prisma = makePrisma();
    prisma.webhookRegistration.findUnique.mockResolvedValueOnce(FAKE_WEBHOOK);
    const repo = new WebhookRepository(prisma);
    const result = await repo.findById('wh-001');
    expect(prisma.webhookRegistration.findUnique).toHaveBeenCalledWith({ where: { id: 'wh-001' } });
    expect(result).toBe(FAKE_WEBHOOK);
  });

  it('findActive() calls prisma.webhookRegistration.findMany with isActive: true', async () => {
    const prisma = makePrisma();
    prisma.webhookRegistration.findMany.mockResolvedValueOnce([FAKE_WEBHOOK]);
    const repo = new WebhookRepository(prisma);
    const result = await repo.findActive();
    expect(prisma.webhookRegistration.findMany).toHaveBeenCalledWith({ where: { isActive: true } });
    expect(result).toEqual([FAKE_WEBHOOK]);
  });

  it('deactivate() calls prisma.webhookRegistration.update setting isActive: false', async () => {
    const prisma = makePrisma();
    const deactivated = { ...FAKE_WEBHOOK, isActive: false };
    prisma.webhookRegistration.update.mockResolvedValueOnce(deactivated);
    const repo = new WebhookRepository(prisma);
    const result = await repo.deactivate('wh-001');
    expect(prisma.webhookRegistration.update).toHaveBeenCalledWith({
      where: { id: 'wh-001' },
      data: { isActive: false },
    });
    expect(result.isActive).toBe(false);
  });

  it('listAll() calls prisma.webhookRegistration.findMany ordered by createdAt desc', async () => {
    const prisma = makePrisma();
    prisma.webhookRegistration.findMany.mockResolvedValueOnce([FAKE_WEBHOOK]);
    const repo = new WebhookRepository(prisma);
    const result = await repo.listAll();
    expect(prisma.webhookRegistration.findMany).toHaveBeenCalledWith({ orderBy: { createdAt: 'desc' } });
    expect(result).toEqual([FAKE_WEBHOOK]);
  });

  it('delete() calls prisma.webhookRegistration.delete with correct where clause', async () => {
    const prisma = makePrisma();
    prisma.webhookRegistration.delete.mockResolvedValueOnce(undefined);
    const repo = new WebhookRepository(prisma);
    await repo.delete('wh-001');
    expect(prisma.webhookRegistration.delete).toHaveBeenCalledWith({ where: { id: 'wh-001' } });
  });
});
