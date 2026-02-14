import PDFDocument from 'pdfkit';
import { generateInvoicePDF, InvoiceData, InvoiceDataSchema } from '../../src/services/pdf-generator';
import { ZodError } from 'zod';

// Mock PDFKit
jest.mock('pdfkit', () => {
  return jest.fn().mockImplementation(() => ({
    font: jest.fn().mockReturnThis(),
    fontSize: jest.fn().mockReturnThis(),
    text: jest.fn().mockReturnThis(),
    moveDown: jest.fn().mockReturnThis(),
    fillColor: jest.fn().mockReturnThis(),
    rect: jest.fn().mockReturnThis(),
    fill: jest.fn().mockReturnThis(),
    table: jest.fn().mockReturnThis(),
    end: jest.fn().mockReturnThis(),
    pipe: jest.fn().mockReturnThis(),
    on: jest.fn().mockReturnThis(),
  }));
});

describe('PDF Generator Service', () => {
  // Valid test data
  const validInvoiceData: InvoiceData = {
    invoiceNumber: 'INV-2024-001',
    issueDate: new Date('2024-01-15'),
    dueDate: new Date('2024-02-15'),
    seller: {
      name: 'Acme Corp',
      address: '123 Business Ave, Suite 100, New York, NY 10001',
      vatNumber: 'US123456789',
    },
    buyer: {
      name: 'Client Inc',
      address: '456 Client Street, San Francisco, CA 94102',
      vatNumber: 'US987654321',
    },
    lineItems: [
      {
        description: 'Web Development Services',
        quantity: 10,
        unitPrice: 150.00,
        taxRate: 10,
        total: 1500.00,
      },
      {
        description: 'Server Hosting (Monthly)',
        quantity: 1,
        unitPrice: 99.00,
        taxRate: 10,
        total: 99.00,
      },
    ],
    subtotal: 1599.00,
    taxAmount: 159.90,
    total: 1758.90,
    currency: 'USD',
    notes: 'Thank you for your business!',
  };

  describe('generateInvoicePDF', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should generate a PDF buffer from valid invoice data', async () => {
      const mockChunks: Buffer[] = [];
      
      // Capture the chunks pushed to the array
      const mockPush = jest.fn((chunk: Buffer) => mockChunks.push(chunk));
      
      // Mock the pipe to capture the stream
      const mockStream = {
        on: jest.fn(),
        pipe: jest.fn(),
      };

      (PDFDocument as jest.Mock).mockImplementation(() => ({
        font: jest.fn().mockReturnThis(),
        fontSize: jest.fn().mockReturnThis(),
        text: jest.fn().mockReturnThis(),
        moveDown: jest.fn().mockReturnThis(),
        fillColor: jest.fn().mockReturnThis(),
        rect: jest.fn().mockReturnThis(),
        fill: jest.fn().mockReturnThis(),
        end: jest.fn().mockReturnThis(),
        pipe: jest.fn().mockReturnThis(),
        on: jest.fn().mockImplementation((event: string, callback: (chunk: Buffer) => void) => {
          if (event === 'data') {
            callback(Buffer.from('PDF content'));
          }
          if (event === 'end') {
            callback();
          }
          return this;
        }),
      }));

      const result = await generateInvoicePDF(validInvoiceData);

      expect(result).toBeInstanceOf(Buffer);
      expect(PDFDocument).toHaveBeenCalledWith({ size: 'A4', margin: 50 });
    });

    it('should handle invoice without notes', async () => {
      const invoiceWithoutNotes = {
        ...validInvoiceData,
        notes: undefined,
      };

      (PDFDocument as jest.Mock).mockImplementation(() => ({
        font: jest.fn().mockReturnThis(),
        fontSize: jest.fn().mockReturnThis(),
        text: jest.fn().mockReturnThis(),
        moveDown: jest.fn().mockReturnThis(),
        fillColor: jest.fn().mockReturnThis(),
        rect: jest.fn().mockReturnThis(),
        fill: jest.fn().mockReturnThis(),
        end: jest.fn().mockReturnThis(),
        pipe: jest.fn().mockReturnThis(),
        on: jest.fn().mockImplementation((event: string, callback: (chunk: Buffer) => void) => {
          if (event === 'data') {
            callback(Buffer.from('PDF content'));
          }
          if (event === 'end') {
            callback();
          }
          return this;
        }),
      }));

      const result = await generateInvoicePDF(invoiceWithoutNotes);

      expect(result).toBeInstanceOf(Buffer);
    });

    it('should handle multiple line items correctly', async () => {
      const multiLineItemInvoice = {
        ...validInvoiceData,
        lineItems: [
          { description: 'Item 1', quantity: 2, unitPrice: 100, taxRate: 20, total: 200 },
          { description: 'Item 2', quantity: 3, unitPrice: 50, taxRate: 20, total: 150 },
          { description: 'Item 3', quantity: 1, unitPrice: 250, taxRate: 20, total: 250 },
        ],
        subtotal: 600,
        taxAmount: 120,
        total: 720,
      };

      (PDFDocument as jest.Mock).mockImplementation(() => ({
        font: jest.fn().mockReturnThis(),
        fontSize: jest.fn().mockReturnThis(),
        text: jest.fn().mockReturnThis(),
        moveDown: jest.fn().mockReturnThis(),
        fillColor: jest.fn().mockReturnThis(),
        rect: jest.fn().mockReturnThis(),
        fill: jest.fn().mockReturnThis(),
        end: jest.fn().mockReturnThis(),
        pipe: jest.fn().mockReturnThis(),
        on: jest.fn().mockImplementation((event: string, callback: (chunk: Buffer) => void) => {
          if (event === 'data') {
            callback(Buffer.from('PDF content'));
          }
          if (event === 'end') {
            callback();
          }
          return this;
        }),
      }));

      const result = await generateInvoicePDF(multiLineItemInvoice);

      expect(result).toBeInstanceOf(Buffer);
      expect(validInvoiceData.lineItems.length).toBe(3);
    });

    it('should handle different currencies', async () => {
      const currencies = ['USD', 'EUR', 'GBP', 'JPY'];

      for (const currency of currencies) {
        const currencyInvoice = {
          ...validInvoiceData,
          currency,
        };

        (PDFDocument as jest.Mock).mockImplementation(() => ({
          font: jest.fn().mockReturnThis(),
          fontSize: jest.fn().mockReturnThis(),
          text: jest.fn().mockReturnThis(),
          moveDown: jest.fn().mockReturnThis(),
          fillColor: jest.fn().mockReturnThis(),
          rect: jest.fn().mockReturnThis(),
          fill: jest.fn().mockReturnThis(),
          end: jest.fn().mockReturnThis(),
          pipe: jest.fn().mockReturnThis(),
          on: jest.fn().mockImplementation((event: string, callback: (chunk: Buffer) => void) => {
            if (event === 'data') {
              callback(Buffer.from('PDF content'));
            }
            if (event === 'end') {
              callback();
            }
            return this;
          }),
        }));

        const result = await generateInvoicePDF(currencyInvoice);
        expect(result).toBeInstanceOf(Buffer);
      }
    });
  });

  describe('InvoiceDataSchema validation', () => {
    it('should validate a correct invoice data object', () => {
      const result = InvoiceDataSchema.safeParse(validInvoiceData);
      expect(result.success).toBe(true);
    });

    it('should reject invoice with empty invoice number', () => {
      const invalidData = {
        ...validInvoiceData,
        invoiceNumber: '',
      };
      const result = InvoiceDataSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('invoiceNumber');
      }
    });

    it('should reject invoice with invalid date', () => {
      const invalidData = {
        ...validInvoiceData,
        issueDate: 'not a date',
      };
      const result = InvoiceDataSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject invoice with empty line items', () => {
      const invalidData = {
        ...validInvoiceData,
        lineItems: [],
      };
      const result = InvoiceDataSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('lineItems');
      }
    });

    it('should reject invoice with invalid line item quantity', () => {
      const invalidData = {
        ...validInvoiceData,
        lineItems: [
          {
            description: 'Test Item',
            quantity: -1,
            unitPrice: 100,
            taxRate: 10,
            total: 100,
          },
        ],
      };
      const result = InvoiceDataSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject invoice with negative prices', () => {
      const invalidData = {
        ...validInvoiceData,
        lineItems: [
          {
            description: 'Test Item',
            quantity: 1,
            unitPrice: -50,
            taxRate: 10,
            total: -50,
          },
        ],
      };
      const result = InvoiceDataSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject invoice with invalid currency length', () => {
      const invalidData = {
        ...validInvoiceData,
        currency: 'US',
      };
      const result = InvoiceDataSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject invoice with tax rate over 100%', () => {
      const invalidData = {
        ...validInvoiceData,
        lineItems: [
          {
            description: 'Test Item',
            quantity: 1,
            unitPrice: 100,
            taxRate: 150,
            total: 100,
          },
        ],
      };
      const result = InvoiceDataSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject invoice with missing seller name', () => {
      const invalidData = {
        ...validInvoiceData,
        seller: {
          ...validInvoiceData.seller,
          name: '',
        },
      };
      const result = InvoiceDataSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject invoice with missing buyer information', () => {
      const invalidData = {
        ...validInvoiceData,
        buyer: {
          name: '',
          address: '',
          vatNumber: '',
        },
      };
      const result = InvoiceDataSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should accept invoice without optional notes', () => {
      const dataWithoutNotes = {
        invoiceNumber: 'INV-001',
        issueDate: new Date(),
        dueDate: new Date(),
        seller: {
          name: 'Seller Co',
          address: '123 Seller St',
          vatNumber: 'VAT123',
        },
        buyer: {
          name: 'Buyer Co',
          address: '456 Buyer Ave',
          vatNumber: 'VAT456',
        },
        lineItems: [
          {
            description: 'Service',
            quantity: 1,
            unitPrice: 100,
            taxRate: 10,
            total: 100,
          },
        ],
        subtotal: 100,
        taxAmount: 10,
        total: 110,
        currency: 'USD',
      };
      const result = InvoiceDataSchema.safeParse(dataWithoutNotes);
      expect(result.success).toBe(true);
    });

    it('should properly throw ZodError for invalid data', () => {
      const invalidData = {
        ...validInvoiceData,
        invoiceNumber: '',
      };
      expect(() => InvoiceDataSchema.parse(invalidData)).toThrow(ZodError);
    });

    it('should validate numeric fields as non-negative', () => {
      const invalidData = {
        ...validInvoiceData,
        subtotal: -100,
      };
      const result = InvoiceDataSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });
});