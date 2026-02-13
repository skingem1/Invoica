/**
 * Tax Calculator Service Tests
 * 
 * Comprehensive test suite for EU VAT and US sales tax calculations.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TaxCalculator } from '../../src/services/tax/calculator';
import { LocationResolver } from '../../src/services/tax/location-resolver';
import { VatValidator } from '../../src/services/tax/vat-validator';
import { BuyerInfo, SellerInfo, TaxCalculationResult } from '../../src/services/tax/types';

// Mock dependencies
const mockVatValidator = {
  validateVatNumber: vi.fn(),
  storeEvidence: vi.fn(),
} as unknown as VatValidator;

const mockLocationResolver = {
  resolveLocation: vi.fn(),
} as unknown as LocationResolver;

const mockGetTaxRate = vi.fn();
const mockStoreEvidence = vi.fn();

// Test configuration
const createCalculator = () => new TaxCalculator({
  locationResolver: mockLocationResolver,
  vatValidator: mockVatValidator,
  getTaxRate: mockGetTaxRate,
  storeEvidence: mockStoreEvidence,
});

describe('TaxCalculator', () => {
  let calculator: TaxCalculator;

  beforeEach(() => {
    calculator = createCalculator();
    vi.clearAllMocks();
  });

  describe('EU VAT B2B Reverse Charge', () => {
    const baseAmount = 1000;

    it('should apply reverse charge (0% VAT) for valid EU B2B with VAT number', async () => {
      // Arrange
      const buyer: BuyerInfo = {
        vatNumber: 'DE123456789',
        address: {
          line1: 'Test Street 1',
          city: 'Berlin',
          postalCode: '10115',
          country: 'DE',
        },
        entityType: 'business',
      };

      const seller: SellerInfo = {
        address: {
          line1: 'Seller Street 1',
          city: 'Paris',
          postalCode: '75001',
          country: 'FR',
        },
      };

      mockLocationResolver.resolveLocation.mockResolvedValue({
        country: 'DE',
        validationMethod: 'vat_number',
        isValidVat: true,
        vatNumber: 'DE123456789',
        evidence: {},
      });

      mockStoreEvidence.mockResolvedValue(undefined);

      // Act
      const result = await calculator.calculateTax(baseAmount, buyer, seller, 'ORDER-001');

      // Assert
      expect(result.taxAmount).toBe(0);
      expect(result.taxRate).toBe(0);
      expect(result.reverseCharge).toBe(true);
      expect(result.jurisdiction.type).toBe('eu_vat');
      expect(result.jurisdiction.country).toBe('DE');
      expect(result.invoiceNote).toContain('Reverse charge');
      expect(result.invoiceNote).toContain('Art. 196 Council Directive 2006/112/EC');
    });

    it('should apply reverse charge for valid VAT from different EU country', async () => {
      // Arrange
      const buyer: BuyerInfo = {
        vatNumber: 'NL123456789B01',
        address: {
          city: 'Amsterdam',
          postalCode: '1011',
          country: 'NL',
        },
        entityType: 'business',
      };

      const seller: SellerInfo = {
        address: {
          city: 'Munich',
          postalCode: '80331',
          country: 'DE',
        },
      };

      mockLocationResolver.resolveLocation.mockResolvedValue({
        country: 'NL',
        validationMethod: 'vat_number',
        isValidVat: true,
        vatNumber: 'NL123456789B01',
        evidence: {},
      });

      mockStoreEvidence.mockResolvedValue(undefined);

      // Act
      const result = await calculator.calculateTax(baseAmount, buyer, seller, 'ORDER-002');

      // Assert
      expect(result.taxAmount).toBe(0);
      expect(result.reverseCharge).toBe(true);
      expect(result.jurisdiction.country).toBe('NL');
    });

    it('should apply standard VAT for B2B without valid VAT number', async () => {
      // Arrange
      const buyer: BuyerInfo = {
        address: {
          city: 'Berlin',
          postalCode: '10115',
          country: 'DE',
        },
        entityType: 'business',
        // No VAT number
      };

      const seller: SellerInfo = {
        address: {
          city: 'Munich',
          postalCode: '80331',
          country: 'DE',
        },
      };

      mockLocationResolver.resolveLocation.mockResolvedValue({
        country: 'DE',
        validationMethod: 'billing_address',
        isValidVat: false,
        evidence: {},
      });

      mockStoreEvidence.mockResolvedValue(undefined);

      // Act
      const result = await calculator.calculateTax(baseAmount, buyer, seller, 'ORDER-003');

      // Assert
      expect(result.taxAmount).toBe(190); // 1000 * 19%
      expect(result.taxRate).toBe(19);
      expect(result.reverseCharge).toBe(false);
    });
  });

  describe('EU VAT B2C', () => {
    it('should charge buyerapos;s country VAT for B2C transactions', async () => {
      // Arrange
      const buyer: BuyerInfo = {
        address: {
          city: 'Berlin',
          postalCode: '10115',
          country: 'DE',
        },
        entityType: 'individual',
      };

      const seller: SellerInfo = {
        address: {
          city: 'Paris',
          postalCode: '75001',
          country: 'FR',
        },
      };

      mockLocationResolver.resolveLocation.mockResolvedValue({
        country: 'DE',
        validationMethod: 'billing_address',
        isValidVat: false,
        evidence: {},
      });

      mockStoreEvidence.mockResolvedValue(undefined);

      // Act
      const result = await calculator.calculateTax(100, buyer, seller, 'ORDER-004');

      // Assert
      expect(result.taxAmount).toBe(19); // Germany 19%
      expect(result.taxRate).toBe(19);
      expect(result.reverseCharge).toBe(false);
    });

    it('should charge correct VAT rates for different EU countries', async () => {
      const testCases = [
        { country: 'FR', expectedRate: 20 },
        { country: 'IT', expectedRate: 22 },
        { country: 'ES', expectedRate: 21 },
        { country: 'NL', expectedRate: 21 },
        { country: 'SE', expectedRate: 25 },
        { country: 'HU', expectedRate: 27 },
      ];

      for (const testCase of testCases) {
        const buyer: BuyerInfo = {
          address: {
            city: 'TestCity',
            postalCode: '12345',
            country: testCase.country,
          },
          entityType: 'individual',
        };

        const seller: SellerInfo = {
          address: {
            city: 'Paris',
            postalCode: '75001',
            country: 'FR',
          },
        };

        mockLocationResolver.resolveLocation.mockResolvedValue({
          country: testCase.country,
          validationMethod: 'billing_address',
          isValidVat: false,
          evidence: {},
        });

        mockStoreEvidence.mockResolvedValue(undefined);

        const result = await calculator.calculateTax(100, buyer, seller, `ORDER-${testCase.country}`);

        expect(result.taxRate).toBe(testCase.expectedRate);
      }
    });
  });

  describe('Cross-border EU Transactions', () => {
    it('should handle intra-EU B2B with valid VAT correctly', async () => {
      // Arrange: German seller, Dutch buyer with valid VAT
      const buyer: BuyerInfo = {
        vatNumber: 'NL123456789B01',
        address: {
          city: 'Amsterdam',
          postalCode: '1011',
          country: 'NL',
        },
        entityType: 'business',
      };

      const seller: SellerInfo = {
        address: {
          city: 'Berlin',
          postalCode: '10115',
          country: 'DE',
        },
      };

      mockLocationResolver.resolveLocation.mockResolvedValue({
        country: 'NL',
        validationMethod: 'vat_number',
        isValidVat: true,
        vatNumber: 'NL123456789B01',
        evidence: {},
      });

      mockStoreEvidence.mockResolvedValue(undefined);

      // Act
      const result = await calculator.calculateTax(5000, buyer, seller, 'ORDER-005');

      // Assert
      expect(result.taxAmount).toBe(0);
      expect(result.reverseCharge).toBe(true);
      expect(result.jurisdiction.country).toBe('NL');
    });

    it('should charge VAT when seller is outside EU but buyer is in EU', async () => {
      // Arrange: US seller, German buyer
      const buyer: BuyerInfo = {
        address: {
          city: 'Berlin',
          postalCode: '10115',
          country: 'DE',
        },
        entityType: 'individual',
      };

      const seller: SellerInfo = {
        address: {
          city: 'New York',
          postalCode: '10001',
          country: 'US',
        },
      };

      mockLocationResolver.resolveLocation.mockResolvedValue({
        country: 'DE',
        validationMethod: 'billing_address',
        isValidVat: false,
        evidence: {},
      });

      mockStoreEvidence.mockResolvedValue(undefined);

      // Act
      const result = await calculator.calculateTax(1000, buyer, seller, 'ORDER-006');

      // Assert
      expect(result.taxAmount).toBe(190); // German VAT
      expect(result.jurisdiction.country).toBe('DE');
    });
  });

  describe('US Sales Tax', () => {
    it('should apply US sales tax for nexus states', async () => {
      // Arrange
      const buyer: BuyerInfo = {
        address: {
          city: 'Austin',
          postalCode: '78701',
          country: 'US',
          state: 'TX',
        },
        state: 'TX',
        entityType: 'individual',
      };

      const seller: SellerInfo = {
        address: {
          city: 'San Francisco',
          postalCode: '94102',
          country: 'US',
        },
      };

      mockLocationResolver.resolveLocation.mockResolvedValue({
        country: 'US',
        state: 'TX',
        validationMethod: 'billing_address',
        isValidVat: false,
        evidence: {},
      });

      mockStoreEvidence.mockResolvedValue(undefined);

      // Act
      const result = await calculator.calculateTax(1000, buyer, seller, 'ORDER-007');

      // Assert
      expect(result.taxAmount).toBe(62.5); // Texas 6.25%
      expect(result.taxRate).toBe(6.25);
      expect(result.jurisdiction.type).toBe('us_sales_tax');
      expect(result.jurisdiction.state).toBe('TX');
    });

    it('should not apply sales tax for non-nexus states', async () => {
      // Arrange: Oregon has no sales tax
      const buyer: BuyerInfo = {
        address: {
          city: 'Portland',
          postalCode: '97201',
          country: 'US',
          state: 'OR',
        },
        state: 'OR',
        entityType: 'individual',
      };

      const seller: SellerInfo = {
        address: {
          city: 'San Francisco',
          postalCode: '94102',
          country: 'US',
        },
      };

      mockLocationResolver.resolveLocation.mockResolvedValue({
        country: 'US',
        state: 'OR',
        validationMethod: 'billing_address',
        isValidVat: false,
        evidence: {},
      });

      mockStoreEvidence.mockResolvedValue(undefined);

      // Act
      const result = await calculator.calculateTax(1000, buyer, seller, 'ORDER-008');

      // Assert
      expect(result.taxAmount).toBe(0);
      expect(result.jurisdiction.type).toBe('us_sales_tax');
    });

    it('should apply California sales tax rate', async () => {
      // Arrange
      const buyer: BuyerInfo = {
        address: {
          city: 'Los Angeles',
          postalCode: '90001',
          country: 'US',
          state: 'CA',
        },
        state: 'CA',
        entityType: 'individual',
      };

      const seller: SellerInfo = {
        address: {
          city: 'New York',
          postalCode: '10001',
          country: 'US',
        },
      };

      mockLocationResolver.resolveLocation.mockResolvedValue({
        country: 'US',
        state: 'CA',
        validationMethod: 'billing_address',
        isValidVat: false,
        evidence: {},
      });

      mockStoreEvidence.mockResolvedValue(undefined);

      // Act
      const result = await calculator.calculateTax(1000, buyer, seller, 'ORDER-009');

      // Assert
      expect(result.taxAmount).toBe(72.5); // California 7.25%
      expect(result.taxRate).toBe(7.25);
    });
  });

  describe('Edge Cases', () => {
    it('should handle invalid/negative amounts', async () => {
      const buyer: BuyerInfo = {
        address: {
          city: 'Berlin',
          postalCode: '10115',
          country: 'DE',
        },
      };

      const seller: SellerInfo = {
        address: {
          city: 'Paris',
          postalCode: '75001',
          country: 'FR',
        },
      };

      await expect(
        calculator.calculateTax(-100, buyer, seller, 'ORDER-010')
      ).rejects.toThrow('Amount cannot be negative');
    });

    it('should handle missing buyer address', async () => {
      const buyer: BuyerInfo = {
        address: {
          city: 'Berlin',
          postalCode: '10115',
          country: '',
        },
      };

      const seller: SellerInfo = {
        address: {
          city: 'Paris',
          postalCode: '75001',
          country: 'FR',
        },
      };

      await expect(
        calculator.calculateTax(100, buyer, seller, 'ORDER-011')
      ).rejects.toThrow('Buyer address is required');
    });

    it('should handle non-EU/non-US transactions with no tax', async () => {
      // Arrange: Seller in Japan, buyer in Japan
      const buyer: BuyerInfo = {
        address: {
          city: 'Tokyo',
          postalCode: '100-0001',
          country: 'JP',
        },
        entityType: 'individual',
      };

      const seller: SellerInfo = {
        address: {
          city: 'Tokyo',
          postalCode: '100-0001',
          country: 'JP',
        },
      };

      mockLocationResolver.resolveLocation.mockResolvedValue({
        country: 'JP',
        validationMethod: 'billing_address',
        isValidVat: false,
        evidence: {},
      });

      mockStoreEvidence.mockResolvedValue(undefined);

      // Act
      const result = await calculator.calculateTax(1000, buyer, seller, 'ORDER-012');

      // Assert
      expect(result.taxAmount).toBe(0);
      expect(result.taxRate).toBe(0);
      expect(result.jurisdiction.type).toBe('none');
    });

    it('should round tax amounts to 2 decimal places', async () => {
      const buyer: BuyerInfo = {
        address: {
          city: 'Berlin',
          postalCode: '10115',
          country: 'DE',
        },
        entityType: 'individual',
      };

      const seller: SellerInfo = {
        address: {
          city: 'Paris',
          postalCode: '75001',
          country: 'FR',
        },
      };

      mockLocationResolver.resolveLocation.mockResolvedValue({
        country: 'DE',
        validationMethod: 'billing_address',
        isValidVat: false,
        evidence: {},
      });

      mockStoreEvidence.mockResolvedValue(undefined);

      // Act: 19% VAT on 0.33 = 0.0627, should round to 0.06
      const result = await calculator.calculateTax(0.33, buyer, seller, 'ORDER-013');

      expect(result.taxAmount).toBe(0.06);
    });

    it('should default to 20% for unknown EU countries', async () => {
      // This tests the fallback mechanism
      const buyer: BuyerInfo = {
        address: {
          city: 'Unknown City',
          postalCode: '12345',
          country: 'XX', // Unknown country code
        },
        entityType: 'individual',
      };

      const seller: SellerInfo = {
        address: {
          city: 'Berlin',
          postalCode: '10115',
          country: 'DE',
        },
      };

      mockLocationResolver.resolveLocation.mockResolvedValue({
        country: 'XX',
        validationMethod: 'billing_address',
        isValidVat: false,
        evidence: {},
      });

      mockStoreEvidence.mockResolvedValue(undefined);

      // Act
      const result = await calculator.calculateTax(100, buyer, seller, 'ORDER-014');

      // Assert - falls back to 20%
      expect(result.taxRate).toBe(20);
    });
  });

  describe('Evidence Storage', () => {
    it('should store tax evidence for EU B2B reverse charge', async () => {
      // Arrange
      const buyer: BuyerInfo = {
        vatNumber: 'DE123456789',
        address: {
          city: 'Berlin',
          postalCode: '10115',
          country: 'DE',
        },
        entityType: 'business',
      };

      const seller: SellerInfo = {
        address: {
          city: 'Munich',
          postalCode: '80331',
          country: 'DE',
        },
      };

      mockLocationResolver.resolveLocation.mockResolvedValue({
        country: 'DE',
        validationMethod: 'vat_number',
        isValidVat: true,
        vatNumber: 'DE123456789',
        evidence: {},
      });

      mockStoreEvidence.mockResolvedValue(undefined);

      // Act
      await calculator.calculateTax(1000, buyer, seller, 'ORDER-015');

      // Assert
      expect(mockStoreEvidence).toHaveBeenCalledTimes(1);
      expect(mockStoreEvidence).toHaveBeenCalledWith(
        expect.objectContaining({
          orderId: 'ORDER-015',
          buyerVatNumber: 'DE123456789',
          buyerCountry: 'DE',
          sellerCountry: 'DE',
          vatValid: true,
          validationMethod: 'vat_number',
        })
      );
    });

    it('should record validation method in evidence', async () => {
      // Test IP geolocation fallback
      const buyer: BuyerInfo = {
        ipAddress: '8.8.8.8',
        address: {
          city: 'Unknown',
          postalCode: '00000',
          country: 'UNKNOWN',
        },
      };

      const seller: SellerInfo = {
        address: {
          city: 'Berlin',
          postalCode: '10115',
          country: 'DE',
        },
      };

      mockLocationResolver.resolveLocation.mockResolvedValue({
        country: 'US',
        validationMethod: 'ip_geolocation',
        isValidVat: false,
        evidence: {
          ipCountry: 'US',
        },
      });

      mockStoreEvidence.mockResolvedValue(undefined);

      // Act
      await calculator.calculateTax(100, buyer, seller, 'ORDER-016');

      // Assert
      expect(mockStoreEvidence).toHaveBeenCalledWith(
        expect.objectContaining({
          validationMethod: 'ip_geolocation',
        })
      );
    });
  });
});
