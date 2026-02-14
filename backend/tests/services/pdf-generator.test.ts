import { describe, it, expect, beforeEach, vi } from 'vitest';
import { generateInvoicePDF, invoiceDataSchema, InvoiceData, ValidatedInvoiceData } from '../../src/services/pdf-generator';

// Mock PDFKit since we're testing the service logic
vi.mock('pdfkit', () => ({
  default: vi.fn().mockImplementation(() => ({
    pipe: vi.fn().mockReturnThis(),
    text: vi.fn().mockReturnThis(),
    fontSize: vi.fn().mockReturnThis(),
    moveDown: vi.fn().mockReturnThis(),
    fillColor: vi.fn().mockReturnThis(),
    table: vi.fn().mockReturnThis(),
    end: vi.fn().mockReturnThis(),
    on: vi.fn().mockReturnThis(),
    finalize: vi.fn().mockReturnThis(),
  })),
}));

describe('PDF Generator Service', () => {
  // Valid sample invoice data for testing
  const validInvoiceData: InvoiceData = {
    invoiceNumber: 'INV-2024-001',
    issueDate: new Date('2024-01-15'),
    dueDate: new Date('2024-02-15'),
    seller: {
      name: 'Acme Corp',
      address: '123 Business St, New York, NY 10001',
      vatNumber: 'US123456789',
    },
    buyer: {
      name: 'Client Inc',
      address: '456 Client Ave, Los Angeles, CA 90001',
      vatNumber: 'US987654321',
    },
    lineItems: [
      {
        description: 'Web Development Services',
        quantity: 10,
        unitPrice: 150.00,
        taxRate: 0.1,
        total: 1500.00,
      },
      {
        description: 'Server Hosting (Monthly)',
        quantity: 1,
        unitPrice: 50.00,
        taxRate: 0.1,
        total: 50.00,
      },
    ],
    subtotal: 1550.00,
    taxAmount: 155.00,
    total: 1705.00,
    currency: 'USD',
    notes: 'Thank you for your business!',
  };

  describe('invoiceDataSchema', () => {
    it('should validate a complete valid invoice', () => {
      const result = invoiceDataSchema.safeParse(validInvoiceData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.invoiceNumber).toBe('INV-2024-001');
        expect(result.data.lineItems).toHaveLength(2);
      }
    });

    it('should reject invoice with missing invoice number', () => {
      const invalidData = { ...validInvoiceData, invoiceNumber: '' };
      const result = invoiceDataSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some(i => i.path.includes('invoiceNumber'))).toBe(true);
      }
    });

    it('should reject invoice with empty line items', () => {
      const invalidData = { ...validInvoiceData, lineItems: [] };
      const result = invoiceDataSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some(i => i.path.includes('lineItems'))).toBe(true);
      }
    });

    it('should reject invoice with negative quantity', () => {
      const invalidData = {
        ...validInvoiceData,
        lineItems: [{ ...validInvoiceData.lineItems[0], quantity: -5 }],
      };
      const result = invoiceDataSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some(i => i.path.includes('quantity'))).toBe(true);
      }
    });

    it('should reject invoice with invalid currency code length', () => {
      const invalidData = { ...validInvoiceData, currency: 'US' };
      const result = invoiceDataSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some(i => i.path.includes('currency'))).toBe(true);
      }
    });

    it('should reject invoice with tax rate greater than 1', () => {
      const invalidData = {
        ...validInvoiceData,
        lineItems: [{ ...validInvoiceData.lineItems[0], taxRate: 1.5 }],
      };
      const result = invoiceDataSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some(i => i.path.includes('taxRate'))).toBe(true);
      }
    });

    it('should accept invoice with valid optional notes', () => {
      const dataWithNotes = { ...validInvoiceData, notes: 'Payment due within 30 days' };
      const result = invoiceDataSchema.safeParse(dataWithNotes);
      expect(result.success).toBe(true);
    });

    it('should accept invoice without notes', () => {
      const dataWithoutNotes = { ...validInvoiceData };
      delete dataWithoutNotes.notes;
      const result = invoiceDataSchema.safeParse(dataWithoutNotes);
      expect(result.success).toBe(true);
    });

    it('should reject invoice with negative subtotal', () => {
      const invalidData = { ...validInvoiceData, subtotal: -100 };
      const result = invoiceDataSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject invoice with missing seller information', () => {
      const invalidData = { ...validInvoiceData, seller: { name: '', address: '', vatNumber: '' } };
      const result = invoiceDataSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject invoice with missing buyer information', () => {
      const invalidData = { ...validInvoiceData, buyer: { name: '', address: '', vatNumber: '' } };
      const result = invoiceDataSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('generateInvoicePDF', () => {
    it('should generate a PDF buffer from valid invoice data', async () => {
      const pdfBuffer = await generateInvoicePDF(validInvoiceData);
      
      expect(pdfBuffer).toBeInstanceOf(Buffer);
      expect(pdfBuffer.length).toBeGreaterThan(0);
    });

    it('should include invoice number in generated PDF', async () => {
      const pdfBuffer = await generateInvoicePDF(validInvoiceData);
      const pdfContent = pdfBuffer.toString('utf8');
      
      expect(pdfContent).toContain('INV-2024-001');
    });

    it('should include seller information in generated PDF', async () => {
      const pdfBuffer = await generateInvoicePDF(validInvoiceData);
      const pdfContent = pdfBuffer.toString('utf8');
      
      expect(pdfContent).toContain('Acme Corp');
      expect(pdfContent).toContain('US123456789');
    });

    it('should include buyer information in generated PDF', async () => {
      const pdfBuffer = await generateInvoicePDF(validInvoiceData);
      const pdfContent = pdfBuffer.toString('utf8');
      
      expect(pdfContent).toContain('Client Inc');
      expect(pdfContent).toContain('US987654321');
    });

    it('should include line item descriptions in generated PDF', async () => {
      const pdfBuffer = await generateInvoicePDF(validInvoiceData);
      const pdfContent = pdfBuffer.toString('utf8');
      
      expect(pdfContent).toContain('Web Development Services');
      expect(pdfContent).toContain('Server Hosting (Monthly)');
    });

    it('should include totals in generated PDF', async () => {
      const pdfBuffer = await generateInvoicePDF(validInvoiceData);
      const pdfContent = pdfBuffer.toString('utf8');
      
      expect(pdfContent).toContain('1705.00');
      expect(pdfContent).toContain('USD');
    });

    it('should include notes when provided', async () => {
      const pdfBuffer = await generateInvoicePDF(validInvoiceData);
      const pdfContent = pdfBuffer.toString('utf8');
      
      expect(pdfContent).toContain('Thank you for your business!');
    });

    it('should handle invoice without notes gracefully', async () => {
      const dataWithoutNotes = { ...validInvoiceData };
      delete dataWithoutNotes.notes;
      
      const pdfBuffer = await generateInvoicePDF(dataWithoutNotes);
      
      expect(pdfBuffer).toBeInstanceOf(Buffer);
      expect(pdfBuffer.length).toBeGreaterThan(0);
    });

    it('should handle single line item', async () => {
      const singleItemInvoice = {
        ...validInvoiceData,
        lineItems: [validInvoiceData.lineItems[0]],
        subtotal: 1500.00,
        taxAmount: 150.00,
        total: 1650.00,
      };
      
      const pdfBuffer = await generateInvoicePDF(singleItemInvoice);
      
      expect(pdfBuffer).toBeInstanceOf(Buffer);
      expect(pdfBuffer.length).toBeGreaterThan(0);
    });

    it('should handle many line items', async () => {
      const manyItemsInvoice = {
        ...validInvoiceData,
        lineItems: Array.from({ length: 20 }, (_, i) => ({
          description: `Item ${i + 1}`,
          quantity: 1,
          unitPrice: 100.00,
          taxRate: 0.1,
          total: 100.00,
        })),
        subtotal: 2000.00,
        taxAmount: 200.00,
        total: 2200.00,
      };
      
      const pdfBuffer = await generateInvoicePDF(manyItemsInvoice);
      
      expect(pdfBuffer).toBeInstanceOf(Buffer);
      expect(pdfBuffer.length).toBeGreaterThan(0);
    });

    it('should handle zero tax rate', async () => {
      const zeroTaxInvoice = {
        ...validInvoiceData,
        lineItems: validInvoiceData.lineItems.map(item => ({ ...item, taxRate: 0 })),
        taxAmount: 0,
      };
      
      const pdfBuffer = await generateInvoicePDF(zeroTaxInvoice);
      
      expect(pdfBuffer).toBeInstanceOf(Buffer);
    });

    it('should handle different currencies', async () => {
      const euroInvoice = { ...validInvoiceData, currency: 'EUR' };
      
      const pdfBuffer = await generateInvoicePDF(euroInvoice);
      const pdfContent = pdfBuffer.toString('utf8');
      
      expect(pdfContent).toContain('EUR');
    });

    it('should reject invalid invoice data', async () => {
      const invalidData = { ...validInvoiceData, invoiceNumber: '' };
      
      await expect(generateInvoicePDF(invalidData as InvoiceData)).rejects.toThrow();
    });

    it('should reject invoice with invalid line items', async () => {
      const invalidData = {
        ...validInvoiceData,
        lineItems: [{ description: '', quantity: -1, unitPrice: -10, taxRate: 2, total: -100 }],
      };
      
      await expect(generateInvoicePDF(invalidData as InvoiceData)).rejects.toThrow();
    });

    it('should handle very large monetary values', async () => {
      const largeValueInvoice = {
        ...validInvoiceData,
        subtotal: 999999999.99,
        taxAmount: 99999999.99,
        total: 1099999999.98,
      };
      
      const pdfBuffer = await generateInvoicePDF(largeValueInvoice);
      
      expect(pdfBuffer).toBeInstanceOf(Buffer);
    });

    it('should handle special characters in text fields', async () => {
      const specialCharInvoice = {
        ...validInvoiceData,
        seller: {
          name: 'Company & Sons <Ltd>',
          address: '123 Main St, Suite #200\nNew York, NY',
          vatNumber: 'EU123456789',
        },
        buyer: {
          name: 'Client "Holdings" Corp',
          address: '456 Oak Ave & Building',
          vatNumber: 'US987654321',
        },
      };
      
      const pdfBuffer = await generateInvoicePDF(specialCharInvoice);
      
      expect(pdfBuffer).toBeInstanceOf(Buffer);
    });

    it('should include issue and due dates', async () => {
      const pdfBuffer = await generateInvoicePDF(validInvoiceData);
      const pdfContent = pdfBuffer.toString('utf8');
      
      // Should contain date-formatted content
      expect(pdfContent).toContain('2024');
    });
  });
});