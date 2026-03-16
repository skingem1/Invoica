import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

// Mock signature module - must use relative path from __tests__
jest.mock('../signature', () => ({
  signPayload: jest.fn().mockReturnValue('mock-sig'),
}));

// Mock globalThis.fetch
const mockFetch = jest.fn<typeof fetch>();
globalThis.fetch = mockFetch;

describe('dispatch headers validation', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  afterEach(() => {
    mockFetch.mockReset();
  });

  it('includes correct headers in POST request to matching registration', async () => {
    const { dispatch } = await import('../dispatch');
    const event = {
      id: 'evt_1',
      type: 'invoice.created',
      data: { id: '1' },
      createdAt: new Date().toISOString(),
    };
    const registration = {
      id: 'reg_1',
      url: 'https://example.com/webhook',
      events: ['invoice.created'],
      secret: 'secret',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const mockRepo = {
      findActive: jest.fn<() => Promise<typeof registration[]>>().mockResolvedValue([registration]),
    };

    mockFetch.mockResolvedValue({ ok: true, status: 200 } as Response);

    await dispatch(event, mockRepo as any);

    expect(mockFetch).toHaveBeenCalledWith(
      'https://example.com/webhook',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          'X-Invoica-Signature': 'mock-sig',
          'X-Invoica-Event': 'invoice.created',
        }),
      })
    );
  });

  it('calls signPayload with JSON.stringify(event)', async () => {
    const { signPayload } = await import('../signature');
    const { dispatch } = await import('../dispatch');
    const event = {
      id: 'evt_2',
      type: 'payment.received',
      data: {},
      createdAt: new Date().toISOString(),
    };
    const registration = {
      id: 'reg_2',
      url: 'https://example.com/webhook',
      events: ['payment.received'],
      secret: 'secret',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const mockRepo = {
      findActive: jest.fn<() => Promise<typeof registration[]>>().mockResolvedValue([registration]),
    };

    mockFetch.mockResolvedValue({ ok: true, status: 200 } as Response);

    await dispatch(event, mockRepo as any);

    expect(signPayload).toHaveBeenCalledWith(JSON.stringify(event), 'secret');
  });
});
