/**
 * VAT Validator Service
 * 
 * Handles validation of EU VAT numbers via the VIES API with Redis caching.
 * VIES validation results are cached for 30 days per EU regulations.
 */

import { ViesValidationResult, RedisClient, DatabaseClient } from './types';

export class VatValidator {
  private redis: RedisClient | null = null;
  private db: DatabaseClient | null = null;
  private readonly CACHE_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days
  private readonly CACHE_PREFIX = 'vat_validation:';

  constructor(redis?: RedisClient, db?: DatabaseClient) {
    this.redis = null ?? undefined;
    this.db = db ?? undefined;
  }

  /**
   * Validate a VAT number against the VIES database
   * 
   * @param vatNumber - The VAT number to validate (with or without country code)
   * @param countryCode - Optional country code if not part of VAT number
   * @returns Validation result from VIES
   */
  async validateVatNumber(
    vatNumber: string,
    countryCode?: string
  ): Promise<ViesValidationResult> {
    // Extract country code and normalize VAT number
    const normalized = this.normalizeVatNumber(vatNumber, countryCode);
    
    if (!normalized.countryCode || !normalized.vatNumber) {
      throw new Error('Invalid VAT number format');
    }

    // Check cache first
    const cached = await this.getFromCache(normalized.countryCode, normalized.vatNumber);
    if (cached) {
      return cached;
    }

    // Call VIES API
    const result = await this.callViesApi(normalized.countryCode, normalized.vatNumber);

    // Cache the result
    await this.setCache(normalized.countryCode, normalized.vatNumber, result);

    return result;
  }

  /**
   * Normalize VAT number by extracting country code
   */
  private normalizeVatNumber(
    vatNumber: string,
    countryCode?: string
  ): { countryCode: string; vatNumber: string } {
    // Remove spaces and special characters
    const cleaned = vatNumber.replace(/[\s\-\.]/g, '').toUpperCase();

    // If no country code provided, try to extract from VAT number
    if (!countryCode && cleaned.length >= 2) {
      const potentialCountryCode = cleaned.substring(0, 2);
      if (this.isValidEuCountryCode(potentialCountryCode)) {
        return {
          countryCode: potentialCountryCode,
          vatNumber: cleaned.substring(2),
        };
      }
    }

    return {
      countryCode: countryCode?.toUpperCase() || '',
      vatNumber: cleaned,
    };
  }

  /**
   * Check if a country code is a valid EU member state
   */
  private isValidEuCountryCode(code: string): boolean {
    const euCountryCodes = [
      'AT', // Austria
      'BE', // Belgium
      'BG', // Bulgaria
      'CY', // Cyprus
      'CZ', // Czech Republic
      'DE', // Germany
      'DK', // Denmark
      'EE', // Estonia
      'EL', // Greece
      'ES', // Spain
      'FI', // Finland
      'FR', // France
      'HR', // Croatia
      'HU', // Hungary
      'IE', // Ireland
      'IT', // Italy
      'LT', // Lithuania
      'LU', // Luxembourg
      'LV', // Latvia
      'MT', // Malta
      'NL', // Netherlands
      'PL', // Poland
      'PT', // Portugal
      'RO', // Romania
      'SE', // Sweden
      'SI', // Slovenia
      'SK', // Slovakia
      'XI', // Northern Ireland (special case)
    ];
    return euCountryCodes.includes(code);
  }

  /**
   * Call the VIES SOAP API
   */
  private async callViesApi(
    countryCode: string,
    vatNumber: string
  ): Promise<ViesValidationResult> {
    // VIES SOAP service URL
    const viesUrl = 'https://ec.europa.eu/taxation_customs/vies/services/checkVatService';

    const soapRequest = `<?xml version="1.0" encoding="UTF-8"?>
      <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
                     xmlns:tns1="urn:ec:vat:check">
        <soap:Header>
          <tns1:checkVatHeader>
            <tns1:countryCode>${countryCode}</tns1:countryCode>
            <tns1:vatNumber>${vatNumber}</tns1:vatNumber>
          </tns1:checkVatHeader>
        </soap:Header>
        <soap:Body>
          <tns1:checkVat>
            <tns1:countryCode>${countryCode}</tns1:countryCode>
            <tns1:vatNumber>${vatNumber}</tns1:vatNumber>
          </tns1:checkVat>
        </soap:Body>
      </soap:Envelope>`;

    try {
      const response = await fetch(viesUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          'SOAPAction': '',
        },
        body: soapRequest,
      });

      if (!response.ok) {
        throw new Error(`VIES API error: ${response.status} ${response.statusText}`);
      }

      const responseText = await response.text();
      return this.parseViesResponse(responseText, countryCode, vatNumber);
    } catch (error) {
      // Log error but don't expose internal details
      console.error('VIES API call failed:', error instanceof Error ? error.message : 'Unknown error');
      
      // Return a valid but failed validation result
      // This allows the system to continue with reverse charge = false
      return {
        valid: false,
        countryCode,
        vatNumber,
        requestDate: new Date().toISOString().split('T')[0],
        validFormat: false,
        showRequest: false,
      };
    }
  }

  /**
   * Parse the VIES SOAP response
   */
  private parseViesResponse(
    response: string,
    countryCode: string,
    vatNumber: string
  ): ViesValidationResult {
    // Simple XML parsing without external dependencies
    const getValue = (tag: string): string => {
      const regex = new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, 'i');
      const match = response.match(regex);
      return match ? match[1].trim() : '';
    };

    const isValid = getValue('valid').toLowerCase() === 'true';
    const name = getValue('name') || getValue('traderName');
    const address = getValue('address') || getValue('traderAddress');

    return {
      valid: isValid,
      countryCode,
      vatNumber,
      name: name || undefined,
      companyAddress: address || undefined,
      requestDate: new Date().toISOString().split('T')[0],
      validFormat: getValue('validFormat').toLowerCase() === 'true',
      showRequest: getValue('showRequest').toLowerCase() === 'true',
      traderName: name || undefined,
      traderAddress: address || undefined,
    };
  }

  /**
   * Get cached validation result from Redis
   */
  private async getFromCache(
    countryCode: string,
    vatNumber: string
  ): Promise<ViesValidationResult | null> {
    if (!this.redis) {
      return null;
    }

    try {
      const key = this.getCacheKey(countryCode, vatNumber);
      const cached = await this.redis.get(key);
      
      if (cached) {
        return JSON.parse(cached) as ViesValidationResult;
      }
    } catch (error) {
      console.error('Redis get error:', error instanceof Error ? error.message : 'Unknown error');
    }

    return null;
  }

  /**
   * Cache validation result in Redis
   */
  private async setCache(
    countryCode: string,
    vatNumber: string,
    result: ViesValidationResult
  ): Promise<void> {
    if (!this.redis) {
      return;
    }

    try {
      const key = this.getCacheKey(countryCode, vatNumber);
      await this.redis.setex(
        key,
        this.CACHE_TTL_SECONDS,
        JSON.stringify(result)
      );
    } catch (error) {
      console.error('Redis set error:', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Generate cache key for VAT validation
   */
  private getCacheKey(countryCode: string, vatNumber: string): string {
    return `${this.CACHE_PREFIX}${countryCode}${vatNumber}`.toUpperCase();
  }

  /**
   * Store validation evidence in database
   */
  async storeEvidence(
    orderId: string,
    vatNumber: string,
    countryCode: string,
    isValid: boolean,
    validationMethod: 'vat_number' | 'billing_address' | 'ip_geolocation'
  ): Promise<void> {
    if (!this.db) {
      console.warn('Database not configured, skipping evidence storage');
      return;
    }

    try {
      await this.db.insert('tax_evidence', {
        order_id: orderId,
        buyer_vat_number: vatNumber,
        buyer_country: countryCode,
        vat_valid: isValid,
        vat_validation_timestamp: new Date(),
        validation_method: validationMethod,
        evidence_timestamp: new Date(),
      });
    } catch (error) {
      console.error('Failed to store tax evidence:', error instanceof Error ? error.message : 'Unknown error');
      // Don't throw - evidence storage failure shouldn't block the transaction
    }
  }
}

export default VatValidator;
