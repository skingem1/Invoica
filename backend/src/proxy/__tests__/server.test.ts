import http from 'http';

// Mocks declared before imports
jest.mock('../middleware', () => ({
  createInvoiceProxyMiddleware: jest.fn().mockReturnValue(
    (_req: unknown, _res: unknown, next: () => void) => next()
  ),
  createInvoiceRouteHandler: jest.fn().mockReturnValue(
    (_req: unknown, _res: unknown, next: () => void) => next()
  ),
}));
jest.mock('../headers', () => ({
  hasInvoiceHeaders: jest.fn().mockReturnValue(false),
}));
jest.mock('../../utils/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), debug: jest.fn(), warn: jest.fn() },
}));
jest.mock('../../queue/invoice.queue', () => ({
  invoiceQueue: {
    getWaitingCount: jest.fn().mockResolvedValue(2),
    getActiveCount: jest.fn().mockResolvedValue(1),
    getCompletedCount: jest.fn().mockResolvedValue(10),
    getFailedCount: jest.fn().mockResolvedValue(0),
    isPaused: jest.fn().mockReturnValue(false),
    close: jest.fn().mockResolvedValue(undefined),
  },
}));

import { createApp } from '../server';
import { invoiceQueue } from '../../queue/invoice.queue';

// HTTP helper — make a GET request against a local server
function get(
  server: http.Server,
  path: string,
  headers: Record<string, string> = {}
): Promise<{ status: number; body: any; headers: http.IncomingHttpHeaders }> {
  return new Promise((resolve, reject) => {
    const addr = server.address() as { port: number };
    const req = http.request(
      { hostname: 'localhost', port: addr.port, path, method: 'GET', headers },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode!, body: JSON.parse(data), headers: res.headers });
          } catch {
            resolve({ status: res.statusCode!, body: data, headers: res.headers });
          }
        });
      }
    );
    req.on('error', reject);
    req.end();
  });
}

describe('createApp — health endpoint', () => {
  let server: http.Server;
  beforeAll((done) => {
    server = http.createServer(createApp({ merchantUrl: 'http://merchant.example' }));
    server.listen(0, done);
  });
  afterAll((done) => {
    server.close(done);
  });

  it('GET /health returns 200 with status ok and service name', async () => {
    const { status, body } = await get(server, '/health');
    expect(status).toBe(200);
    expect(body.status).toBe('ok');
    expect(body.service).toBe('invoice-proxy');
    expect(typeof body.timestamp).toBe('string');
  });

  it('GET /custom-health returns 200 when healthCheckPath is configured', async () => {
    const customServer = http.createServer(
      createApp({ merchantUrl: 'http://m.example', healthCheckPath: '/custom-health' })
    );
    await new Promise<void>((done) => customServer.listen(0, done));
    const { status, body } = await get(customServer, '/custom-health');
    await new Promise<void>((done) => customServer.close(done));
    expect(status).toBe(200);
    expect(body.status).toBe('ok');
  });
});

describe('createApp — queue status endpoint', () => {
  let server: http.Server;
  beforeAll((done) => {
    server = http.createServer(createApp({ merchantUrl: 'http://merchant.example' }));
    server.listen(0, done);
  });
  afterAll((done) => {
    server.close(done);
  });

  it('GET /queue/status returns 200 with waiting/active/completed/failed/paused', async () => {
    const { status, body } = await get(server, '/queue/status');
    expect(status).toBe(200);
    expect(body.waiting).toBe(2);
    expect(body.active).toBe(1);
    expect(body.completed).toBe(10);
    expect(body.failed).toBe(0);
    expect(body.paused).toBe(false);
  });

  it('GET /queue/status returns 500 when queue throws', async () => {
    (invoiceQueue.getWaitingCount as jest.Mock).mockRejectedValueOnce(new Error('Redis down'));
    const { status, body } = await get(server, '/queue/status');
    expect(status).toBe(500);
    expect(body.error).toBe('Failed to get queue status');
  });
});

describe('createApp — 404 fallback', () => {
  let server: http.Server;
  beforeAll((done) => {
    server = http.createServer(createApp({ merchantUrl: 'http://merchant.example' }));
    server.listen(0, done);
  });
  afterAll((done) => {
    server.close(done);
  });

  it('GET /nonexistent returns 404 with error, message, supportedRoutes', async () => {
    const { status, body } = await get(server, '/nonexistent');
    expect(status).toBe(404);
    expect(body.error).toBe('Not Found');
    expect(Array.isArray(body.supportedRoutes)).toBe(true);
    expect(body.supportedRoutes.length).toBeGreaterThan(0);
  });

  it('404 message includes the method and path', async () => {
    const { body } = await get(server, '/no/such/route');
    expect(body.message).toContain('GET');
    expect(body.message).toContain('/no/such/route');
  });
});
