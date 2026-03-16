import { Router } from 'express';

describe('Reputation Routes', () => {
  let routeModule: { default: ReturnType<typeof Router> };
  let routes: Array<{ path: string; methods: string[] }>;

  beforeAll(() => {
    routeModule = require('../reputation');
    const router = routeModule.default;
    routes = router.stack
      .filter((layer: { route?: unknown }) => layer.route)
      .map((layer: { route: { path: string; methods: Record<string, boolean> } }) => ({
        path: layer.route.path,
        methods: Object.keys(layer.route.methods),
      }));
  });

  it('exports an Express Router', () => {
    expect(routeModule.default).toBeDefined();
    expect(routeModule.default).toBeInstanceOf(Function);
    expect(Array.isArray(routeModule.default.stack)).toBe(true);
  });

  it('has GET /x402/oracle/score/:agentId route', () => {
    const route = routes.find(
      (r) => r.path === '/x402/oracle/score/:agentId' && r.methods.includes('get')
    );
    expect(route).toBeDefined();
  });

  it('has GET /x402/oracle/scores leaderboard route', () => {
    const route = routes.find(
      (r) => r.path === '/x402/oracle/scores' && r.methods.includes('get')
    );
    expect(route).toBeDefined();
  });

  it('has exactly 2 routes registered', () => {
    expect(routes).toHaveLength(2);
  });
});
