import { Request, Response } from 'express';
import { registerWebhook } from '../webhooks-register';

jest.mock('../../services/webhook/types', () => {
  const mockRegister = jest.fn();
  const MockWebhookRepository = jest.fn().mockImplementation(() => ({
    register: mockRegister,
  }));
  return {
    WebhookRepository: MockWebhookRepository,
    registerSchema: jest.requireActual('../../services/webhook/types').registerSchema,
  };
});

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({})),
}));

describe('POST /webhooks registerWebhook', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockStatus: jest.Mock;
  let mockJson: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockStatus = jest.fn().mockReturnThis();
    mockJson = jest.fn().mockReturnThis();

    const { WebhookRepository } = require('../../services/webhook/types');
    const instance = new WebhookRepository();
    instance.register.mockResolvedValue({
      id: 'webhook-123',
      url: 'https://example.com/hook',
      events: ['invoice.created'],
      secret: 'test-secret-1234567890',
      createdAt: new Date(),
    });
    // Replace the instance used in the module
    WebhookRepository.mockImplementation(() => instance);
  });

  it('returns 201 for valid registration', async () => {
    mockReq = { body: { url: 'https://example.com/hook', events: ['invoice.created'], secret: 'test-secret-1234567890' } };
    mockRes = { status: mockStatus, json: mockJson };
    await registerWebhook(mockReq as Request, mockRes as Response);
    expect(mockStatus).toHaveBeenCalledWith(201);
  });

  it('returns JSON with created webhook data', async () => {
    mockReq = { body: { url: 'https://example.com/hook', events: ['invoice.created'], secret: 'test-secret-1234567890' } };
    mockRes = { status: mockStatus, json: mockJson };
    await registerWebhook(mockReq as Request, mockRes as Response);
    expect(mockJson).toHaveBeenCalledWith(expect.objectContaining({ id: 'webhook-123', url: 'https://example.com/hook' }));
  });

  it('returns 400 for invalid URL', async () => {
    mockReq = { body: { url: 'not-a-url', events: ['invoice.created'], secret: 'test-secret-1234567890' } };
    mockRes = { status: mockStatus, json: mockJson };
    await registerWebhook(mockReq as Request, mockRes as Response);
    expect(mockStatus).toHaveBeenCalledWith(400);
    expect(mockJson).toHaveBeenCalledWith(expect.objectContaining({ error: expect.any(Object) }));
  });

  it('returns 400 for missing events array', async () => {
    mockReq = { body: { url: 'https://example.com/hook', secret: 'test-secret-1234567890' } };
    mockRes = { status: mockStatus, json: mockJson };
    await registerWebhook(mockReq as Request, mockRes as Response);
    expect(mockStatus).toHaveBeenCalledWith(400);
  });

  it('returns 400 for secret shorter than 16 chars', async () => {
    mockReq = { body: { url: 'https://example.com/hook', events: ['invoice.created'], secret: 'short' } };
    mockRes = { status: mockStatus, json: mockJson };
    await registerWebhook(mockReq as Request, mockRes as Response);
    expect(mockStatus).toHaveBeenCalledWith(400);
  });
});
