/**
 * Tax Service Types
 * 
 * Type definitions for the EU VAT and US sales tax calculation service.
 */

export interface Address {
  line1?: string;
  line2?: string;
  city: string;
  state?: string;
  postalCode: string;
  country: string; // ISO 3166-1 alpha-2 code (e.g., "DE", "US")
}

export interface BuyerInfo {
  vatNumber?: string;
  address: Address;
  ipAddress?: string;
  entityType?: 'business' | 'individual';
  state?: string; // US state for sales tax
}

export interface SellerInfo {
  address: Address;
  vatNumber?: string;
}

export interface TaxEvidence {
  id?: number;
  orderId: string;
  buyerVatNumber?: string;
  buyerCountry: string;
  sellerCountry: string;
  vatValid: boolean;
  vatValidationTimestamp?: Date;
  ipCountry?: string;
  billingAddressCountry: string;
  resolvedCountry: string;
  validationMethod: 'vat_number' | 'billing_address' | 'ip_geolocation';
  evidenceTimestamp: Date;
}

export interface ViesValidationResult {
  valid: boolean;
  countryCode: string;
  vatNumber: string;
  name?: string;
  companyAddress?: string;
  requestDate: string;
  validFormat: boolean;
  showRequest: boolean;
  traderName?: string;
  traderCompanyType?: string;
  traderAddress?: string;
}

export interface TaxCalculationResult {
  taxAmount: number;
  taxRate: number;
  jurisdiction: {
    country: string;
    state?: string;
    type: 'eu_vat' | 'us_sales_tax' | 'none';
  };
  reverseCharge: boolean;
  invoiceNote?: string;
  evidence: TaxEvidence;
}

export interface TaxConfig {
  // Database connection or ORM instance
  db?: unknown;
  // Redis client for caching
  redis?: RedisClient;
  // VIES API configuration
  viesConfig?: {
    timeout?: number;
    retries?: number;
  };
}

export interface RedisClient {
  get(key: string): Promise<string | null>;
  setex(key: string, seconds: number, value: string): Promise<void>;
  del(key: string): Promise<void>;
}

export interface DatabaseClient {
  query<T>(sql: string, params?: unknown[]): Promise<T>;
  insert(table: string, data: Record<string, unknown>): Promise<number>;
}

export type TaxType = 'eu_vat' | 'us_sales_tax' | 'none';

export interface TaxRate {
  country: string;
  state?: string;
  rate: number;
  type: TaxType;
  effectiveDate: Date;
  isStandardRate: boolean;
  reducedRates?: number[];
}
