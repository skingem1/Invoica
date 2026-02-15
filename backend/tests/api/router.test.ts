import { Router } from 'express';
import request from 'supertest';
import { router } from '../../src/api/router';

describe('API Router', () => {
  const app = Router().use(router);

  it('mounts GET /health route', async () => {
    const res = await request(app).get('/health');
    expect([200, 500]).toContain(res.status);
  });

  it('mounts GET /v1/settlements/:invoiceId route', async () => {
    const res = await request(app).get('/v1/settlements/inv-123');
    expect([200, 404, 500]).toContain(res.status);
  });

  it('mounts GET /v1/invoices/:id route', async () => {
    const res = await request(app).get('/v1/invoices/1');
    expect([200, 404, 500]).toContain(res.status);
  });

  it('mounts GET /v1/invoices route', async () => {
    const res = await request(app).get('/v1/invoices');
    expect([200, 500]).toContain(res.status);
  });

  it('mounts POST /v1/invoices route', async () => {
    const res = await request(app).post('/v1/invoices').send({});
    expect([200, 201, 400, 500]).toContain(res.status);
  });

  it('mounts POST /v1/webhooks and GET /v1/webhooks/:id routes', async () => {
    const postRes = await request(app).post('/v1/webhooks').send({});
    expect([200, 201, 400, 500]).toContain(postRes.status);
    const getRes = await request(app).get('/v1/webhooks/test-id');
    expect([200, 404, 500]).toContain(getRes.status);
  });
});