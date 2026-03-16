import { Router } from 'express';

describe('Ledger Routes', () => {
  let routeModule: { default: ReturnType<typeof Router> };
  let routes: Array<{ path: string; methods: string[] }>;

  beforeAll(() => {
    routeModule = require('../ledger');
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

  it('has POST /v1/ledger/send-verification route', () => {
    const route = routes.find(
      (r) => r.path === '/v1/ledger/send-verification' && r.methods.includes('post')
    );
    expect(route).toBeDefined();
  });

  it('has POST /v1/ledger/confirm-verification route', () => {
    const route = routes.find(
      (r) => r.path === '/v1/ledger/confirm-verification' && r.methods.includes('post')
    );
    expect(route).toBeDefined();
  });

  it('has GET /v1/ledger route', () => {
    const route = routes.find(
      (r) => r.path === '/v1/ledger' && r.methods.includes('get')
    );
    expect(route).toBeDefined();
  });

  it('has GET /v1/ledger/summary route', () => {
    const route = routes.find(
      (r) => r.path === '/v1/ledger/summary' && r.methods.includes('get')
    );
    expect(route).toBeDefined();
  });

  it('has GET /v1/ledger/export.csv route', () => {
    const route = routes.find(
      (r) => r.path === '/v1/ledger/export.csv' && r.methods.includes('get')
    );
    expect(route).toBeDefined();
  });
});
