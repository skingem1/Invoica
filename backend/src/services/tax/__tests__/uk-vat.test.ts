/**
 * UK VAT Test Suite
 *
 * Tests for UK VAT handling using the actual calculator and location-resolver implementations.
 */

import {
  calculateTax,
  calculateEUVAT,
} from '../calculator';
import {
  getJurisdiction,
  isEUCountry,
} from '../location-resolver';
import { TaxJurisdiction } from '../types';

describe('UK VAT - Country Code Recognition', () => {
  describe('isEUCountry', () => {
    it('should return true for GB (Great Britain)', () => {
      expect(isEUCountry('GB')).toBe(true);
      expect(isEUCountry('gb')).toBe(true);
    });

    it('should return false for non-EU countries', () => {
      expect(isEUCountry('US')).toBe(false);
      expect(isEUCountry('CA')).toBe(false);
      expect(isEUCountry('AU')).toBe(false);
    });

    it('should return false for empty input', () => {
      expect(isEUCountry('')).toBe(false);
    });
  });
});

describe('UK VAT - Tax Rate Configuration', () => {
  describe('calculateEUVAT', () => {
    it('should return 20% VAT rate for GB', () => {
      const rate = calculateEUVAT({ countryCode: 'GB' });
      expect(rate).toBe(0.20);
    });

    it('should return 20% VAT rate for UK (alternative code)', () => {
      const rate = calculateEUVAT({ countryCode: 'UK' });
      expect(rate).toBe(0.20);
    });

    it('should return 0 for non-EU countries', () => {
      expect(calculateEUVAT({ countryCode: 'US' })).toBe(0);
      expect(calculateEUVAT({ countryCode: 'CA' })).toBe(0);
    });

    it('should be case insensitive', () => {
      expect(calculateEUVAT({ countryCode: 'gb' })).toBe(0.20);
      expect(calculateEUVAT({ countryCode: 'Gb' })).toBe(0.20);
    });
  });
});

describe('UK VAT - B2C Calculations', () => {
  it('should charge 20% VAT for GB B2C customer (EU jurisdiction)', () => {
    const result = calculateTax({
      amount: 100,
      buyerLocation: { countryCode: 'GB' },
    });

    expect(result.jurisdiction).toBe(TaxJurisdiction.EU);
    expect(result.taxRate).toBe(0.20);
    expect(result.taxAmount).toBe(20);
  });

  it('should calculate correct VAT for various amounts', () => {
    const testCases = [
      { amount: 50, expectedTax: 10 },
      { amount: 250, expectedTax: 50 },
      { amount: 1000, expectedTax: 200 },
    ];

    for (const { amount, expectedTax } of testCases) {
      const result = calculateTax({
        amount,
        buyerLocation: { countryCode: 'GB' },
      });

      expect(result.taxAmount).toBeCloseTo(expectedTax, 0);
    }
  });
});

describe('UK VAT - B2B Calculations (VAT number triggers reverse charge)', () => {
  it('should apply reverse charge (0%) for B2B with VAT number', () => {
    const result = calculateTax({
      amount: 100,
      buyerLocation: { countryCode: 'GB', vatNumber: 'GB123456789' },
    });

    expect(result.taxRate).toBe(0);
    expect(result.taxAmount).toBe(0);
    expect(result.invoiceNote).toBe('Reverse charge - Art. 196 Council Directive 2006/112/EC');
  });

  it('should apply 20% VAT for GB customer without VAT number', () => {
    const result = calculateTax({
      amount: 100,
      buyerLocation: { countryCode: 'GB' },
    });

    expect(result.taxRate).toBe(0.20);
    expect(result.taxAmount).toBe(20);
  });
});

describe('UK VAT - Jurisdiction Resolution', () => {
  it('should resolve EU jurisdiction for GB country code', () => {
    const jurisdiction = getJurisdiction({ countryCode: 'GB' });
    expect(jurisdiction).toBe(TaxJurisdiction.EU);
  });

  it('should return NONE for non-EU/non-US countries', () => {
    const jurisdiction = getJurisdiction({ countryCode: 'AU' });
    expect(jurisdiction).toBe(TaxJurisdiction.NONE);
  });
});

describe('UK VAT - Edge Cases', () => {
  it('should handle invalid amount gracefully (negative)', () => {
    const result = calculateTax({
      amount: -100,
      buyerLocation: { countryCode: 'GB' },
    });
    // Negative amounts return 0 tax
    expect(result.taxAmount).toBe(0);
  });

  it('should handle zero amount gracefully', () => {
    const result = calculateTax({
      amount: 0,
      buyerLocation: { countryCode: 'GB' },
    });
    expect(result.taxAmount).toBe(0);
  });
});

describe('UK VAT - Comparison with Other EU Countries', () => {
  it('should have same rate as other 20% EU countries', () => {
    const gbRate = calculateEUVAT({ countryCode: 'GB' });
    const atRate = calculateEUVAT({ countryCode: 'AT' });
    const bgRate = calculateEUVAT({ countryCode: 'BG' });

    expect(gbRate).toBe(0.20);
    expect(atRate).toBe(0.20);
    expect(bgRate).toBe(0.20);
  });

  it('should have different rate than high-VAT Nordic countries', () => {
    const gbRate = calculateEUVAT({ countryCode: 'GB' });
    const seRate = calculateEUVAT({ countryCode: 'SE' });
    const fiRate = calculateEUVAT({ countryCode: 'FI' });

    // Sweden (25%) and Finland (24%) have higher rates
    expect(gbRate).toBeLessThan(seRate);
    expect(gbRate).toBeLessThan(fiRate);
  });

  it('should have higher rate than low-VAT countries', () => {
    const gbRate = calculateEUVAT({ countryCode: 'GB' });
    const luRate = calculateEUVAT({ countryCode: 'LU' });
    const mtRate = calculateEUVAT({ countryCode: 'MT' });

    // Luxembourg (17%) and Malta (18%) have lower rates
    expect(gbRate).toBeGreaterThan(luRate);
    expect(gbRate).toBeGreaterThan(mtRate);
  });
});
