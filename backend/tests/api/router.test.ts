import { Router } from 'express';
import request from 'supertest';

const mockStats = jest.fn((req, res) => res.status(200).json({ total: 0 }));
const mockActivity = jest.fn((req, res) => res.status(200).json({ activities: [] }));

jest.mock('../../src/api/dashboard-stats', () => ({
  getDashboardStats: mockStats,
}));

jest.mock('../../src/api/recent-activity', () => ({
  getRecentActivity: mockActivity,
}));

jest.mock('../../src/api/health', () => ({ health: (req: any, res: any) => res.status(200).json({ status: 'ok' }) }));
jest.mock('../../src/api/invoices', () => ({
  listInvoices: (req: any, res: any) => res.status(200).json([]),
  getInvoice: (req: any, res: any) => res.status(200).json({}),
  createInvoice: (req: any, res: any) => res.status(201).json({}),
}));
jest.mock('../../src/api/settlements', () => ({ settlements: (req: any, res: any) => res.status(200).json([]) }));
jest.mock('../../src/api/webhooks', () => ({
  registerWebhook: (req: any, res: any) => res.status(201).json({}),
  getWebhooks: (req: any, res: any) => res.status(200).json([]),
}));

import router from '../../src/api/router';

describe('API Router', () => {
  const app = Router().use(router);

  it('registers dashboard/stats route', async () => {
    const res = await request(app).get('/v1/dashboard/stats');
    expect(mockStats).toHaveBeenCalled();
    expect(res.status).toBe(200);
  });

  it('registers dashboard/activity route', async () => {
    const res = await request(app).get('/v1/dashboard/activity');
    expect(mockActivity).toHaveBeenCalled();
    expect(res.status).toBe(200);
  });

  it('preserves existing health route', async () => {
    const res = await request(app).get('/v1/health');
    expect(res.status).toBe(200);
  });

  it('preserves existing invoices routes', async () => {
    const res = await request(app).get('/v1/invoices');
    expect(res.status).toBe(200);
  });

  it('preserves existing settlements route', async () => {
    const res = await request(app).get('/v1/settlements');
    expect(res.status).toBe(200);
  });
});