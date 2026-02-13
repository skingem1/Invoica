/**
 * Tax Calculator Service
 * 
 * Main tax calculation logic for EU VAT (B2B reverse charge) and US sales tax.
 * 
 * EU VAT Rules:
 * - B2B with valid VAT: Reverse charge (0% VAT)
 * - B2C or no VAT: Charge buyer's country VAT rate
 * 
 * US Sales Tax Rules:
 * - Check economic nexus in buyer's state
 * - Apply state/local sales tax if nexus exists
 */

import {
  BuyerInfo,
  SellerInfo,
  TaxCalculationResult,
  TaxEvidence,
  TaxRate,
  Address,
} from './types';
import { LocationResolver, ResolvedLocation } from './location-resolver';
import { VatValidator } from './vat-validator';

export interface TaxCalculatorConfig {
  locationResolver: LocationResolver;
  vatValidator: VatValidator;
  getTaxRate: (country: string, state?: string) => Promise<TaxRate | null>;
  storeEvidence: (evidence: TaxEvidence) => Promise<void>;
}

export class TaxCalculator {
  private locationResolver: LocationResolver;
  private vatValidator: VatValidator;
  private getTaxRate: (country: string, state?: string) => Promise<TaxRate | null>;
  private storeEvidence: (evidence: TaxEvidence) => Promise<void>;

  // EU country VAT rates (standard rates as of 2024)
  // In production, these should come from a database
  private readonly EU_VAT_RATES: Record<string, number> = {
    AT: 20, // Austria
    BE: 21, // Belgium
    BG: 20, // Bulgaria
    CY: 19, // Cyprus
    CZ: 21, // Czech Republic
    DE: 19, // Germany
    DK: 25, // Denmark
    EE: 22, // Estonia
    EL: 24, // Greece
    ES: 21, // Spain
    FI: 24, // Finland
    FR: 20, // France
    HR: 25, // Croatia
    HU: 27, // Hungary
    IE: 23, // Ireland
    IT: 22, // Italy
    LT: 21, // Lithuania
    LU: 17, // Luxembourg
    LV: 21, // Latvia
    MT: 18, // Malta
    NL: 21, // Netherlands
    PL: 23, // Poland
    PT: 23, // Portugal
    RO: 19, // Romania
    SE: 25, // Sweden
    SI: 22, // Slovenia
    SK: 20, // Slovakia
    XI: 20, // Northern Ireland
  };

  // Reduced VAT rates for EU countries (for reference)
  private readonly EU_REDUCED_VAT_RATES: Record<string, number[]> = {
    DE: [7],
    FR: [10, 5.5],
    ES: [10, 4],
    IT: [10, 5, 4],
    // ... other countries have various reduced rates
  };

  // US states with economic nexus thresholds and sales tax
  private readonly US_NEXUS_STATES: Record<string, { threshold: number; rate: number }> = {
    AL: { threshold: 250000, rate: 4.0 },
    AK: { threshold: 100000, rate: 0 }, // No state sales tax
    AZ: { threshold: 100000, rate: 5.6 },
    AR: { threshold: 100000, rate: 6.5 },
    CA: { threshold: 500000, rate: 7.25 },
    CO: { threshold: 100000, rate: 2.9 },
    CT: { threshold: 100000, rate: 6.35 },
    DE: { threshold: 100000, rate: 0 },
    FL: { threshold: 100000, rate: 6.0 },
    GA: { threshold: 100000, rate: 4.0 },
    HI: { threshold: 100000, rate: 4.0 },
    ID: { threshold: 100000, rate: 6.0 },
    IL: { threshold: 100000, rate: 6.25 },
    IN: { threshold: 100000, rate: 7.0 },
    IA: { threshold: 100000, rate: 6.0 },
    KS: { threshold: 100000, rate: 6.5 },
    KY: { threshold: 100000, rate: 6.0 },
    LA: { threshold: 100000, rate: 4.45 },
    ME: { threshold: 100000, rate: 5.5 },
    MD: { threshold: 100000, rate: 6.0 },
    MA: { threshold: 100000, rate: 6.25 },
    MI: { threshold: 100000, rate: 6.0 },
    MN: { threshold: 100000, rate: 6.875 },
    MS: { threshold: 250000, rate: 7.0 },
    MO: { threshold: 100000, rate: 4.225 },
    NE: { threshold: 100000, rate: 5.5 },
    NV: { threshold: 100000, rate: 6.85 },
    NJ: { threshold: 100000, rate: 6.625 },
    NM: { threshold: 100000, rate: 5.125 },
    NY: { threshold: 500000, rate: 4.0 },
    NC: { threshold: 100000, rate: 4.75 },
    ND: { threshold: 100000, rate: 5.0 },
    OH: { threshold: 100000, rate: 5.75 },
    OK: { threshold: 100000, rate: 4.5 },
    OR: { threshold: 100000, rate: 0 },
    PA: { threshold: 100000, rate: 6.0 },
    RI: { threshold: 100000, rate: 7.0 },
    SC: { threshold: 100000, rate: 6.0 },
    SD: { threshold: 100000, rate: 4.5 },
    TN: { threshold: 100000, rate: 7.0 },
    TX: { threshold: 500000, rate: 6.25 },
    UT: { threshold: 100000, rate: 6.1 },
    VT: { threshold: 100000, rate: 6.0 },
    VA: { threshold: 100000, rate: 5.3 },
    WA: { threshold: 100000, rate: 6.5 },
    WV: { threshold: 100000, rate: 6.0 },
    WI: { threshold: 100000, rate: 5.0 },
    WY: { threshold: 100000, rate: 4.0 },
  };

  constructor(config: TaxCalculatorConfig) {
    this.locationResolver = config.locationResolver;
    this.vatValidator = config.vatValidator;
    this.getTaxRate = config.getTaxRate;
    this.storeEvidence = config.storeEvidence;
  }

  /**
   * Calculate tax for a transaction
   * 
   * @param amount - The transaction amount (before tax)
   * @param buyer - Buyer information
   * @param seller - Seller information
   * @param orderId - Order ID for evidence tracking
   * @returns Tax calculation result with amount, rate, jurisdiction, and invoice details
   */
  async calculateTax(
    amount: number,
    buyer: BuyerInfo,
    seller: SellerInfo,
    orderId: string
  ): Promise<TaxCalculationResult> {
    // Validate inputs
    if (amount < 0) {
      throw new Error('Amount cannot be negative');
    }

    if (!buyer?.address?.country) {
      throw new Error('Buyer address is required');
    }

    // Resolve buyer location
    const location = await this.locationResolver.resolveLocation(buyer, orderId);

    // Determine tax jurisdiction and calculate
    const isEuSeller = this.isEuCountry(seller.address?.country);
    const isEuBuyer = this.isEuCountry(location.country);
    const isUsTransaction = buyer.address?.country === 'US' || 
                           (location.country === 'US');

    let result: TaxCalculationResult;

    if (isEuSeller && isEuBuyer) {
      // EU B2B transaction
      result = await this.calculateEuVat(amount, buyer, seller, location, orderId);
    } else if (isUsTransaction) {
      // US sales tax
      result = await this.calculateUsSalesTax(amount, buyer, location, orderId);
    } else {
      // Outside EU/US or B2C without VAT - no tax
      result = this.calculateNoTax(amount, location, orderId);
    }

    // Store evidence for compliance
    await this.storeEvidence(result.evidence);

    return result;
  }

  /**
   * Calculate EU VAT
   * 
   * Rules:
   * - B2B with valid VAT number: Reverse charge (0%)
   * - B2C or no VAT: Charge buyer's country rate
   */
  private async calculateEuVat(
    amount: number,
    buyer: BuyerInfo,
    seller: SellerInfo,
    location: ResolvedLocation,
    orderId: string
  ): Promise<TaxCalculationResult> {
    // Check if buyer has valid VAT number and is B2B
    const isB2B = buyer.entityType === 'business' || buyer.vatNumber !== undefined;
    const hasValidVat = location.isValidVat && buyer.vatNumber !== undefined;

    // Build evidence
    const evidence: TaxEvidence = {
      orderId,
      buyerVatNumber: buyer.vatNumber,
      buyerCountry: location.country,
      sellerCountry: seller.address?.country || 'UNKNOWN',
      vatValid: hasValidVat,
      vatValidationTimestamp: hasValidVat ? new Date() : undefined,
      billingAddressCountry: buyer.address?.country,
      resolvedCountry: location.country,
      validationMethod: location.validationMethod,
      evidenceTimestamp: new Date(),
    };

    // B2B with valid VAT - Reverse Charge
    if (isB2B && hasValidVat) {
      return {
        taxAmount: 0,
        taxRate: 0,
        jurisdiction: {
          country: location.country,
          type: 'eu_vat',
        },
        reverseCharge: true,
        invoiceNote: 'Reverse charge - Art. 196 Council Directive 2006/112/EC',
        evidence,
      };
    }

    // B2C or B2B without valid VAT - Charge VAT
    const taxRate = this.getEuVatRate(location.country);
    const taxAmount = this.roundAmount(amount * (taxRate / 100));

    return {
      taxAmount,
      taxRate,
      jurisdiction: {
        country: location.country,
        type: 'eu_vat',
      },
      reverseCharge: false,
      invoiceNote: undefined,
      evidence,
    };
  }

  /**
   * Calculate US sales tax
   * 
   * Rules:
   * - Check economic nexus in buyer's state
   * - Apply state/local tax if nexus exists
   */
  private async calculateUsSalesTax(
    amount: number,
    buyer: BuyerInfo,
    location: ResolvedLocation,
    orderId: string
  ): Promise<TaxCalculationResult> {
    const state = buyer.state || location.state;
    
    if (!state) {
      return this.calculateNoTax(amount, location, orderId);
    }

    const nexusState = this.US_NEXUS_STATES[state.toUpperCase()];
    
    if (!nexusState || nexusState.rate === 0) {
      // No nexus or no state tax
      return this.calculateNoTax(amount, location, orderId);
    }

    const taxRate = nexusState.rate;
    const taxAmount = this.roundAmount(amount * (taxRate / 100));

    const evidence: TaxEvidence = {
      orderId,
      buyerCountry: 'US',
      sellerCountry: 'US',
      vatValid: false,
      billingAddressCountry: buyer.address?.country || 'US',
      resolvedCountry: 'US',
      validationMethod: location.validationMethod,
      evidenceTimestamp: new Date(),
    };

    return {
      taxAmount,
      taxRate,
      jurisdiction: {
        country: 'US',
        state,
        type: 'us_sales_tax',
      },
      reverseCharge: false,
      invoiceNote: undefined,
      evidence,
    };
  }

  /**
   * No tax applicable
   */
  private calculateNoTax(
    amount: number,
    location: ResolvedLocation,
    orderId: string
  ): TaxCalculationResult {
    const evidence: TaxEvidence = {
      orderId,
      buyerCountry: location.country,
      sellerCountry: 'UNKNOWN',
      vatValid: false,
      billingAddressCountry: location.evidence?.billingAddressCountry || location.country,
      resolvedCountry: location.country,
      validationMethod: location.validationMethod,
      evidenceTimestamp: new Date(),
    };

    return {
      taxAmount: 0,
      taxRate: 0,
      jurisdiction: {
        country: location.country,
        state: location.state,
        type: 'none',
      },
      reverseCharge: false,
      invoiceNote: undefined,
      evidence,
    };
  }

  /**
   * Get EU VAT rate for a country
   */
  private getEuVatRate(countryCode: string): number {
    return this.EU_VAT_RATES[countryCode.toUpperCase()] || 20; // Default to 20%
  }

  /**
   * Check if country is in EU
   */
  private isEuCountry(countryCode?: string): boolean {
    if (!countryCode) return false;
    return countryCode.toUpperCase() in this.EU_VAT_RATES;
  }

  /**
   * Round amount to 2 decimal places
   */
  private roundAmount(amount: number): number {
    return Math.round(amount * 100) / 100;
  }
}

export default TaxCalculator;
