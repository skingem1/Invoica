/**
 * Supported currency codes with their symbols
 */
export const SUPPORTED_CURRENCIES = ['USD', 'EUR', 'GBP'] as const;

/**
 * Currency symbol mapping
 */
const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
};

/**
 * Formats a number as a currency string with the appropriate symbol
 * 
 * @param amount - The amount to format
 * @param currency - The currency code (USD, EUR, GBP, or other)
 * @returns Formatted currency string (e.g., "$100.00" or "JPY 100.00")
 */
export function formatCurrency(amount: number, currency: string): string {
  const formattedAmount = amount.toFixed(2);
  const symbol = CURRENCY_SYMBOLS[currency];
  
  if (symbol) {
    return `${symbol}${formattedAmount}`;
  }
  
  return `${currency} ${formattedAmount}`;
}

/**
 * Parses a formatted currency string back to a number
 * 
 * @param formatted - The formatted currency string
 * @returns The numeric amount
 */
export function parseCurrency(formatted: string): number {
  const numericString = formatted.replace(/[^0-9.]/g, '');
  const parsed = parseFloat(numericString);
  
  if (isNaN(parsed)) {
    throw new Error(`Invalid currency string: ${formatted}`);
  }
  
  return parsed;
}