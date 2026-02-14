import { formatCurrency, parseCurrency, SUPPORTED_CURRENCIES } from '../../src/utils/currency';

describe('currency utility', () => {
  describe('SUPPORTED_CURRENCIES', () => {
    it('should contain USD, EUR, GBP', () => {
      expect(SUPPORTED_CURRENCIES).toContain('USD');
      expect(SUPPORTED_CURRENCIES).toContain('EUR');
      expect(SUPPORTED_CURRENCIES).toContain('GBP');
    });

    it('should have exactly 3 supported currencies', () => {
      expect(SUPPORTED_CURRENCIES).toHaveLength(3);
    });

    it('should be a readonly array', () => {
      // TypeScript ensures this at compile time, but we verify the values
      expect(Object.isFrozen(SUPPORTED_CURRENCIES)).toBe(true);
    });
  });

  describe('formatCurrency', () => {
    describe('USD currency', () => {
      it('should format positive number with $ symbol', () => {
        expect(formatCurrency(100, 'USD')).toBe('$100.00');
      });

      it('should format zero with $ symbol', () => {
        expect(formatCurrency(0, 'USD')).toBe('$0.00');
      });

      it('should format negative number with $ symbol', () => {
        expect(formatCurrency(-50.5, 'USD')).toBe('$-50.50');
      });

      it('should format large number with $ symbol', () => {
        expect(formatCurrency(1234567.89, 'USD')).toBe('$1234567.89');
      });

      it('should format decimal number correctly', () => {
        expect(formatCurrency(99.99, 'USD')).toBe('$99.99');
      });
    });

    describe('EUR currency', () => {
      it('should format positive number with € symbol', () => {
        expect(formatCurrency(100, 'EUR')).toBe('€100.00');
      });

      it('should format zero with € symbol', () => {
        expect(formatCurrency(0, 'EUR')).toBe('€0.00');
      });

      it('should format negative number with € symbol', () => {
        expect(formatCurrency(-75.25, 'EUR')).toBe('€-75.25');
      });
    });

    describe('GBP currency', () => {
      it('should format positive number with £ symbol', () => {
        expect(formatCurrency(100, 'GBP')).toBe('£100.00');
      });

      it('should format zero with £ symbol', () => {
        expect(formatCurrency(0, 'GBP')).toBe('£0.00');
      });

      it('should format negative number with £ symbol', () => {
        expect(formatCurrency(-25.99, 'GBP')).toBe('£-25.99');
      });
    });

    describe('unsupported currencies', () => {
      it('should format JPY with currency code prefix', () => {
        expect(formatCurrency(1000, 'JPY')).toBe('JPY 1000.00');
      });

      it('should format CAD with currency code prefix', () => {
        expect(formatCurrency(50, 'CAD')).toBe('CAD 50.00');
      });

      it('should format AUD with currency code prefix', () => {
        expect(formatCurrency(250.5, 'AUD')).toBe('AUD 250.50');
      });

      it('should format unknown currency with currency code prefix', () => {
        expect(formatCurrency(100, 'XYZ')).toBe('XYZ 100.00');
      });
    });

    describe('edge cases', () => {
      it('should handle very small decimal values', () => {
        expect(formatCurrency(0.01, 'USD')).toBe('$0.01');
      });

      it('should round half up correctly', () => {
        expect(formatCurrency(1.255, 'USD')).toBe('$1.26');
      });

      it('should handle whitespace in currency code', () => {
        // Currency codes should be trimmed by caller, but we test current behavior
        expect(formatCurrency(100, ' USD ')).toBe('$100.00');
      });
    });
  });

  describe('parseCurrency', () => {
    describe('parsing USD format', () => {
      it('should parse simple USD string', () => {
        expect(parseCurrency('$100.00')).toBe(100);
      });

      it('should parse USD string with no symbol', () => {
        expect(parseCurrency('100.00')).toBe(100);
      });

      it('should parse negative USD string', () => {
        expect(parseCurrency('$-50.00')).toBe(-50);
      });

      it('should parse USD string with commas', () => {
        expect(parseCurrency('$1,234.56')).toBe(1234.56);
      });
    });

    describe('parsing EUR format', () => {
      it('should parse EUR string with € symbol', () => {
        expect(parseCurrency('€100.00')).toBe(100);
      });

      it('should parse negative EUR string', () => {
        expect(parseCurrency('€-75.50')).toBe(-75.5);
      });
    });

    describe('parsing GBP format', () => {
      it('should parse GBP string with £ symbol', () => {
        expect(parseCurrency('£250.00')).toBe(250);
      });

      it('should parse negative GBP string', () => {
        expect(parseCurrency('£-25.99')).toBe(-25.99);
      });
    });

    describe('parsing default format', () => {
      it('should parse currency code prefix format', () => {
        expect(parseCurrency('JPY 1000.00')).toBe(1000);
      });

      it('should parse CAD format', () => {
        expect(parseCurrency('CAD 500.50')).toBe(500.5);
      });
    });

    describe('error handling', () => {
      it('should throw error for empty string', () => {
        expect(() => parseCurrency('')).toThrow('Invalid currency string: ');
      });

      it('should throw error for string with no numbers', () => {
        expect(() => parseCurrency('USD')).toThrow('Invalid currency string: USD');
      });

      it('should throw error for string with only symbols', () => {
        expect(() => parseCurrency('$$$')).toThrow('Invalid currency string: $$$');
      });

      it('should throw error for whitespace only', () => {
        expect(() => parseCurrency('   ')).toThrow('Invalid currency string:    ');
      });
    });

    describe('edge cases', () => {
      it('should handle decimal only string', () => {
        expect(parseCurrency('.99')).toBe(0.99);
      });

      it('should handle leading zeros', () => {
        expect(parseCurrency('$00123.45')).toBe(123.45);
      });

      it('should handle multiple decimal points gracefully', () => {
        // parseFloat takes first valid number sequence
        expect(parseCurrency('$10.5.5')).toBe(10.5);
      });
    });
  });

  describe('round-trip conversion', () => {
    it('should preserve value for USD', () => {
      const original = 1234.56;
      const formatted = formatCurrency(original, 'USD');
      const parsed = parseCurrency(formatted);
      expect(parsed).toBe(original);
    });

    it('should preserve value for EUR', () => {
      const original = 999.99;
      const formatted = formatCurrency(original, 'EUR');
      const parsed = parseCurrency(formatted);
      expect(parsed).toBe(original);
    });

    it('should preserve value for GBP', () => {
      const original = 0.01;
      const formatted = formatCurrency(original, 'GBP');
      const parsed = parseCurrency(formatted);
      expect(parsed).toBe(original);
    });

    it('should preserve value for unsupported currency', () => {
      const original = 500;
      const formatted = formatCurrency(original, 'CAD');
      const parsed = parseCurrency(formatted);
      expect(parsed).toBe(original);
    });
  });
});