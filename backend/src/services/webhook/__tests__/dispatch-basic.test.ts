import { jest } from '@jest/globals';

interface WebhookEvent {
  id: string;
  type: string;
  data: unknown;
  createdAt: string;
}

interface WebhookRegistration {
  id: string;
  url: string;
  events: string[];
  secret: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface WebhookRepository {
  findActive: jest.Mock<Promise<WebhookRegistration[]>>;
}

jest.mock('../signature', () => ({
  signPayload: jest.fn().mockReturnValue('mock-sig'),
}));

describe('dispatch', () => {
  let dispatch: (event: WebhookEvent, repo: WebhookRepository) => Promise<any>;
  let mockFetch: jest.Mock<typeof fetch>;

  beforeAll(async () => {
    mockFetch = jest.fn() as jest.Mock<typeof fetch>;
    (globalThis as { fetch: typeof fetch }).fetch = mockFetch;
    const module = await import('../dispatch');
    dispatch = module.dispatch;
  });

  afterAll(() => {
    jest.resetModules();
  });

  it('calls repo.findActive() to get registrations', async () => {
    const mockRepo: WebhookRepository = {
      findActive: jest.fn().mockResolvedValue([]),
    };
    const event: WebhookEvent = { id: 'evt_1', type: 'order.created', data: {}, createdAt: new Date().toISOString() };

    await dispatch(event, mockRepo);

    expect(mockRepo.findActive).toHaveBeenCalled();
  });

  it('sends POST to matching registration URL', async () => {
    const mockRepo: WebhookRepository = {
      findActive: jest.fn().mockResolvedValue([
        {
          id: 'reg_1',
          url: 'https://example.com/webhook',
          events: ['order.created'],
          secret: 'mock-secret',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]),
    };
    mockFetch.mockResolvedValue({ ok: true, status: 200 } as Response);
    const event: WebhookEvent = { id: 'evt_2', type: 'order.created', data: { id: '123' }, createdAt: new Date().toISOString() };

    await dispatch(event, mockRepo);

    expect(mockFetch).toHaveBeenCalledWith(
      'https://example.com/webhook',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          'X-Invoica-Signature': 'mock-sig',
        }),
        body: JSON.stringify(event),
      })
    );
  });
});
