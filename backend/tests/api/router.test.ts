import { Router } from 'express';
import router from '../../../src/api/router';

describe('API Router', () => {
  it('mounts health check route', () => {
    const healthRoute = router.stack.find((layer) => layer.route?.path === '/health');
    expect(healthRoute).toBeDefined();
    expect(healthRoute.route?.methods.get).toBe(true);
  });

  it('mounts settlements route with invoiceId param', () => {
    const settlementRoute = router.stack.find((layer) => layer.route?.path === '/v1/settlements/:invoiceId');
    expect(settlementRoute).toBeDefined();
    expect(settlementRoute.route?.methods.get).toBe(true);
  });

  it('has exactly 2 routes defined', () => {
    const routes = router.stack.filter((layer) => layer.route);
    expect(routes).toHaveLength(2);
  });
});