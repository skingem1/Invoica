import { getDashboardStats } from '../dashboard-stats';
import { Request, Response } from 'express';

function makeRes(): Partial<Response> & { json: jest.Mock } {
  const res = {
    json: jest.fn(),
  };
  return res as Partial<Response> & { json: jest.Mock };
}

describe('getDashboardStats', () => {
  it('returns a JSON object', async () => {
    const req = {} as Request;
    const res = makeRes();
    await getDashboardStats(req, res as Response);
    expect(res.json).toHaveBeenCalledTimes(1);
  });

  it('returns totalInvoices field', async () => {
    const req = {} as Request;
    const res = makeRes();
    await getDashboardStats(req, res as Response);
    const data = res.json.mock.calls[0][0];
    expect(typeof data.totalInvoices).toBe('number');
  });

  it('returns pending field', async () => {
    const req = {} as Request;
    const res = makeRes();
    await getDashboardStats(req, res as Response);
    const data = res.json.mock.calls[0][0];
    expect(typeof data.pending).toBe('number');
  });

  it('returns settled field', async () => {
    const req = {} as Request;
    const res = makeRes();
    await getDashboardStats(req, res as Response);
    const data = res.json.mock.calls[0][0];
    expect(typeof data.settled).toBe('number');
  });

  it('returns revenue field as number', async () => {
    const req = {} as Request;
    const res = makeRes();
    await getDashboardStats(req, res as Response);
    const data = res.json.mock.calls[0][0];
    expect(typeof data.revenue).toBe('number');
  });

  it('returns failedSettlements field', async () => {
    const req = {} as Request;
    const res = makeRes();
    await getDashboardStats(req, res as Response);
    const data = res.json.mock.calls[0][0];
    expect(typeof data.failedSettlements).toBe('number');
  });

  it('returns all 5 expected fields in one call', async () => {
    const req = {} as Request;
    const res = makeRes();
    await getDashboardStats(req, res as Response);
    const data = res.json.mock.calls[0][0];
    expect(data).toMatchObject({
      totalInvoices: 156,
      pending: 23,
      settled: 128,
      revenue: 45250.00,
      failedSettlements: 5,
    });
  });
});
