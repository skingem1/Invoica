import { describe, it, expect } from '@jest/globals';
import { formatCurrency, parseCurrency, SUPPORTED_CURRENCIES } from '../currency';

describe('currency utils', () => {
  it('formatCurrency returns $10.50 for USD 10.5', () => {
    expect(formatCurrency(10.5, 'USD')).toBe('$10.50');
  });

  it('formatCurrency returns € prefix for EUR', () => {
    expect(formatCurrency(10.5, 'EUR')).toBe('€10.50');
  });

  it('formatCurrency returns CODE X.XX for unknown currency', () => {
    expect(formatCurrency(100, 'JPY')).toBe('JPY 100.00');
  });

  it('parseCurrency strips non-numeric chars', () => {
    expect(parseCurrency('$10.50')).toBe(10.50);
  });

  it('SUPPORTED_CURRENCIES contains USD, EUR, GBP', () => {
    expect(SUPPORTED_CURRENCIES).toEqual(['USD', 'EUR', 'GBP']);
  });
});