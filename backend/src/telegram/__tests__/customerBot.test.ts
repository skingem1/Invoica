import https from 'https';
import { EventEmitter } from 'events';

jest.mock('https');

// Helper: queue one https.request response (GET or POST)
function queueResponse(body: unknown) {
  const req: any = Object.assign(new EventEmitter(), {
    write: jest.fn(),
    end: jest.fn(),
  });
  (https.request as jest.Mock).mockImplementationOnce((_opts: any, cb: any) => {
    const res: any = Object.assign(new EventEmitter(), { statusCode: 200 });
    process.nextTick(() => {
      res.emit('data', JSON.stringify(body));
      res.emit('end');
    });
    cb(res);
    return req;
  });
  return req;
}

// Build a minimal Telegram update
function update(text: string, userId = 1, chatId = 100, firstName = 'Alice') {
  return {
    update_id: 1,
    message: { message_id: 1, from: { id: userId, first_name: firstName }, chat: { id: chatId, type: 'private' }, text, date: 1 },
  };
}

// Flush microtasks / nextTick queue several times
async function flush(n = 5) {
  for (let i = 0; i < n; i++) await new Promise((r) => process.nextTick(r));
}

beforeEach(() => {
  jest.clearAllMocks();
  // Stop the infinite setImmediate poll loop
  jest.spyOn(global, 'setImmediate').mockImplementation(() => ({}) as any);
});

afterEach(() => {
  jest.restoreAllMocks();
  delete process.env.TELEGRAM_BOT_TOKEN;
});

// ── No token ─────────────────────────────────────────────────────────────────

it('startCustomerBot skips when TELEGRAM_BOT_TOKEN is not set', async () => {
  delete process.env.TELEGRAM_BOT_TOKEN;
  const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  let startCustomerBot!: () => Promise<void>;
  jest.isolateModules(() => { ({ startCustomerBot } = require('../customerBot')); });
  await startCustomerBot();
  expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('not set'));
  expect(https.request).not.toHaveBeenCalled();
});

// ── Helpers for token-set tests ───────────────────────────────────────────────

function loadBot() {
  process.env.TELEGRAM_BOT_TOKEN = 'test-token';
  process.env.MINIMAX_API_KEY = 'mk-key';
  process.env.MINIMAX_GROUP_ID = 'grp-1';
  let startCustomerBot!: () => Promise<void>;
  jest.isolateModules(() => { ({ startCustomerBot } = require('../customerBot')); });
  return startCustomerBot;
}

function capturedPostBody(reqMock: any): any {
  const raw = reqMock.write.mock.calls[0]?.[0];
  return raw ? JSON.parse(raw) : null;
}

// ── Command: /start ───────────────────────────────────────────────────────────

it('/start sends welcome message with user first_name', async () => {
  const startCustomerBot = loadBot();
  queueResponse({ ok: true, result: [update('/start', 1, 100, 'Alice')] }); // GET getUpdates
  const sendReq = queueResponse({ ok: true }); // POST sendMessage
  await startCustomerBot();
  await flush();
  const body = capturedPostBody(sendReq);
  expect(body?.text).toContain('Alice');
  expect(body?.chat_id).toBe(100);
});

// ── Command: /pricing ─────────────────────────────────────────────────────────

it('/pricing sends pricing info with Markdown parse_mode', async () => {
  const startCustomerBot = loadBot();
  queueResponse({ ok: true, result: [update('/pricing')] });
  const sendReq = queueResponse({ ok: true });
  await startCustomerBot();
  await flush();
  const body = capturedPostBody(sendReq);
  expect(body?.parse_mode).toBe('Markdown');
  expect(body?.text).toContain('Free Plan');
  expect(body?.text).toContain('Pro');
});

// ── Command: /docs ────────────────────────────────────────────────────────────

it('/docs sends documentation URL', async () => {
  const startCustomerBot = loadBot();
  queueResponse({ ok: true, result: [update('/docs')] });
  const sendReq = queueResponse({ ok: true });
  await startCustomerBot();
  await flush();
  const body = capturedPostBody(sendReq);
  expect(body?.text).toContain('invoica.wp1.host');
});

// ── Command: /help ────────────────────────────────────────────────────────────

it('/help sends all 4 slash commands', async () => {
  const startCustomerBot = loadBot();
  queueResponse({ ok: true, result: [update('/help')] });
  const sendReq = queueResponse({ ok: true });
  await startCustomerBot();
  await flush();
  const body = capturedPostBody(sendReq);
  expect(body?.text).toContain('/start');
  expect(body?.text).toContain('/pricing');
  expect(body?.text).toContain('/docs');
  expect(body?.text).toContain('/help');
});

// ── Free text → MiniMax ───────────────────────────────────────────────────────

it('free-text calls MiniMax and forwards reply to user', async () => {
  const startCustomerBot = loadBot();
  queueResponse({ ok: true, result: [update('What is Invoica?')] }); // GET
  queueResponse({ ok: true }); // POST sendChatAction (typing)
  queueResponse({ choices: [{ message: { content: 'Invoica is an invoicing platform.' } }] }); // POST MiniMax
  const sendReq = queueResponse({ ok: true }); // POST sendMessage
  await startCustomerBot();
  await flush(10);
  const body = capturedPostBody(sendReq);
  expect(body?.text).toBe('Invoica is an invoicing platform.');
});

// ── MiniMax error fallback ────────────────────────────────────────────────────

it('returns fallback message when MiniMax response is empty', async () => {
  const startCustomerBot = loadBot();
  queueResponse({ ok: true, result: [update('hello')] }); // GET
  queueResponse({ ok: true }); // POST sendChatAction
  queueResponse({}); // POST MiniMax — empty/no choices → fallback
  const sendReq = queueResponse({ ok: true }); // POST sendMessage
  await startCustomerBot();
  await flush(10);
  const body = capturedPostBody(sendReq);
  expect(body?.text).toContain('Sorry');
});

// ── Empty updates list ────────────────────────────────────────────────────────

it('does not send any message when update list is empty', async () => {
  const startCustomerBot = loadBot();
  queueResponse({ ok: true, result: [] }); // GET — no updates
  await startCustomerBot();
  await flush();
  // Only 1 https.request call (the GET) — no POSTs
  expect((https.request as jest.Mock).mock.calls).toHaveLength(1);
});
