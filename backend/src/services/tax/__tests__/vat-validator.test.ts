jest.mock('axios', () => ({
  get: jest.fn(),
  isAxiosError: jest.fn().mockReturnValue(false),
}));

jest.mock('ioredis', () => jest.fn().mockImplementation(() => ({
  connect: jest.fn().mockResolvedValue(undefined),
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue('OK'),
  del: jest.fn().mockResolvedValue(1),
  keys: jest.fn().mockResolvedValue([]),
  quit: jest.fn().mockResolvedValue('OK'),
})));

import axios from 'axios';
import VatValidator, { getVatValidator } from '../vat-validator';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeApiResponse(overrides: Record<string, unknown> = {}) {
  return {
    data: {
      isValid: true,
      countryCode: 'DE',
      vatNumber: '123456789',
      name: 'Test GmbH',
      address: 'Berlin, Germany',
      validFrom: null,
      validTo: null,
      ...overrides,
    },
    status: 200,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  (axios.get as jest.Mock).mockResolvedValue(makeApiResponse());
});

// ---------------------------------------------------------------------------
// Constructor & config defaults
// ---------------------------------------------------------------------------

describe('VatValidator constructor', () => {
  it('creates instance with default config', () => {
    const v = new VatValidator();
    expect(v).toBeInstanceOf(VatValidator);
  });

  it('accepts partial config override', () => {
    const v = new VatValidator({ timeout: 5000 });
    expect(v).toBeInstanceOf(VatValidator);
  });
});

// ---------------------------------------------------------------------------
// getVatValidator singleton
// ---------------------------------------------------------------------------

describe('getVatValidator', () => {
  // Reset module singleton between tests via direct assignment — unavailable,
  // so we just test that it returns a VatValidator
  it('returns a VatValidator instance', () => {
    const v = getVatValidator();
    expect(v).toBeInstanceOf(VatValidator);
  });

  it('returns the same instance on repeated calls', () => {
    const v1 = getVatValidator();
    const v2 = getVatValidator();
    expect(v1).toBe(v2);
  });
});

// ---------------------------------------------------------------------------
// getEvidence / getEvidenceById
// ---------------------------------------------------------------------------

describe('VatValidator.getEvidence', () => {
  it('returns empty array initially', () => {
    const v = new VatValidator();
    expect(v.getEvidence()).toEqual([]);
  });
});

describe('VatValidator.getEvidenceById', () => {
  it('returns undefined for unknown id', () => {
    const v = new VatValidator();
    expect(v.getEvidenceById('does-not-exist')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// validateVat — normalization
// ---------------------------------------------------------------------------

describe('VatValidator.validateVat — input normalization', () => {
  it('normalizes country code to uppercase', async () => {
    const v = new VatValidator();
    (axios.get as jest.Mock).mockResolvedValue(makeApiResponse({ countryCode: 'DE' }));
    const { result } = await v.validateVat('de', '123456789');
    expect(axios.get).toHaveBeenCalledWith(
      expect.stringContaining('/DE/'),
      expect.any(Object)
    );
    expect(result.countryCode).toBe('DE');
  });

  it('strips spaces and dots from VAT number', async () => {
    const v = new VatValidator();
    await v.validateVat('DE', '12 345.678-9');
    expect(axios.get).toHaveBeenCalledWith(
      expect.stringContaining('123456789'),
      expect.any(Object)
    );
  });
});

// ---------------------------------------------------------------------------
// validateVat — API response mapping
// ---------------------------------------------------------------------------

describe('VatValidator.validateVat — response mapping', () => {
  it('returns isValid true when VIES says valid', async () => {
    const v = new VatValidator();
    const { result } = await v.validateVat('DE', '123456789');
    expect(result.isValid).toBe(true);
  });

  it('returns companyName from API response', async () => {
    const v = new VatValidator();
    const { result } = await v.validateVat('DE', '123456789');
    expect(result.companyName).toBe('Test GmbH');
  });

  it('sets fromCache: false for fresh API call', async () => {
    const v = new VatValidator();
    const { fromCache } = await v.validateVat('DE', '123456789');
    expect(fromCache).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// validateVat — error handling
// ---------------------------------------------------------------------------

describe('VatValidator.validateVat — error handling', () => {
  it('returns isValid: false on 400 error', async () => {
    (axios.isAxiosError as jest.Mock).mockReturnValue(true);
    (axios.get as jest.Mock).mockRejectedValue({
      isAxiosError: true,
      response: { status: 400 },
    });
    const v = new VatValidator();
    const { result } = await v.validateVat('XX', '000');
    expect(result.isValid).toBe(false);
  });

  it('stores evidence and makes it retrievable after validateVat', async () => {
    const v = new VatValidator();
    const { evidenceId } = await v.validateVat('DE', '123456789');
    expect(evidenceId).toBeTruthy();
    const ev = v.getEvidenceById(evidenceId);
    expect(ev).toBeDefined();
    expect(ev?.type).toBe('VAT_VALIDATION');
  });
});
