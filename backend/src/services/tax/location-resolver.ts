/**
 * Location Resolver Service
 * 
 * Determines buyer location using VAT number (via VIES), billing address,
 * or IP geolocation as fallback.
 */

import { Address, BuyerInfo, ViesValidationResult, TaxEvidence } from './types';
import { VatValidator } from './vat-validator';

export interface ResolvedLocation {
  country: string;
  state?: string;
  validationMethod: 'vat_number' | 'billing_address' | 'ip_geolocation';
  isValidVat: boolean;
  vatNumber?: string;
  evidence: Partial<TaxEvidence>;
}

export interface LocationResolverConfig {
  vatValidator: VatValidator;
  ipLookupService?: (ip: string) => Promise<string | null>;
}

export class LocationResolver {
  private vatValidator: VatValidator;
  private ipLookupService?: (ip: string) => Promise<string | null>;

  constructor(config: LocationResolverConfig) {
    this.vatValidator = config.vatValidator;
    this.ipLookupService = config.ipLookupService;
  }

  /**
   * Resolve buyer location using multiple methods in priority order:
   * 1. VAT number (via VIES) - most reliable for B2B
   * 2. Billing address - primary address
   * 3. IP geolocation - fallback
   * 
   * @param buyerInfo - Buyer information including VAT number, address, IP
   * @param orderId - Order ID for evidence tracking
   * @returns Resolved location with validation method
   */
  async resolveLocation(
    buyerInfo: BuyerInfo,
    orderId: string
  ): Promise<ResolvedLocation> {
    // Method 1: Try VAT number validation
    if (buyerInfo.vatNumber) {
      try {
        const vatResult = await this.validateVatAndGetLocation(
          buyerInfo.vatNumber,
          buyerInfo.address.country,
          orderId
        );

        if (vatResult) {
          return vatResult;
        }
      } catch (error) {
        console.error('VAT validation failed:', error instanceof Error ? error.message : 'Unknown error');
        // Continue to next method
      }
    }

    // Method 2: Use billing address country
    if (buyerInfo.address?.country) {
      const validCountry = this.validateCountryCode(buyerInfo.address.country);
      
      if (validCountry) {
        const evidence: Partial<TaxEvidence> = {
          orderId,
          billingAddressCountry: validCountry,
          resolvedCountry: validCountry,
          validationMethod: 'billing_address',
          evidenceTimestamp: new Date(),
          buyerCountry: validCountry,
        };

        return {
          country: validCountry,
          state: buyerInfo.address.state,
          validationMethod: 'billing_address',
          isValidVat: false,
          evidence,
        };
      }
    }

    // Method 3: IP geolocation fallback
    if (buyerInfo.ipAddress) {
      const ipCountry = await this.lookupIpCountry(buyerInfo.ipAddress);
      
      if (ipCountry) {
        const evidence: Partial<TaxEvidence> = {
          orderId,
          ipCountry,
          resolvedCountry: ipCountry,
          validationMethod: 'ip_geolocation',
          evidenceTimestamp: new Date(),
          buyerCountry: ipCountry,
        };

        return {
          country: ipCountry,
          state: buyerInfo.state,
          validationMethod: 'ip_geolocation',
          isValidVat: false,
          evidence,
        };
      }
    }

    // Ultimate fallback - use billing address if available
    const fallbackCountry = buyerInfo.address?.country || 'UNKNOWN';
    
    const evidence: Partial<TaxEvidence> = {
      orderId,
      billingAddressCountry: fallbackCountry,
      resolvedCountry: fallbackCountry,
      validationMethod: 'billing_address',
      evidenceTimestamp: new Date(),
      buyerCountry: fallbackCountry,
    };

    return {
      country: fallbackCountry,
      state: buyerInfo.address?.state,
      validationMethod: 'billing_address',
      isValidVat: false,
      evidence,
    };
  }

  /**
   * Validate VAT number and extract country from VIES response
   */
  private async validateVatAndGetLocation(
    vatNumber: string,
    addressCountry?: string,
    orderId?: string
  ): Promise<ResolvedLocation | null> {
    try {
      const result = await this.vatValidator.validateVatNumber(vatNumber, addressCountry);

      if (result.valid) {
        // Extract country from VAT number itself (first 2 characters)
        const vatCountryCode = this.extractCountryFromVat(vatNumber);

        const evidence: Partial<TaxEvidence> = {
          orderId,
          buyerVatNumber: vatNumber,
          buyerCountry: vatCountryCode || result.countryCode,
          vatValid: true,
          vatValidationTimestamp: new Date(),
          resolvedCountry: vatCountryCode || result.countryCode,
          validationMethod: 'vat_number',
          evidenceTimestamp: new Date(),
        };

        return {
          country: vatCountryCode || result.countryCode,
          validationMethod: 'vat_number',
          isValidVat: true,
          vatNumber,
          evidence,
        };
      }
    } catch (error) {
      console.error('VAT validation error:', error instanceof Error ? error.message : 'Unknown error');
    }

    return null;
  }

  /**
   * Extract country code from VAT number
   */
  private extractCountryFromVat(vatNumber: string): string | null {
    const cleaned = vatNumber.replace(/[\s\-\.]/g, '').toUpperCase();
    
    if (cleaned.length >= 2) {
      const potentialCode = cleaned.substring(0, 2);
      if (this.validateCountryCode(potentialCode)) {
        return potentialCode;
      }
    }

    return null;
  }

  /**
   * Validate if a country code is valid ISO 3166-1 alpha-2
   */
  private validateCountryCode(code: string): string | null {
    const validCodes = new Set([
      'AT', 'BE', 'BG', 'CY', 'CZ', 'DE', 'DK', 'EE', 'EL', 'ES',
      'FI', 'FR', 'HR', 'HU', 'IE', 'IT', 'LT', 'LU', 'LV', 'MT',
      'NL', 'PL', 'PT', 'RO', 'SE', 'SI', 'SK', 'XI', // EU + XI (Northern Ireland)
      'US', 'CA', 'GB', // Other common countries
    ]);
    
    const upperCode = code.toUpperCase();
    return validCodes.has(upperCode) ? upperCode : null;
  }

  /**
   * Lookup country by IP address
   */
  private async lookupIpCountry(ipAddress: string): Promise<string | null> {
    if (!this.ipLookupService) {
      // Default to null if no IP service configured
      return null;
    }

    try {
      // Skip private/local IP ranges
      if (this.isPrivateIp(ipAddress)) {
        return null;
      }

      const country = await this.ipLookupService(ipAddress);
      return country ? this.validateCountryCode(country) : null;
    } catch (error) {
      console.error('IP lookup failed:', error instanceof Error ? error.message : 'Unknown error');
      return null;
    }
  }

  /**
   * Check if IP is private/local
   */
  private isPrivateIp(ip: string): boolean {
    const parts = ip.split('.').map(Number);
    
    // 10.0.0.0/8
    if (parts[0] === 10) return true;
    
    // 172.16.0.0/12
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    
    // 192.168.0.0/16
    if (parts[0] === 192 && parts[1] === 168) return true;
    
    // localhost
    if (ip === '127.0.0.1' || ip === '::1') return true;
    
    return false;
  }
}

export default LocationResolver;
