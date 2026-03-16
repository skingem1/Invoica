import {
  calculateTax,
  calculateUSTax,
  calculateEUVAT,
  calculateNoTax,
  hasUSNexus,
  getUSNexusRate,
} from '../calculator';
import { TaxJurisdiction } from '../types';

describe('calculateTax()', () => {
  describe('US jurisdiction', () => {
    it('applies correct rate for CA (nexus state)', () => {
      const result = calculateTax({ amount: 10000, buyerLocation: { countryCode: 'US', stateCode: 'CA' } });
      expect(result.jurisdiction).toBe(TaxJurisdiction.US);
      expect(result.taxRate).toBe(0.0725);
      expect(result.taxAmount).toBe(725);
    });

    it('applies correct rate for TX', () => {
      const result = calculateTax({ amount: 10000, buyerLocation: { countryCode: 'US', stateCode: 'TX' } });
      expect(result.jurisdiction).toBe(TaxJurisdiction.US);
      expect(result.taxRate).toBe(0.0625);
      expect(result.taxAmount).toBe(625);
    });

    it('returns 0 tax for OR (no nexus)', () => {
      const result = calculateTax({ amount: 10000, buyerLocation: { countryCode: 'US', stateCode: 'OR' } });
      expect(result.jurisdiction).toBe(TaxJurisdiction.US);
      expect(result.taxRate).toBe(0);
      expect(result.taxAmount).toBe(0);
    });

    it('returns 0 tax with no stateCode', () => {
      const result = calculateTax({ amount: 10000, buyerLocation: { countryCode: 'US' } });
      expect(result.taxRate).toBe(0);
      expect(result.taxAmount).toBe(0);
    });

    it('is case insensitive for state code', () => {
      const result = calculateTax({ amount: 10000, buyerLocation: { countryCode: 'US', stateCode: 'ca' } });
      expect(result.taxRate).toBe(0.0725);
    });
  });

  describe('EU jurisdiction', () => {
    it('applies DE VAT (19%) for B2C', () => {
      const result = calculateTax({ amount: 10000, buyerLocation: { countryCode: 'DE' } });
      expect(result.jurisdiction).toBe(TaxJurisdiction.EU);
      expect(result.taxRate).toBe(0.19);
      expect(result.taxAmount).toBe(1900);
    });

    it('applies FR VAT (20%) for B2C', () => {
      const result = calculateTax({ amount: 10000, buyerLocation: { countryCode: 'FR' } });
      expect(result.jurisdiction).toBe(TaxJurisdiction.EU);
      expect(result.taxRate).toBe(0.20);
    });

    it('applies 0 tax for B2B with VAT number (reverse charge)', () => {
      const result = calculateTax({
        amount: 10000,
        buyerLocation: { countryCode: 'DE', vatNumber: 'DE123456789' },
      });
      expect(result.jurisdiction).toBe(TaxJurisdiction.EU);
      expect(result.taxRate).toBe(0);
      expect(result.taxAmount).toBe(0);
      expect(result.invoiceNote).toContain('Reverse charge');
    });

    it('returns NONE for unrecognised country code', () => {
      const result = calculateTax({ amount: 10000, buyerLocation: { countryCode: 'XX' } });
      expect(result.jurisdiction).toBe(TaxJurisdiction.NONE);
    });
  });

  describe('edge cases', () => {
    it('returns NONE jurisdiction for amount = 0', () => {
      const result = calculateTax({ amount: 0, buyerLocation: { countryCode: 'US', stateCode: 'CA' } });
      expect(result.jurisdiction).toBe(TaxJurisdiction.NONE);
      expect(result.taxRate).toBe(0);
      expect(result.taxAmount).toBe(0);
    });

    it('returns NONE jurisdiction for negative amount', () => {
      const result = calculateTax({ amount: -100, buyerLocation: { countryCode: 'US', stateCode: 'CA' } });
      expect(result.jurisdiction).toBe(TaxJurisdiction.NONE);
    });

    it('returns NONE jurisdiction for non-US/non-EU country (JP)', () => {
      const result = calculateTax({ amount: 10000, buyerLocation: { countryCode: 'JP' } });
      expect(result.jurisdiction).toBe(TaxJurisdiction.NONE);
      expect(result.taxRate).toBe(0);
    });
  });
});

describe('calculateUSTax()', () => {
  it.each([
    ['CA', 0.0725],
    ['TX', 0.0625],
    ['NY', 0.08],
    ['FL', 0.06],
    ['WA', 0.065],
  ])('returns correct rate for %s', (stateCode, expectedRate) => {
    expect(calculateUSTax({ countryCode: 'US', stateCode })).toBe(expectedRate);
  });

  it('is case insensitive', () => {
    expect(calculateUSTax({ countryCode: 'US', stateCode: 'ca' })).toBe(0.0725);
  });

  it('returns 0 for non-nexus state', () => {
    expect(calculateUSTax({ countryCode: 'US', stateCode: 'OR' })).toBe(0);
  });

  it('returns 0 with no stateCode', () => {
    expect(calculateUSTax({ countryCode: 'US' })).toBe(0);
  });
});

describe('calculateEUVAT()', () => {
  it('returns 0.19 for DE', () => {
    expect(calculateEUVAT({ countryCode: 'DE' })).toBe(0.19);
  });

  it('returns 0.20 for FR', () => {
    expect(calculateEUVAT({ countryCode: 'FR' })).toBe(0.20);
  });

  it('returns 0.25 for HR (Croatia)', () => {
    expect(calculateEUVAT({ countryCode: 'HR' })).toBe(0.25);
  });

  it('returns 0 for non-EU country', () => {
    expect(calculateEUVAT({ countryCode: 'US' })).toBe(0);
  });

  it('is case insensitive', () => {
    expect(calculateEUVAT({ countryCode: 'de' })).toBe(0.19);
  });
});

describe('hasUSNexus()', () => {
  it('returns true for nexus state', () => {
    expect(hasUSNexus('CA')).toBe(true);
  });

  it('returns false for non-nexus state', () => {
    expect(hasUSNexus('OR')).toBe(false);
  });
});

describe('getUSNexusRate()', () => {
  it('returns rate for nexus state', () => {
    expect(getUSNexusRate('CA')).toBe(0.0725);
  });

  it('returns undefined for non-nexus state', () => {
    expect(getUSNexusRate('OR')).toBeUndefined();
  });
});

describe('calculateNoTax()', () => {
  it('always returns 0', () => {
    expect(calculateNoTax()).toBe(0);
  });
});
