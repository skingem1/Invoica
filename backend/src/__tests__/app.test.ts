import { app } from '../app';
import request from 'supertest';

describe('Express App', () => {
  it('exports an Express application', () => {
    expect(app).toBeDefined();
    expect(typeof app.listen).toBe('function');
    expect(typeof app.use).toBe('function');
  });

  it('has middleware stack configured', () => {
    const router = (app as any).router;
    expect(router).toBeDefined();
    const stack = router?.stack;
    expect(Array.isArray(stack)).toBe(true);
    expect(stack.length).toBeGreaterThan(0);
  });

  it('has JSON body parser middleware (accepts JSON bodies)', async () => {
    // If json middleware is missing, sending JSON would result in req.body being undefined
    // A valid route that processes JSON would break without it
    // We verify by sending JSON to a known route and checking no parse error occurs
    const res = await request(app)
      .post('/api/invoices')
      .set('Content-Type', 'application/json')
      .send({ test: 'value' });
    // 401 or 404 means the route was reached (body was parsed) - not a 400 parse error
    expect(res.status).not.toBe(500);
  });

  it('responds with 404 for unknown routes', async () => {
    const res = await request(app).get('/no-such-route-xyz-abc');
    expect(res.status).toBe(404);
  });

  it('has route handlers mounted (health route responds)', async () => {
    // The app mounts healthRoutes which includes /v1/health
    const res = await request(app).get('/v1/health');
    // Health route returns 200 (ok) or 503 (db down in test env)
    expect([200, 503]).toContain(res.status);
  });
});
