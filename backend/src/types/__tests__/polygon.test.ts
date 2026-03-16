import {
  PolygonAddressSchema,
  PolygonCurrency,
  PolygonChains,
  DEFAULT_POLYGON_CHAIN,
  isPolygonAddress,
  createPolygonAddress,
} from '../polygon';

const VALID_ADDRESS = '0x742d35Cc6634C0532925a3b844Bc9e7595f12345';

describe('isPolygonAddress', () => {
  it('returns true for a valid 0x + 40-hex address', () => {
    expect(isPolygonAddress(VALID_ADDRESS)).toBe(true);
  });

  it.each([42, null, undefined, {}, []])(
    'returns false for non-string input: %p',
    (value) => {
      expect(isPolygonAddress(value)).toBe(false);
    }
  );

  it('returns false when 0x prefix is missing', () => {
    expect(isPolygonAddress('742d35Cc6634C0532925a3b844Bc9e7595f12345')).toBe(false);
  });

  it('returns false for address shorter than 40 hex chars after 0x', () => {
    expect(isPolygonAddress('0x742d35Cc6634C0532925a3b844Bc9e7595f1234')).toBe(false); // 39 chars
  });

  it('returns false for address longer than 40 hex chars after 0x', () => {
    expect(isPolygonAddress('0x742d35Cc6634C0532925a3b844Bc9e7595f123456')).toBe(false); // 41 chars
  });
});

describe('createPolygonAddress', () => {
  it('returns the address string for valid input', () => {
    const addr = createPolygonAddress(VALID_ADDRESS);
    expect(addr).toBe(VALID_ADDRESS);
  });

  it('throws ZodError for address missing 0x prefix', () => {
    expect(() => createPolygonAddress('742d35Cc6634C0532925a3b844Bc9e7595f12345')).toThrow();
  });

  it('throws ZodError for address with non-hex characters', () => {
    expect(() => createPolygonAddress('0xGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG')).toThrow();
  });
});

describe('PolygonAddressSchema', () => {
  it('safeParse returns success:true for valid address and success:false for invalid', () => {
    expect(PolygonAddressSchema.safeParse(VALID_ADDRESS).success).toBe(true);
    expect(PolygonAddressSchema.safeParse('not-an-address').success).toBe(false);
  });
});

describe('PolygonCurrency enum', () => {
  it('contains MATIC, USDC, USDT with correct string values', () => {
    expect(PolygonCurrency.MATIC).toBe('MATIC');
    expect(PolygonCurrency.USDC).toBe('USDC');
    expect(PolygonCurrency.USDT).toBe('USDT');
    expect(Object.values(PolygonCurrency)).toHaveLength(3);
  });
});

describe('PolygonChains and DEFAULT_POLYGON_CHAIN', () => {
  it('mainnet has chainId 137, testnet has chainId 80001, DEFAULT equals mainnet', () => {
    expect(PolygonChains.mainnet.chainId).toBe(137);
    expect(PolygonChains.testnet.chainId).toBe(80001);
    expect(DEFAULT_POLYGON_CHAIN).toBe(PolygonChains.mainnet);
  });
});
