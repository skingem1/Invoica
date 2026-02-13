/**
 * VAT Validator Service Tests
 * 
 * Test suite for VIES API integration and Redis caching.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { VatValidator } from '../../src/services/tax/vat-validator';
import { ViesValidationResult } from '../../src/services/tax/types';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock Redis client
const createMockRedis = () => ({
  get: vi.fn(),
  setex: vi.fn(),
  del: vi.fn(),
});

// Mock database client
const createMockDb = () => ({
  query: vi.fn(),
  insert: vi.fn(),
});

describe('VatValidator', () => {
  let validator: VatValidator;
  let mockRedis: ReturnType<typeof createMockRedis>;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    mockRedis = createMockRedis();
    mockDb = createMockDb();
    validator = new VatValidator(mockRedis, mockDb);
    vi.clearAllMocks();
  });

  describe('VAT Number Validation', () => {
    it('should validate a valid German VAT number', async () => {
      // Arrange
      const mockResponse = `<?xml version="1.0" encoding="UTF-8"?>
        <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
          <soap:Body>
            <checkVatResponse>
              <countryCode>DE</countryCode>
              <vatNumber>123456789</vatNumber>
              <valid>true</valid>
              <name>Test Company GmbH</name>
              <address>Test Street 1, 12345 Berlin</address>
              <validFormat>true</validFormat>
              <showRequest>true</showRequest>
            </checkVatResponse>
          </soap:Body>
        </soap:Envelope>`;

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue(mockResponse),
      });

      // Act
      const result = await validator.validateVatNumber('DE123456789');

      // Assert
      expect(result.valid).toBe(true);
      expect(result.countryCode).toBe('DE');
      expect(result.vatNumber).toBe('123456789');
      expect(result.name).toBe('Test Company GmbH');
    });

    it('should return invalid for non-existent VAT number', async () => {
      // Arrange
      const mockResponse = `<?xml version="1.0" encoding="UTF-8"?>
        <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
          <soap:Body>
            <checkVatResponse>
              <countryCode>DE</countryCode>
              <vatNumber>999999999</vatNumber>
              <valid>false</valid>
              <validFormat>true</validFormat>
              <showRequest>true</showRequest>
            </checkVatResponse>
          </soap:Body>
        </soap:Envelope>`;

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue(mockResponse),
      });

      // Act
      const result = await validator.validateVatNumber('DE999999999');

      // Assert
      expect(result.valid).toBe(false);
      expect(result.countryCode).toBe('DE');
    });

    it('should extract country code from VAT number if not provided', async () => {
      // Arrange
      const mockResponse = `<?xml version="1.0" encoding="UTF-8"?>
        <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
          <soap:Body>
            <checkVatResponse>
              <countryCode>FR</countryCode>
              <vatNumber>12345678901</vatNumber>
              <valid>true</valid>
              <validFormat>true</validFormat>
              <showRequest>true</showRequest>
            </checkVatResponse>
          </soap:Body>
        </soap:Envelope>`;

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue(mockResponse),
      });

      // Act - Pass VAT number without country code
      const result = await validator.validateVatNumber('FR12345678901');

      // Assert
      expect(result.countryCode).toBe('FR');
      expect(mockFetch).toHaveBeenCalled();
    });

    it('should accept country code as separate parameter', async () => {
      // Arrange
      const mockResponse = `<?xml version="1.0" encoding="UTF-8"?>
        <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
          <soap:Body>
            <checkVatResponse>
              <countryCode>IT</countryCode>
              <vatNumber>12345678901</vatNumber>
              <valid>true</valid>
              <validFormat>true</validFormat>
              <showRequest>true</showRequest>
            </checkVatResponse>
          </soap:Body>
        </soap:Envelope>`;

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue(mockResponse),
      });

      // Act
      const result = await validator.validateVatNumber('12345678901', 'IT');

      // Assert
      expect(result.countryCode).toBe('IT');
    });
  });

  describe('VAT Number Normalization', () => {
    it('should handle VAT numbers with spaces', async () => {
      // Arrange
      const mockResponse = `<?xml version="1.0" encoding="UTF-8"?>
        <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
          <soap:Body>
            <checkVatResponse>
              <countryCode>DE</countryCode>
              <vatNumber>123456789</vatNumber>
              <valid>true</valid>
              <validFormat>true</validFormat>
              <showRequest>true</showRequest>
            </checkVatResponse>
          </soap:Body>
        </soap:Envelope>`;

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue(mockResponse),
      });

      // Act
      const result = await validator.validateVatNumber('DE 123 456 789');

      // Assert
      expect(result.countryCode).toBe('DE');
      expect(result.vatNumber).toBe('123456789');
    });

    it('should handle VAT numbers with dashes', async () => {
      // Arrange
      const mockResponse = `<?xml version="1.0" encoding="UTF-8"?>
        <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
          <soap:Body>
            <checkVatResponse>
              <countryCode>NL</countryCode>
              <vatNumber>123456789B01</vatNumber>
              <valid>true</valid>
              <validFormat>true</validFormat>
              <showRequest>true</showRequest>
            </checkVatResponse>
          </soap:Body>
        </soap:Envelope>`;

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue(mockResponse),
      });

      // Act
      const result = await validator.validateVatNumber('NL-123456789-B01');

      // Assert
      expect(result.vatNumber).toBe('123456789B01');
    });

    it('should convert to uppercase', async () => {
      // Arrange
      const mockResponse = `<?xml version="1.0" encoding="UTF-8"?>
        <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
          <soap:Body>
            <checkVatResponse>
              <countryCode>FR</countryCode>
              <vatNumber>12345678901</vatNumber>
              <valid>true</valid>
              <validFormat>true</validFormat>
              <showRequest>true</showRequest>
            </checkVatResponse>
          </soap:Body>
        </soap:Envelope>`;

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue(mockResponse),
      });

      // Act
      const result = await validator.validateVatNumber('fr12345678901');

      // Assert
      expect(result.countryCode).toBe('FR');
    });
  });

  describe('Caching', () => {
    it('should return cached result if available in Redis', async () => {
      // Arrange
      const cachedResult: ViesValidationResult = {
        valid: true,
        countryCode: 'DE',
        vatNumber: '123456789',
        name: 'Cached Company',
        requestDate: '2024-01-01',
        validFormat: true,
        showRequest: true,
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(cachedResult));

      // Act
      const result = await validator.validateVatNumber('DE123456789');

      // Assert
      expect(result.valid).toBe(true);
      expect(result.name).toBe('Cached Company');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should cache new validation results', async () => {
      // Arrange
      const mockResponse = `<?xml version="1.0" encoding="UTF-8"?>
        <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
          <soap:Body>
            <checkVatResponse>
              <countryCode>DE</countryCode>
              <vatNumber>123456789</vatNumber>
              <valid>true</valid>
              <validFormat>true</validFormat>
              <showRequest>true</showRequest>
            </checkVatResponse>
          </soap:Body>
        </soap:Envelope>`;

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue(mockResponse),
      });

      mockRedis.get.mockResolvedValue(null);
      mockRedis.setex.mockResolvedValue(undefined);

      // Act
      await validator.validateVatNumber('DE123456789');

      // Assert
      expect(mockRedis.setex).toHaveBeenCalledWith(
        'vat_validation:DE123456789',
        30 * 24 * 60 * 60, // 30 days in seconds
        expect.any(String)
      );
    });

    it('should not use cache when Redis is not configured', async () => {
      // Arrange: Create validator without Redis
      const validatorNoRedis = new VatValidator(undefined, mockDb);

      const mockResponse = `<?xml version="1.0" encoding="UTF-8"?>
        <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
          <soap:Body>
            <checkVatResponse>
              <countryCode>DE</countryCode>
              <vatNumber>123456789</vatNumber>
              <valid>true</valid>
              <validFormat>true</validFormat>
              <showRequest>true</showRequest>
            </checkVatResponse>
          </soap:Body>
        </soap:Envelope>`;

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue(mockResponse),
      });

      // Act
      await validatorNoRedis.validateVatNumber('DE123456789');

      // Assert
      expect(mockFetch).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle VIES API timeout', async () => {
      // Arrange
      mockFetch.mockRejectedValue(new Error('Connection timeout'));

      // Act
      const result = await validator.validateVatNumber('DE123456789');

      // Assert - Should return valid: false instead of throwing
      expect(result.valid).toBe(false);
      expect(result.countryCode).toBe('DE');
    });

    it('should handle invalid VAT number format', async () => {
      // Act & Assert
      await expect(validator.validateVatNumber('')).rejects.toThrow('Invalid VAT number format');
    });

    it('should handle HTTP errors from VIES', async () => {
      // Arrange
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      // Act
      const result = await validator.validateVatNumber('DE123456789');

      // Assert
      expect(result.valid).toBe(false);
    });
  });

  describe('Evidence Storage', () => {
    it('should store validation evidence in database', async () => {
      // Arrange
      const mockResponse = `<?xml version="1.0" encoding="UTF-8"?>
        <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
          <soap:Body>
            <checkVatResponse>
              <countryCode>DE</countryCode>
              <vatNumber>123456789</vatNumber>
              <valid>true</valid>
              <validFormat>true</validFormat>
              <showRequest>true</showRequest>
            </checkVatResponse>
          </soap:Body>
        </soap:Envelope>`;

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue(mockResponse),
      });

      mockDb.insert.mockResolvedValue(1);

      // Act
      await validator.storeEvidence(
        'ORDER-001',
        'DE123456789',
        'DE',
        true,
        'vat_number'
      );

      // Assert
      expect(mockDb.insert).toHaveBeenCalledWith('tax_evidence', expect.objectContaining({
        order_id: 'ORDER-001',
        buyer_vat_number: 'DE123456789',
        buyer_country: 'DE',
        vat_valid: true,
        validation_method: 'vat_number',
      }));
    });

    it('should handle database storage errors gracefully', async () => {
      // Arrange - Database insert fails
      mockDb.insert.mockRejectedValue(new Error('Database error'));

      // Act & Assert - Should not throw
      await expect(
        validator.storeEvidence('ORDER-001', 'DE123456789', 'DE', true, 'vat_number')
      ).resolves.not.toThrow();
    });

    it('should skip storage when database is not configured', async () => {
      // Arrange
      const validatorNoDb = new VatValidator(mockRedis, undefined);

      // Act
      await validatorNoDb.storeEvidence('ORDER-001', 'DE123456789', 'DE', true, 'vat_number');

      // Assert - Should not call insert
      expect(mockDb.insert).not.toHaveBeenCalled();
    });
  });

  describe('Country Code Validation', () => {
    it('should validate valid EU country codes', async () => {
      const validCodes = ['AT', 'BE', 'DE', 'FR', 'IT', 'NL', 'ES', 'SE', 'XI'];

      for (const code of validCodes) {
        const mockResponse = `<?xml version="1.0" encoding="UTF-8"?>
          <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
            <soap:Body>
              <checkVatResponse>
                <countryCode>${code}</countryCode>
                <vatNumber>123456789</vatNumber>
                <valid>true</valid>
                <validFormat>true</validFormat>
                <showRequest>true</showRequest>
              </checkVatResponse>
            </soap:Body>
          </soap:Envelope>`;

        mockFetch.mockResolvedValue({
          ok: true,
          status: 200,
          text: vi.fn().mockResolvedValue(mockResponse),
        });

        const result = await validator.validateVatNumber(`${code}123456789`);
        expect(result.countryCode).toBe(code);
      }
    });
  });
});
