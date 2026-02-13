/**
 * Location Resolver Service
 * 
 * Determines buyer location from multiple sources:
 * 1. VAT number (via VIES) - highest confidence
 * 2. Billing address - medium confidence
 * 3. IP geolocation - lowest confidence
 */

import { v4 as uuidv4 } from 'uuid';
import { VatValidator } from './vat-validator';
import {
  BuyerLocation,
  LocationResolutionResult,
  TaxEvidence,
  TaxJurisdiction
} from './types';

/**
 * Geolocation result from IP lookup
 */
interface GeoLocationResult {
  countryCode: string;
  state?: string;
  city?: string;
  postalCode?: string;
  confidence: number;
}

/**
 * Location resolver configuration
 */
interface LocationResolverConfig {
  defaultCountry: string;
  enableVatValidation: boolean;
  enableIpGeolocation: boolean;
  confidenceThresholds: {
    vatNumber: number;
    billingAddress: number;
    ipGeolocation: number;
  };
}

const DEFAULT_CONFIG: LocationResolverConfig = {
  defaultCountry: 'DE',
  enableVatValidation: true,
  enableIpGeolocation: true,
  confidenceThresholds: {
    vatNumber: 1.0,
    billingAddress: 0.8,
    ipGeolocation: 0.5
  }
};

/**
 * Location resolver service
 */
export class LocationResolver {
  private vatValidator: VatValidator;
  private config: LocationResolverConfig;
  private evidenceStore: Map<string, TaxEvidence> = new Map();

  /**
   * Create a new LocationResolver instance
   * @param vatValidator - Optional VAT validator instance
   * @param config - Optional configuration
   */
  constructor(vatValidator?: VatValidator, config?: Partial<LocationResolverConfig>) {
    this.vatValidator = vatValidator || new VatValidator();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Initialize the resolver
   */
  async initialize(): Promise<void> {
    await this.vatValidator.initialize();
  }

  /**
   * Resolve buyer location using multiple methods
   * @param location - Initial buyer location information
   * @returns Resolved location with method and confidence
   */
  async resolveLocation(location: BuyerLocation): Promise<LocationResolutionResult> {
    const methods: Array<{
      method: LocationResolutionResult['method'];
      fn: () => Promise<LocationResolutionResult | null>;
      priority: number;
    }> = [];

    // Priority 1: VAT number validation
    if (location.vatNumber && this.config.enableVatValidation) {
      methods.push({
        method: 'VAT_NUMBER',
        fn: () => this.resolveFromVatNumber(location.vatNumber!, location.countryCode),
        priority: 1
      });
    }

    // Priority 2: Billing address
    if (location.countryCode) {
      methods.push({
        method: 'BILLING_ADDRESS',
        fn: () => this.resolveFromBillingAddress(location),
        priority: 2
      });
    }

    // Priority 3: IP geolocation
    if (location.ipAddress && this.config.enableIpGeolocation) {
      methods.push({
        method: 'IP_GEOLOCATION',
        fn: () => this.resolveFromIp(location.ipAddress!),
        priority: 3
      });
    }

    // Sort by priority and try each method
    methods.sort((a, b) => a.priority - b.priority);

    for (const method of methods) {
      try {
        const result = await method.fn();
        if (result && result.resolved) {
          // Store evidence
          await this.storeEvidence(location, result);
          return result;
        }
      } catch (error) {
        console.error(`Error resolving from ${method.method}:`, error);
        // Continue to next method
      }
    }

    // Fallback to default country
    return {
      resolved: false,
      countryCode: this.config.defaultCountry,
      method: 'DEFAULT',
      confidence: 0
    };
  }

  /**
   * Resolve location from VAT number via VIES
   */
  private async resolveFromVatNumber(
    vatNumber: string,
    providedCountry?: string
  ): Promise<LocationResolutionResult | null> {
    try {
      // Extract country code from VAT number if not provided
      let countryCode = providedCountry;
      if (!countryCode && vatNumber.length >= 2) {
        countryCode = vatNumber.substring(0, 2).toUpperCase();
      }

      if (!countryCode) {
        return null;
      }

      // Remove country code from VAT number
      const vatNumberWithoutCountry = vatNumber.length > 2 
        ? vatNumber.substring(2) 
        : vatNumber;

      const { result, evidenceId } = await this.vatValidator.validateVat(
        countryCode,
        vatNumberWithoutCountry
      );

      if (result.isValid) {
        return {
          resolved: true,
          countryCode: result.countryCode,
          method: 'VAT_NUMBER',
          vatNumber: result.vatNumber,
          isValidVat: true,
          confidence: this.config.confidenceThresholds.vatNumber
        };
      }

      // VAT invalid, but still use the country code
      return {
        resolved: true,
        countryCode: result.countryCode,
        method: 'VAT_NUMBER',
        vatNumber: result.vatNumber,
        isValidVat: false,
        confidence: 0.3 // Lower confidence for invalid VAT
      };
    } catch (error) {
      console.error('VAT validation error:', error);
      return null;
    }
  }

  /**
   * Resolve location from billing address
   */
  private async resolveFromBillingAddress(
    location: BuyerLocation
  ): Promise<LocationResolutionResult | null> {
    const { countryCode, state, city, postalCode } = location;

    if (!countryCode) {
      return null;
    }

    // Validate country code format
    if (!/^[A-Z]{2}$/.test(countryCode.toUpperCase())) {
      return null;
    }

    return {
      resolved: true,
      countryCode: countryCode.toUpperCase(),
      state,
      method: 'BILLING_ADDRESS',
      confidence: this.config.confidenceThresholds.billingAddress
    };
  }

  /**
   * Resolve location from IP address
   * Note: In production, integrate with a geolocation service like MaxMind
   */
  private async resolveFromIp(ipAddress: string): Promise<LocationResolutionResult | null> {
    try {
      // In production, use a geolocation service
      // This is a placeholder implementation
      const geoResult = await this.lookupIpGeolocation(ipAddress);

      if (geoResult) {
        return {
          resolved: true,
          countryCode: geoResult.countryCode,
          state: geoResult.state,
          method: 'IP_GEOLOCATION',
          confidence: this.config.confidenceThresholds.ipGeolocation
        };
      }
    } catch (error) {
      console.error('IP geolocation error:', error);
    }

    return null;
  }

  /**
   * IP geolocation lookup
   * Placeholder for actual implementation with MaxMind or similar
   */
  private async lookupIpGeolocation(ipAddress: string): Promise<GeoLocationResult | null> {
    // In production, integrate with:
    // - MaxMind GeoIP2
    // - IPinfo
    // - ip-api.com
    // - etc.

    // For now, return null to indicate lookup failed
    // Real implementation would call external service
    
    /* Example implementation with ip-api.com:
    try {
      const response = await axios.get(
        `http://ip-api.com/json/${ipAddress}?fields=status,countryCode,regionName,city,zip`
      );
      
      if (response.data.status === 'success') {
        return {
          countryCode: response.data.countryCode,
          state: response.data.regionName,
          city: response.data.city,
          postalCode: response.data.zip,
          confidence: 0.5
        };
      }
    } catch (error) {
      console.error('IP geolocation API error:', error);
    }
    */

    return null;
  }

  /**
   * Store location resolution evidence
   */
  private async storeEvidence(
    originalLocation: BuyerLocation,
    resolved: LocationResolutionResult
  ): Promise<string> {
    const evidence: TaxEvidence = {
      id: uuidv4(),
      type: 'LOCATION_RESOLUTION',
      buyerCountry: resolved.countryCode,
      sellerCountry: '',
      buyerVatNumber: resolved.vatNumber,
      ipAddress: originalLocation.ipAddress,
      evidence: {
        originalCountry: originalLocation.countryCode,
        resolvedCountry: resolved.countryCode,
        method: resolved.method,
        confidence: resolved.confidence,
        state: resolved.state,
        isValidVat: resolved.isValidVat
      },
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 7 * 365 * 24 * 60 * 60 * 1000)
    };

    this.evidenceStore.set(evidence.id, evidence);
    return evidence.id;
  }

  /**
   * Get jurisdiction based on country code
   */
  getJurisdiction(countryCode: string): TaxJurisdiction {
    const euCountries = [
      'AT', 'BE', 'BG', 'CY', 'CZ', 'DE', 'DK', 'EE', 'EL', 'ES',
      'FI', 'FR', 'HR', 'HU', 'IE', 'IT', 'LT', 'LU', 'LV', 'MT',
      'NL', 'PL', 'PT', 'RO', 'SE', 'SI', 'SK', 'XI' // XI = UK (Northern Ireland)
    ];

    const usStates = [
      'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
      'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
      'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
      'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
      'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC'
    ];

    if (euCountries.includes(countryCode.toUpperCase())) {
      return TaxJurisdiction.EU;
    }

    if (usStates.includes(countryCode.toUpperCase())) {
      return TaxJurisdiction.US;
    }

    return TaxJurisdiction.NONE;
  }

  /**
   * Check if country is in EU
   */
  isEUCountry(countryCode: string): boolean {
    return this.getJurisdiction(countryCode) === TaxJurisdiction.EU;
  }

  /**
   * Check if country is in US
   */
  isUSCountry(countryCode: string): boolean {
    return this.getJurisdiction(countryCode) === TaxJurisdiction.US;
  }

  /**
   * Get stored evidence
   */
  getEvidence(): TaxEvidence[] {
    return Array.from(this.evidenceStore.values());
  }
}

/**
 * Default location resolver instance
 */
let defaultResolver: LocationResolver | null = null;

/**
 * Get or create default location resolver
 */
export function getLocationResolver(): LocationResolver {
  if (!defaultResolver) {
    defaultResolver = new LocationResolver();
  }
  return defaultResolver;
}

export default LocationResolver;
