import { Router } from 'express';
import request from 'supertest';
import router from '../../src/api/router';

// Mock handlers
const mockGetInvoiceById = jest.fn((req, res) => res.json({ id: req.params.id }));
const mockCreateInvoice = jest.fn((req, res) => res.json({ id: '123' }));
const mockRegisterWebhook = jest.fn((req, res) => res.json({ registered: true }));

jest.mock('../../src/api/invoices-get', () => ({
  getInvoiceById: (req: any, res: any) => mockGetInvoiceById(req, res),
}));

jest.mock('../../src/api/invoices-create', () => ({
  createInvoice: (req: any, res: any) => mockCreateInvoice(req, res),
}));

jest.mock('../../src/api/webhooks-register', () => ({
  registerWebhook: (req: any, res: any) => mockRegisterWebhook(req, res),
}));

describe('API Router', () => {
  const app = request(router);

  beforeEach(() => jest.clearAllMocks());

  it('GET /health returns ok status', async () => {
    const res = await app.get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('GET /v1/invoices/:id delegates to getInvoiceById', async () => {
    const res = await app.get('/v1/invoices/abc123');
    expect(mockGetInvoiceById).toHaveBeenCalled();
    expect(res.body).toEqual({ id: 'abc123' });
  });

  it('POST /v1/invoices delegates to createInvoice', async () => {
    const res = await app.post('/v1/invoices').send({ amount: 100 });
    expect(mockCreateInvoice).toHaveBeenCalled();
    expect(res.body).toEqual({ id: '123' });
  });

  it('POST /v1/webhooks delegates to registerWebhook', async () => {
    const res = await app.post('/v1/webhooks').send({ url: 'https://example.com' });
    expect(mockRegisterWebhook).toHaveBeenCalled();
    expect(res.body).toEqual({ registered: true });
  });
});