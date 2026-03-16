import http from 'http';
import { EventEmitter } from 'events';

// Helper: build a mock http.ClientRequest + IncomingMessage pair
function mockHttpRequest(
  statusCode: number,
  responseBody: string,
  responseHeaders: Record<string, string> = {}
) {
  const reqEmitter = new EventEmitter() as any;
  reqEmitter.setTimeout = jest.fn();
  reqEmitter.destroy = jest.fn();
  reqEmitter.write = jest.fn();
  reqEmitter.end = jest.fn();

  jest.spyOn(http, 'request').mockImplementationOnce((_opts: any, callback: any) => {
    const res = new EventEmitter() as any;
    res.statusCode = statusCode;
    res.headers = responseHeaders;
    // Fire data + end synchronously after callback is registered
    setImmediate(() => {
      res.emit('data', responseBody);
      res.emit('end');
    });
    callback(res);
    return reqEmitter;
  });

  return reqEmitter;
}

// A minimal valid OpenAI-style response body
function openAiBody(content = 'hello', model = 'claude-test', inputTokens = 10, outputTokens = 5) {
  return JSON.stringify({
    model,
    choices: [{ message: { role: 'assistant', content } }],
    usage: { prompt_tokens: inputTokens, completion_tokens: outputTokens },
  });
}

describe('getCostLog', () => {
  it('returns an array', async () => {
    // Import fresh to get clean module state for this describe block
    const { getCostLog } = await import('../clawrouter-client');
    const log = getCostLog();
    expect(Array.isArray(log)).toBe(true);
  });
});

describe('callClawRouter', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('sends a POST request to /chat/completions', async () => {
    mockHttpRequest(200, openAiBody());
    const { callClawRouter } = await import('../clawrouter-client');
    await callClawRouter({ model: 'test-model', prompt: 'hi' });
    expect(http.request).toHaveBeenCalledTimes(1);
    const callArgs = (http.request as jest.Mock).mock.calls[0][0];
    expect(callArgs.path).toContain('/chat/completions');
    expect(callArgs.method).toBe('POST');
  });

  it('includes user prompt in messages', async () => {
    mockHttpRequest(200, openAiBody());
    const { callClawRouter } = await import('../clawrouter-client');
    await callClawRouter({ model: 'test-model', prompt: 'test prompt' });
    const callArgs = (http.request as jest.Mock).mock.calls[0][0];
    // req.write is called with the serialized body — capture via mock
    const reqMock = (http.request as jest.Mock).mock.results[0].value;
    const bodyStr = reqMock.write.mock.calls[0][0];
    const body = JSON.parse(bodyStr);
    const userMsg = body.messages.find((m: any) => m.role === 'user');
    expect(userMsg?.content).toBe('test prompt');
  });

  it('includes system prompt when provided', async () => {
    mockHttpRequest(200, openAiBody());
    const { callClawRouter } = await import('../clawrouter-client');
    await callClawRouter({ model: 'test-model', prompt: 'q', systemPrompt: 'be concise' });
    const reqMock = (http.request as jest.Mock).mock.results[0].value;
    const body = JSON.parse(reqMock.write.mock.calls[0][0]);
    const sysMsg = body.messages.find((m: any) => m.role === 'system');
    expect(sysMsg?.content).toBe('be concise');
  });

  it('omits system prompt when not provided', async () => {
    mockHttpRequest(200, openAiBody());
    const { callClawRouter } = await import('../clawrouter-client');
    await callClawRouter({ model: 'test-model', prompt: 'q' });
    const reqMock = (http.request as jest.Mock).mock.results[0].value;
    const body = JSON.parse(reqMock.write.mock.calls[0][0]);
    const sysMsg = body.messages.find((m: any) => m.role === 'system');
    expect(sysMsg).toBeUndefined();
  });

  it('parses response content and token counts', async () => {
    mockHttpRequest(200, openAiBody('the answer', 'claude-3', 20, 15));
    const { callClawRouter } = await import('../clawrouter-client');
    const result = await callClawRouter({ model: 'claude-3', prompt: 'q' });
    expect(result.content).toBe('the answer');
    expect(result.model).toBe('claude-3');
    expect(result.inputTokens).toBe(20);
    expect(result.outputTokens).toBe(15);
    expect(result.backend).toBe('clawrouter');
  });

  it('extracts costUsdc from X-Payment-Amount header', async () => {
    mockHttpRequest(200, openAiBody(), { 'x-payment-amount': '2500000' });
    const { callClawRouter } = await import('../clawrouter-client');
    const result = await callClawRouter({ model: 'test-model', prompt: 'q' });
    expect(result.costUsdc).toBeCloseTo(2.5);
  });

  it('defaults costUsdc to 0 when no cost header present', async () => {
    mockHttpRequest(200, openAiBody());
    const { callClawRouter } = await import('../clawrouter-client');
    const result = await callClawRouter({ model: 'test-model', prompt: 'q' });
    expect(result.costUsdc).toBe(0);
  });

  it('throws on non-200 status with status code in message', async () => {
    mockHttpRequest(500, 'Internal Server Error');
    const { callClawRouter } = await import('../clawrouter-client');
    await expect(callClawRouter({ model: 'test-model', prompt: 'q' })).rejects.toThrow('500');
  });

  it('appends entry to cost log after successful call', async () => {
    mockHttpRequest(200, openAiBody('response', 'log-model', 5, 3));
    const { callClawRouter, getCostLog } = await import('../clawrouter-client');
    const before = getCostLog().length;
    await callClawRouter({ model: 'log-model', prompt: 'q' });
    expect(getCostLog().length).toBe(before + 1);
    const entry = getCostLog()[getCostLog().length - 1];
    expect(entry.model).toBe('log-model');
  });
});
