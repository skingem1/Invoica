import { getJurisdiction, isEUCountry, isUSState } from '../location-resolver';
import { TaxJurisdiction } from '../types';

describe('getJurisdiction', () => {
  describe('US jurisdiction', () => {
    it('returns US for countryCode US', () => {
      expect(getJurisdiction({ countryCode: 'US' })).toBe(TaxJurisdiction.US);
    });

    it('is case-insensitive for US', () => {
      expect(getJurisdiction({ countryCode: 'us' })).toBe(TaxJurisdiction.US);
    });

    it('returns US via stateCode fallback when countryCode is not US but stateCode is a valid US state', () => {
      expect(getJurisdiction({ countryCode: 'XX', stateCode: 'CA' })).toBe(TaxJurisdiction.US);
    });

    it('stateCode fallback is case-insensitive', () => {
      expect(getJurisdiction({ countryCode: 'XX', stateCode: 'ca' })).toBe(TaxJurisdiction.US);
    });

    it('returns US for DC (District of Columbia)', () => {
      expect(getJurisdiction({ countryCode: 'XX', stateCode: 'DC' })).toBe(TaxJurisdiction.US);
    });
  });

  describe('EU jurisdiction', () => {
    it('returns EU for German countryCode DE', () => {
      expect(getJurisdiction({ countryCode: 'DE' })).toBe(TaxJurisdiction.EU);
    });

    it('returns EU for French countryCode FR', () => {
      expect(getJurisdiction({ countryCode: 'FR' })).toBe(TaxJurisdiction.EU);
    });

    it('is case-insensitive for EU countries', () => {
      expect(getJurisdiction({ countryCode: 'de' })).toBe(TaxJurisdiction.EU);
    });

    it('returns EU when VAT number is provided for EU country', () => {
      expect(getJurisdiction({ countryCode: 'DE', vatNumber: 'DE123456789' })).toBe(TaxJurisdiction.EU);
    });

    it('returns EU for GB (included in EU_COUNTRIES set)', () => {
      expect(getJurisdiction({ countryCode: 'GB' })).toBe(TaxJurisdiction.EU);
    });
  });

  describe('NONE jurisdiction', () => {
    it('returns NONE for unknown country', () => {
      expect(getJurisdiction({ countryCode: 'JP' })).toBe(TaxJurisdiction.NONE);
    });

    it('returns NONE when countryCode is empty string', () => {
      expect(getJurisdiction({ countryCode: '' })).toBe(TaxJurisdiction.NONE);
    });

    it('returns NONE when countryCode is missing (undefined coerced)', () => {
      expect(getJurisdiction({ countryCode: undefined as unknown as string })).toBe(TaxJurisdiction.NONE);
    });
  });
});

describe('isEUCountry', () => {
  it('returns true for a valid EU country (DE)', () => {
    expect(isEUCountry('DE')).toBe(true);
  });

  it('returns false for a non-EU country (US)', () => {
    expect(isEUCountry('US')).toBe(false);
  });

  it('is case-insensitive', () => {
    expect(isEUCountry('de')).toBe(true);
  });

  it('returns false for unknown country code', () => {
    expect(isEUCountry('XX')).toBe(false);
  });
});

describe('isUSState', () => {
  it('returns true for valid US state (CA)', () => {
    expect(isUSState('CA')).toBe(true);
  });

  it('returns false for invalid state code (XX)', () => {
    expect(isUSState('XX')).toBe(false);
  });

  it('is case-insensitive', () => {
    expect(isUSState('ca')).toBe(true);
  });

  it('returns true for DC', () => {
    expect(isUSState('DC')).toBe(true);
  });
});
