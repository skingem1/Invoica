import { Router } from 'express';

describe('Gas Backstop Routes', () => {
  let routeModule: { default: ReturnType<typeof Router> };
  let routes: Array<{ path: string; methods: string[] }>;

  beforeAll(() => {
    routeModule = require('../gas-backstop');
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

  it('has GET /v1/gas/status route', () => {
    const route = routes.find(
      (r) => r.path === '/v1/gas/status' && r.methods.includes('get')
    );
    expect(route).toBeDefined();
  });
});
