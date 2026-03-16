import { Request, Response } from 'express';

const mockFindById = jest.fn();

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('../../services/webhook/types', () => ({
  WebhookRepository: jest.fn().mockImplementation(() => ({
    findById: mockFindById,
  })),
}));

import { getWebhook } from '../webhooks-get';

function makeRes(): { status: jest.Mock; json: jest.Mock } {
  const res: { status: jest.Mock; json: jest.Mock } = {
    status: jest.fn(),
    json: jest.fn(),
  };
  res.status.mockReturnValue(res);
  return res;
}

describe('getWebhook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 400 when id param is missing', async () => {
    const req = { params: { id: '' } } as unknown as Request;
    const res = makeRes();
    await getWebhook(req, res as unknown as Response);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid id' });
  });

  it('returns 404 when webhook registration is not found', async () => {
    mockFindById.mockResolvedValueOnce(null);
    const req = { params: { id: 'nonexistent-id' } } as unknown as Request;
    const res = makeRes();
    await getWebhook(req, res as unknown as Response);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Webhook registration not found' });
  });

  it('returns 200 with registration when found', async () => {
    const registration = { id: 'wh-123', url: 'https://example.com/hook', events: ['invoice.settled'] };
    mockFindById.mockResolvedValueOnce(registration);
    const req = { params: { id: 'wh-123' } } as unknown as Request;
    const res = makeRes();
    await getWebhook(req, res as unknown as Response);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(registration);
  });

  it('calls findById with the correct id', async () => {
    mockFindById.mockResolvedValueOnce({ id: 'wh-456' });
    const req = { params: { id: 'wh-456' } } as unknown as Request;
    const res = makeRes();
    await getWebhook(req, res as unknown as Response);
    expect(mockFindById).toHaveBeenCalledWith('wh-456');
  });
});
