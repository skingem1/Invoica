/**
 * Tax Calculator Service
 * 
 * Main tax calculation logic for:
 * - EU VAT B2B reverse charge
 * - EU VAT B2C
 * - US sales tax (future expansion)
 */

import { v4 as uuidv4 } from 'uuid';
import { LocationResolver } from './location-resolver';
import { VatValidator } from './vat-validator';
import {
  TaxCalculationRequest,
  TaxCalculationResult,
  TaxRate,
  TaxJurisdiction,
  TransactionType,
  TaxEvidence,
  INVOICE_NOTES
} from './types';

/**
 * Tax rate database (in production, this would be a real database)
 * Sample rates - in production, load from database
 */
const TAX_RATES: Map<string, TaxRate> = new Map([
  // EU Member States standard VAT rates
  ['AT', { id: 'AT-STD', countryCode: 'AT', rate: 0.20, effectiveDate: new Date('2024-01-01'), appliesToDigitalServices: true }],
  ['BE', { id: 'BE-STD', countryCode: 'BE', rate: 0.21, effectiveDate: new Date('2024-01-01'), appliesToDigitalServices: true }],
  ['BG', { id: 'BG-STD', countryCode: 'BG', rate: 0.20, effectiveDate: new Date('2024-01-01'), appliesToDigitalServices: true }],
  ['CY', { id: 'CY-STD', countryCode: 'CY', rate: 0.19, effectiveDate: new Date('2024-01-01'), appliesToDigitalServices: true }],
  ['CZ', { id: 'CZ-STD', countryCode: 'CZ', rate: 0.21, effectiveDate: new Date('2024-01-01'), appliesToDigitalServices: true }],
  ['DE', { id: 'DE-STD', countryCode: 'DE', rate: 0.19, effectiveDate: new Date('2024-01-01'), appliesToDigitalServices: true }],
  ['DK', { id: 'DK-STD', countryCode: 'DK', rate: 0.25, effectiveDate: new Date('2024-01-01'), appliesToDigitalServices: true }],
  ['EE', { id: 'EE-STD', countryCode: 'EE', rate: 0.22, effectiveDate: new Date('2024-01-01'), appliesToDigitalServices: true }],
  ['EL', { id: 'EL-STD', countryCode: 'EL', rate: 0.24, effectiveDate: new Date('2024-01-01'), appliesToDigitalServices: true }],
  ['ES', { id: 'ES-STD', countryCode: 'ES', rate: 0.21, effectiveDate: new Date('2024-01-01'), appliesToDigitalServices: true }],
  ['FI', { id: 'FI-STD', countryCode: 'FI', rate: 0.255, effectiveDate: new Date('2024-01-01'), appliesToDigitalServices: true }],
  ['FR', { id: 'FR-STD', countryCode: 'FR', rate: 0.20, effectiveDate: new Date('2024-01-01'), appliesToDigitalServices: true }],
  ['HR', { id: 'HR-STD', countryCode: 'HR', rate: 0.25, effectiveDate: new Date('2024-01-01'), appliesToDigitalServices: true }],
  ['HU', { id: 'HU-STD', countryCode: 'HU', rate: 0.27, effectiveDate: new Date('2024-01-01'), appliesToDigitalServices: true }],
  ['IE', { id: 'IE-STD', countryCode: 'IE', rate: 0.23, effectiveDate: new Date('2024-01-01'), appliesToDigitalServices: true }],
  ['IT', { id: 'IT-STD', countryCode: 'IT', rate: 0.22, effectiveDate: new Date('2024-01-01'), appliesToDigitalServices: true }],
  ['LT', { id: 'LT-STD', countryCode: 'LT', rate: 0.21, effectiveDate: new Date('2024-01-01'), appliesToDigitalServices: true }],
  ['LU', { id: 'LU-STD', countryCode: 'LU', rate: 0.17, effectiveDate: new Date('2024-01-01'), appliesToDigitalServices: true }],
  ['LV', { id: 'LV-STD', countryCode: 'LV', rate: 0.21, effectiveDate: new Date('2024-01-01'), appliesToDigitalServices: true }],
  ['MT', { id: 'MT-STD', countryCode: 'MT', rate: 0.18, effectiveDate: new Date('2024-01-01'), appliesToDigitalServices: true }],
  ['NL', { id: 'NL-STD', countryCode: 'NL', rate: 0.21, effectiveDate: new Date('2024-01-01'), appliesToDigitalServices: true }],
  ['PL', { id: 'PL-STD', countryCode: 'PL', rate: 0.23, effectiveDate: new Date('2024-01-01'), appliesToDigitalServices: true }],
  ['PT', { id: 'PT-STD', countryCode: 'PT', rate: 0.23, effectiveDate: new Date('2024-01-01'), appliesToDigitalServices: true }],
  ['RO', { id: 'RO-STD', countryCode: 'RO', rate: 0.19, effectiveDate: new Date('2024-01-01'), appliesToDigitalServices: true }],
  ['SE', { id: 'SE-STD', countryCode: 'SE', rate: 0.25, effectiveDate: new Date('2024-01-01'), appliesToDigitalServices: true }],
  ['SI', { id: 'SI-STD', countryCode: 'SI', rate: 0.22, effectiveDate: new Date('2024-01-01'), appliesToDigitalServices: true }],
  ['SK', { id: 'SK-STD', countryCode: 'SK', rate: 0.20, effectiveDate: new Date('2024-01-01'), appliesToDigitalServices: true }],
  ['XI', { id: 'XI-STD', countryCode: 'XI', rate: 0.20, effectiveDate: new Date('2024-01-01'), appliesToDigitalServices: true }], // Northern Ireland
]);

/**
 * Calculator configuration
 */
interface TaxCalculatorConfig {
  enableViesValidation: boolean;
  enableEvidenceStorage: boolean;
  defaultJurisdiction: TaxJurisdiction;
}

/**
 * Tax Calculator Service
 */
export class TaxCalculator {
  private locationResolver: LocationResolver;
  private vatValidator: VatValidator;
  private config: TaxCalculatorConfig;
  private evidenceStore: Map<string, TaxEvidence> = new Map();

  /**
   * Create a new TaxCalculator instance
   * @param locationResolver - Optional location resolver
   * @param vatValidator - Optional VAT validator
   * @param config - Optional configuration
   */
  constructor(
    locationResolver?: LocationResolver,
    vatValidator?: VatValidator,
    config?: Partial<TaxCalculatorConfig>
  ) {
    this.locationResolver = locationResolver || new LocationResolver(vatValidator);
    this.vatValidator = vatValidator || new VatValidator();
    this.config = {
      enableViesValidation: config?.enableViesValidation ?? true,
      enableEvidenceStorage: config?.enableEvidenceStorage ?? true,
      defaultJurisdiction: config?.defaultJurisdiction ?? TaxJurisdiction.NONE
    };
  }

  /**
   * Initialize the calculator
   */
  async initialize(): Promise<void> {
    await this.locationResolver.initialize();
  }

  /**
   * Calculate tax for a transaction
   * @param request - Tax calculation request
   * @returns Tax calculation result
   */
  async calculateTax(request: TaxCalculationRequest): Promise<TaxCalculationResult> {
    try {
      // Validate request
      this.validateRequest(request);

      // Resolve buyer location
      const buyerLocation = await this.locationResolver.resolveLocation({
        countryCode: request.buyerCountry,
        vatNumber: request.buyerVatNumber,
        ipAddress: request.buyerIpAddress,
        ...request.buyerBillingAddress
      });

      // Determine jurisdiction
      const jurisdiction = this.locationResolver.getJurisdiction(buyerLocation.countryCode);

      // Handle based on jurisdiction
      switch (jurisdiction) {
        case TaxJurisdiction.EU:
          return this.calculateEUTax(request, buyerLocation);
        
        case TaxJurisdiction.US:
          return this.calculateUSTax(request, buyerLocation);
        
        default:
          return this.calculateNoTax(request, buyerLocation);
      }
    } catch (error) {
      return this.createErrorResult(
        error instanceof Error ? error.message : 'Unknown error',
        request
      );
    }
  }

  /**
   * Calculate EU VAT
   * Applies B2B reverse charge or B2C VAT rules
   */
  private async calculateEUTax(
    request: TaxCalculationRequest,
    buyerLocation: { countryCode: string; method: string; vatNumber?: string; isValidVat?: boolean }
  ): Promise<TaxCalculationResult> {
    // Check if this is B2B with valid VAT number (reverse charge)
    if (request.transactionType === TransactionType.B2B && request.buyerVatNumber) {
      // Validate VAT number if enabled
      if (this.config.enableViesValidation) {
        const countryCode = request.buyerVatNumber.substring(0, 2).toUpperCase();
        const vatNumber = request.buyerVatNumber.substring(2);
        
        const { result: vatResult, evidenceId: validationEvidenceId } = 
          await this.vatValidator.validateVat(countryCode, vatNumber, request.buyerIpAddress);

        if (vatResult.isValid) {
          // Reverse charge applies - 0% VAT
          return {
            success: true,
            amount: request.amount,
            taxAmount: 0,
            taxRate: 0,
            jurisdiction: TaxJurisdiction.EU,
            countryCode: buyerLocation.countryCode,
            reverseCharge: true,
            invoiceNote: INVOICE_NOTES.REVERSE_CHARGE,
            validationEvidenceId
          };
        }
      } else if (buyerLocation.isValidVat) {
        // If validation disabled but location resolved from VAT, apply reverse charge
        return {
          success: true,
          amount: request.amount,
          taxAmount: 0,
          taxRate: 0,
          jurisdiction: TaxJurisdiction.EU,
          countryCode: buyerLocation.countryCode,
          reverseCharge: true,
          invoiceNote: INVOICE_NOTES.REVERSE_CHARGE
        };
      }
    }

    // B2C or B2B without valid VAT - charge buyer's country VAT
    const taxRate = this.getTaxRate(buyerLocation.countryCode);
    const taxAmount = request.amount * taxRate.rate;
    const totalAmount = request.amount + taxAmount;

    // Store calculation evidence
    const calculationEvidenceId = await this.storeCalculationEvidence(
      request,
      buyerLocation.countryCode,
      taxRate.rate,
      taxAmount,
      false
    );

    return {
      success: true,
      amount: totalAmount,
      taxAmount,
      taxRate: taxRate.rate,
      jurisdiction: TaxJurisdiction.EU,
      countryCode: buyerLocation.countryCode,
      reverseCharge: false,
      invoiceNote: INVOICE_NOTES.B2C_VAT,
      calculationEvidenceId
    };
  }

  /**
   * Calculate US sales tax
   * Note: This is a placeholder for future US sales tax implementation
   */
  private calculateUSTax(
    request: TaxCalculationRequest,
    buyerLocation: { countryCode: string; state?: string }
  ): TaxCalculationResult {
    // Future implementation:
    // 1. Check economic nexus in buyer's state
    // 2. If nexus exists, apply state + local sales tax
    // 3. For digital services, check if state taxes digital goods

    // For now, return no tax (requires nexus setup)
    return {
      success: true,
      amount: request.amount,
      taxAmount: 0,
      taxRate: 0,
      jurisdiction: TaxJurisdiction.US,
      countryCode: 'US',
      state: buyerLocation.state,
      reverseCharge: false
    };
  }

  /**
   * Calculate for non-EU/US transactions (no tax)
   */
  private calculateNoTax(
    request: TaxCalculationRequest,
    buyerLocation: { countryCode: string }
  ): TaxCalculationResult {
    return {
      success: true,
      amount: request.amount,
      taxAmount: 0,
      taxRate: 0,
      jurisdiction: TaxJurisdiction.NONE,
      countryCode: buyerLocation.countryCode,
      reverseCharge: false,
      invoiceNote: INVOICE_NOTES.OUTSIDE_SCOPE
    };
  }

  /**
   * Get tax rate for a country
   */
  private getTaxRate(countryCode: string): TaxRate {
    const rate = TAX_RATES.get(countryCode.toUpperCase());
    
    if (!rate) {
      throw new Error(`No tax rate found for country: ${countryCode}`);
    }

    return rate;
  }

  /**
   * Validate tax calculation request
   */
  private validateRequest(request: TaxCalculationRequest): void {
    if (!request.sellerCountry) {
      throw new Error('Seller country is required');
    }

    if (!request.buyerCountry) {
      throw new Error('Buyer country is required');
    }

    if (request.amount < 0) {
      throw new Error('Amount cannot be negative');
    }

    if (!Object.values(TransactionType).includes(request.transactionType)) {
      throw new Error('Invalid transaction type');
    }

    // Validate EU country codes
    const euCountries = Array.from(TAX_RATES.keys());
    if (!euCountries.includes(request.sellerCountry.toUpperCase()) && 
        request.sellerCountry !== 'US') {
      console.warn(`Seller country ${request.sellerCountry} may not be supported`);
    }
  }

  /**
   * Store calculation evidence
   */
  private async storeCalculationEvidence(
    request: TaxCalculationRequest,
    taxCountry: string,
    taxRate: number,
    taxAmount: number,
    reverseCharge: boolean
  ): Promise<string> {
    const evidence: TaxEvidence = {
      id: uuidv4(),
      type: 'TAX_CALCULATION',
      buyerCountry: taxCountry,
      sellerCountry: request.sellerCountry,
      buyerVatNumber: request.buyerVatNumber,
      ipAddress: request.buyerIpAddress,
      evidence: {
        transactionType: request.transactionType,
        amount: request.amount,
        taxRate,
        taxAmount,
        reverseCharge,
        productType: request.productType,
        isDigitalService: request.isDigitalService,
        timestamp: request.timestamp
      },
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 7 * 365 * 24 * 60 * 60 * 1000)
    };

    this.evidenceStore.set(evidence.id, evidence);
    return evidence.id;
  }

  /**
   * Create error result
   */
  private createErrorResult(error: string, request: TaxCalculationRequest): TaxCalculationResult {
    return {
      success: false,
      amount: request.amount,
      taxAmount: 0,
      taxRate: 0,
      jurisdiction: this.config.defaultJurisdiction,
      countryCode: request.buyerCountry,
      reverseCharge: false,
      error
    };
  }

  /**
   * Get all stored evidence
   */
  getEvidence(): TaxEvidence[] {
    return Array.from(this.evidenceStore.values());
  }

  /**
   * Get evidence by ID
   */
  getEvidenceById(id: string): TaxEvidence | undefined {
    return this.evidenceStore.get(id);
  }

  /**
   * Get tax rate for a country (public method)
   */
  getTaxRateForCountry(countryCode: string): TaxRate {
    return this.getTaxRate(countryCode);
  }

  /**
   * Check if a country is in the EU
   */
  isEUCountry(countryCode: string): boolean {
    return this.locationResolver.isEUCountry(countryCode);
  }
}

/**
 * Default calculator instance
 */
let defaultCalculator: TaxCalculator | null = null;

/**
 * Get or create default calculator
 */
export function getTaxCalculator(): TaxCalculator {
  if (!defaultCalculator) {
    defaultCalculator = new TaxCalculator();
  }
  return defaultCalculator;
}

export default TaxCalculator;
