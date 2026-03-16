import { Request, Response } from 'express';

const mockCreateApiKey = jest.fn();
const mockGetCustomerApiKeys = jest.fn();
const mockInvalidateApiKey = jest.fn();
const mockRotateApiKey = jest.fn();
const mockSendWelcomeEmail = jest.fn().mockResolvedValue(undefined);

jest.mock('../../services/api-keys', () => ({
  createApiKey: (...args: unknown[]) => mockCreateApiKey(...args),
  getCustomerApiKeys: (...args: unknown[]) => mockGetCustomerApiKeys(...args),
  invalidateApiKey: (...args: unknown[]) => mockInvalidateApiKey(...args),
  rotateApiKey: (...args: unknown[]) => mockRotateApiKey(...args),
  createApiKeySchema: {
    safeParse: (data: Record<string, unknown>) => {
      if (!data.customerId) return { success: false, error: { flatten: () => ({ fieldErrors: { customerId: ['required'] } }) } };
      return { success: true, data };
    },
  },
}));

jest.mock('../../services/email/welcome-email', () => ({
  sendWelcomeEmail: (...args: unknown[]) => mockSendWelcomeEmail(...args),
}));

import {
  createApiKeyHandler,
  listApiKeysHandler,
  revokeApiKeyHandler,
  rotateApiKeyHandler,
} from '../api-keys';

function makeRes() {
  const res = { status: jest.fn(), json: jest.fn() };
  res.status.mockReturnValue(res);
  return res;
}

describe('createApiKeyHandler', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 400 when body fails validation', async () => {
    const req = { body: {} } as Request;
    const res = makeRes();
    await createApiKeyHandler(req, res as unknown as Response);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Validation failed' }));
  });

  it('returns 201 with result on success', async () => {
    const apiKeyResult = { key: 'inv_ABCD1234567890', customerId: 'cust-1' };
    mockCreateApiKey.mockResolvedValueOnce(apiKeyResult);
    const req = { body: { customerId: 'cust-1', customerEmail: 'a@b.com' } } as Request;
    const res = makeRes();
    await createApiKeyHandler(req, res as unknown as Response);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(apiKeyResult);
  });

  it('returns 500 when createApiKey throws', async () => {
    mockCreateApiKey.mockRejectedValueOnce(new Error('DB error'));
    const req = { body: { customerId: 'cust-1' } } as Request;
    const res = makeRes();
    await createApiKeyHandler(req, res as unknown as Response);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
  });
});

describe('listApiKeysHandler', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 400 when customerId query param is missing', async () => {
    const req = { query: {} } as Request;
    const res = makeRes();
    await listApiKeysHandler(req, res as unknown as Response);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'customerId query parameter is required' });
  });

  it('returns 200 with keys list on success', async () => {
    const keys = [{ id: 'k1', prefix: 'inv_ABCD' }];
    mockGetCustomerApiKeys.mockResolvedValueOnce(keys);
    const req = { query: { customerId: 'cust-1' } } as unknown as Request;
    const res = makeRes();
    await listApiKeysHandler(req, res as unknown as Response);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(keys);
  });

  it('returns 500 when getCustomerApiKeys throws', async () => {
    mockGetCustomerApiKeys.mockRejectedValueOnce(new Error('DB error'));
    const req = { query: { customerId: 'cust-1' } } as unknown as Request;
    const res = makeRes();
    await listApiKeysHandler(req, res as unknown as Response);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('revokeApiKeyHandler', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 200 on successful revoke', async () => {
    mockInvalidateApiKey.mockResolvedValueOnce(undefined);
    const req = { params: { id: 'k-123' } } as unknown as Request;
    const res = makeRes();
    await revokeApiKeyHandler(req, res as unknown as Response);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ message: 'API key invalidated successfully' });
  });

  it('returns 500 when invalidateApiKey throws', async () => {
    mockInvalidateApiKey.mockRejectedValueOnce(new Error('not found'));
    const req = { params: { id: 'k-bad' } } as unknown as Request;
    const res = makeRes();
    await revokeApiKeyHandler(req, res as unknown as Response);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('rotateApiKeyHandler', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 200 with new key on success', async () => {
    const newKey = { key: 'inv_NEWKEY', customerId: 'cust-1' };
    mockRotateApiKey.mockResolvedValueOnce(newKey);
    const req = { params: { id: 'k-old' } } as unknown as Request;
    const res = makeRes();
    await rotateApiKeyHandler(req, res as unknown as Response);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(newKey);
  });

  it('returns 500 when rotateApiKey throws', async () => {
    mockRotateApiKey.mockRejectedValueOnce(new Error('DB error'));
    const req = { params: { id: 'k-old' } } as unknown as Request;
    const res = makeRes();
    await rotateApiKeyHandler(req, res as unknown as Response);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});
