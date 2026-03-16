import { maskSecret, validateEnv } from '../env-validator';

describe('env-validator', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('maskSecret', () => {
    it('returns **** for short string like abc', () => {
      expect(maskSecret('abc')).toBe('****');
    });

    it('returns first4+***+last4 for long string', () => {
      expect(maskSecret('abcdefghijklmnop')).toBe('abcd***mnop');
    });

    it('returns **** for exactly 9 chars', () => {
      expect(maskSecret('abcdefghi')).toBe('****');
    });

    it('returns masked for exactly 10 chars', () => {
      expect(maskSecret('0123456789')).toBe('0123***6789');
    });
  });

  describe('validateEnv', () => {
    it('throws with missing vars message when env is empty', () => {
      process.env = {};
      expect(() => validateEnv()).toThrow(/Missing required environment variables/);
    });

    it('throws in legacy mode with "(legacy mode)" suffix', () => {
      process.env = {};
      expect(() => validateEnv()).toThrow(/legacy mode/);
    });

    it('throws in ClawRouter mode with "(USE_CLAWROUTER=true mode)" suffix', () => {
      process.env = { NODE_ENV: 'test', DATABASE_URL: 'postgres://x', USE_CLAWROUTER: 'true' };
      expect(() => validateEnv()).toThrow(/USE_CLAWROUTER=true mode/);
    });

    it('throws when ClawRouter mode is active but X402_OUTBOUND_WALLET_KEY is missing', () => {
      process.env = { NODE_ENV: 'test', DATABASE_URL: 'postgres://x', USE_CLAWROUTER: 'true' };
      expect(() => validateEnv()).toThrow(/X402_OUTBOUND_WALLET_KEY/);
    });

    it('throws when legacy mode missing ANTHROPIC_API_KEY', () => {
      process.env = { NODE_ENV: 'test', DATABASE_URL: 'postgres://x', MINIMAX_API_KEY: 'key' };
      expect(() => validateEnv()).toThrow(/ANTHROPIC_API_KEY/);
    });

    it('returns config in legacy mode with all required vars set', () => {
      process.env = {
        NODE_ENV: 'test',
        DATABASE_URL: 'postgres://localhost/test',
        ANTHROPIC_API_KEY: 'ak-test',
        MINIMAX_API_KEY: 'mx-test',
      };
      const config = validateEnv();
      expect(config.NODE_ENV).toBe('test');
      expect(config.DATABASE_URL).toBe('postgres://localhost/test');
    });

    it('returns config in ClawRouter mode with all required vars set', () => {
      process.env = {
        NODE_ENV: 'production',
        DATABASE_URL: 'postgres://localhost/prod',
        USE_CLAWROUTER: 'true',
        X402_OUTBOUND_WALLET_KEY: 'wallet-key',
      };
      const config = validateEnv();
      expect(config.USE_CLAWROUTER).toBe('true');
      expect(config.X402_OUTBOUND_WALLET_KEY).toBe('wallet-key');
    });

    it('PORT defaults to 3000 when not set', () => {
      process.env = {
        NODE_ENV: 'test',
        DATABASE_URL: 'postgres://x',
        ANTHROPIC_API_KEY: 'ak',
        MINIMAX_API_KEY: 'mx',
      };
      expect(validateEnv().PORT).toBe(3000);
    });

    it('PORT uses provided numeric value', () => {
      process.env = {
        NODE_ENV: 'test',
        DATABASE_URL: 'postgres://x',
        ANTHROPIC_API_KEY: 'ak',
        MINIMAX_API_KEY: 'mx',
        PORT: '4000',
      };
      expect(validateEnv().PORT).toBe(4000);
    });

    it('PORT falls back to 3000 when value is non-numeric', () => {
      process.env = {
        NODE_ENV: 'test',
        DATABASE_URL: 'postgres://x',
        ANTHROPIC_API_KEY: 'ak',
        MINIMAX_API_KEY: 'mx',
        PORT: 'invalid',
      };
      expect(validateEnv().PORT).toBe(3000);
    });

    it('LOG_LEVEL defaults to "info" when not set', () => {
      process.env = {
        NODE_ENV: 'test',
        DATABASE_URL: 'postgres://x',
        ANTHROPIC_API_KEY: 'ak',
        MINIMAX_API_KEY: 'mx',
      };
      expect(validateEnv().LOG_LEVEL).toBe('info');
    });

    it('LOG_LEVEL uses "debug" when explicitly set', () => {
      process.env = {
        NODE_ENV: 'test',
        DATABASE_URL: 'postgres://x',
        ANTHROPIC_API_KEY: 'ak',
        MINIMAX_API_KEY: 'mx',
        LOG_LEVEL: 'debug',
      };
      expect(validateEnv().LOG_LEVEL).toBe('debug');
    });
  });
});