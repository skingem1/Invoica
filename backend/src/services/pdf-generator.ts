import PDFDocument from 'pdfkit';
import { z } from 'zod';

/**
 * Invoice line item data
 */
export interface InvoiceLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  total: number;
}

/**
 * Address information
 */
export interface Address {
  name: string;
  address: string;
  vatNumber: string;
}

/**
 * Complete invoice data structure
 */
export interface InvoiceData {
  invoiceNumber: string;
  issueDate: Date;
  dueDate: Date;
  seller: Address;
  buyer: Address;
  lineItems: InvoiceLineItem[];
  subtotal: number;
  taxAmount: number;
  total: number;
  currency: string;
  notes?: string;
}

// Zod schema for InvoiceLineItem validation
const invoiceLineItemSchema = z.object({
  description: z.string().min(1, 'Description is required'),
  quantity: z.number().positive('Quantity must be positive'),
  unitPrice: z.number().min(0, 'Unit price cannot be negative'),
  taxRate: z.number().min(0).max(1, 'Tax rate must be between 0 and 1'),
  total: z.number().min(0, 'Total cannot be negative'),
});

// Zod schema for Address validation
const addressSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  address: z.string().min(1, 'Address is required'),
  vatNumber: z.string().min(1, 'VAT number is required'),
});

// Complete Zod schema for InvoiceData validation
export const invoiceDataSchema = z.object({
  invoiceNumber: z.string().min(1, 'Invoice number is required'),
  issueDate: z.date(),
  dueDate: z.date(),
  seller: addressSchema,
  buyer: addressSchema,
  lineItems: z.array(invoiceLineItemSchema).min(1, 'At least one line item is required'),
  subtotal: z.number().min(0, 'Subtotal cannot be negative'),
  taxAmount: z.number().min(0, 'Tax amount cannot be negative'),
  total: z.number().min(0, 'Total cannot be negative'),
  currency: z.string().length(3, 'Currency must be a 3-letter ISO code'),
  notes: z.string().optional(),
});

// Type for validated invoice data
export type ValidatedInvoiceData = z.infer<typeof invoiceDataSchema>;

/**
 * Custom error class for PDF generation failures
 */
export class PDFGenerationError extends Error {
  constructor(message: string, public readonly cause?: Error) {
    super(message);
    this.name = 'PDFGenerationError';
    Error.captureStackTrace(this, PDFGenerationError);
  }
}

/**
 * Validates invoice data against Zod schema
 * @param data - Raw invoice data to validate
 * @returns Validated invoice data
 * @throws ZodError if validation fails
 */
export function validateInvoiceData(data: unknown): ValidatedInvoiceData {
  return invoiceDataSchema.parse(data);
}

/**
 * Safely validates invoice data, returning a result object
 * @param data - Raw invoice data to validate
 * @returns Result object with either validated data or validation errors
 */
export function safeValidateInvoiceData(data: unknown): { 
  success: true; 
  data: ValidatedInvoiceData;
} | {
  success: false;
  error: z.ZodError;
} {
  const result = invoiceDataSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}

// Common ISO 4217 currency codes for validation
const VALID_CURRENCY_CODES = new Set([
  'USD', 'EUR', 'GBP', 'JPY', 'CNY', 'AUD', 'CAD', 'CHF', 'HKD', 'SGD',
  'SEK', 'KRW', 'NOK', 'NZD', 'INR', 'MXN', 'TWD', 'ZAR', 'BRL', 'DKK',
  'PLN', 'THB', 'ILS', 'IDR', 'CZK', 'AED', 'TRY', 'HUF', 'CLP', 'SAR',
  'PHP', 'MYR', 'COP', 'RUB', 'RON', 'PEN', 'BGN', 'ARS'
]);

/**
 * Validates if a currency code is a valid ISO 4217 code
 * @param currency - Currency code to validate
 * @returns True if valid currency code
 */
export function isValidCurrencyCode(currency: string): boolean {
  return VALID_CURRENCY_CODES.has(currency.toUpperCase());
}

/**
 * Formats a number as currency
 * @param amount - Amount to format
 * @param currency - Currency code
 * @returns Formatted currency string
 */
export function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amount);
}

/**
 * Formats a date for display
 * @param date - Date to format
 * @returns Formatted date string
 */
export function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

const PAGE_WIDTH = 595.28; // A4 width in points
const PAGE_HEIGHT = 841.89; // A4 height in points
const MARGIN = 50;
const CONTENT_WIDTH = PAGE_WIDTH - (MARGIN * 2);

/**
 * Generates a PDF invoice buffer from invoice data
 * @param invoice - Validated invoice data
 * @returns PDF as a Buffer
 * @throws PDFGenerationError if PDF generation fails
 */
export async function generateInvoicePDF(invoice: InvoiceData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: MARGIN,
        bufferPages: true,
      });

      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
      });

      doc.on('end', () => {
        const result = Buffer.concat(chunks);
        resolve(result);
      });

      doc.on('error', (error: Error) => {
        reject(new PDFGenerationError('Failed to generate PDF', error));
      });

      // Header - Invoice Title
      doc
        .fontSize(28)
        .font('Helvetica-Bold')
        .fillColor('#1a1a1a')
        .text('INVOICE', MARGIN, MARGIN);

      // Invoice Number and Dates on the right
      const rightX = PAGE_WIDTH - MARGIN;
      
      doc
        .fontSize(10)
        .font('Helvetica')
        .fillColor('#666666');
      
      doc.text(`Invoice #: ${invoice.invoiceNumber}`, rightX - 150, MARGIN, { width: 150, align: 'right' });
      doc.text(`Issue Date: ${formatDate(invoice.issueDate)}`, rightX - 150, MARGIN + 15, { width: 150, align: 'right' });
      doc.text(`Due Date: ${formatDate(invoice.dueDate)}`, rightX - 150, MARGIN + 30, { width: 150, align: 'right' });

      let yPosition = 120;

      // Seller Information
      doc
        .fontSize(10)
        .font('Helvetica-Bold')
        .fillColor('#1a1a1a')
        .text('FROM:', MARGIN, yPosition);
      
      doc
        .fontSize(10)
        .font('Helvetica')
        .fillColor('#333333');
      
      const sellerLines = [
        invoice.seller.name,
        invoice.seller.address,
        `VAT: ${invoice.seller.vatNumber}`
      ];
      
      sellerLines.forEach((line, index) => {
        doc.text(line, MARGIN, yPosition + 15 + (index * 14));
      });

      // Buyer Information
      const buyerLabelX = PAGE_WIDTH / 2 + 10;
      
      doc
        .fontSize(10)
        .font('Helvetica-Bold')
        .fillColor('#1a1a1a')
        .text('BILL TO:', buyerLabelX, yPosition);
      
      doc
        .fontSize(10)
        .font('Helvetica')
        .fillColor('#333333');
      
      const buyerLines = [
        invoice.buyer.name,
        invoice.buyer.address,
        `VAT: ${invoice.buyer.vatNumber}`
      ];
      
      buyerLines.forEach((line, index) => {
        doc.text(line, buyerLabelX, yPosition + 15 + (index * 14));
      });

      yPosition = 220;

      // Table Header
      const tableTop = yPosition;
      const colWidths = {
        description: CONTENT_WIDTH * 0.45,
        quantity: CONTENT_WIDTH * 0.12,
        unitPrice: CONTENT_WIDTH * 0.18,
        tax: CONTENT_WIDTH * 0.10,
        total: CONTENT_WIDTH * 0.15,
      };

      const headers = ['Description', 'Qty', 'Unit Price', 'Tax', 'Total'];
      const colPositions = [MARGIN];
      let currentX = MARGIN;
      
      Object.values(colWidths).forEach(width => {
        currentX += width;
        colPositions.push(currentX);
      });

      // Draw table header background
      doc
        .fillColor('#f3f4f6')
        .rect(MARGIN, tableTop - 5, CONTENT_WIDTH, 25)
        .fill();

      doc
        .fontSize(9)
        .font('Helvetica-Bold')
        .fillColor('#1a1a1a');

      headers.forEach((header, i) => {
        const align: 'left' | 'right' = i === 0 ? 'left' : 'right';
        doc.text(header, colPositions[i] + 5, tableTop, {
          width: colWidths[Object.keys(colWidths)[i] as keyof typeof colWidths],
          align,
        });
      });

      // Table Rows
      let rowY = tableTop + 30;
      const rowHeight = 22;

      doc.font('Helvetica').fontSize(9);

      invoice.lineItems.forEach((item, index) => {
        // Alternate row background
        if (index % 2 === 0) {
          doc
            .fillColor('#fafafa')
            .rect(MARGIN, rowY - 5, CONTENT_WIDTH, rowHeight)
            .fill();
        }

        doc.fillColor('#333333');

        const columns = [
          { text: item.description, width: colWidths.description, align: 'left' as const },
          { text: item.quantity.toString(), width: colWidths.quantity, align: 'right' as const },
          { text: formatCurrency(item.unitPrice, invoice.currency), width: colWidths.unitPrice, align: 'right' as const },
          { text: `${(item.taxRate * 100).toFixed(0)}%`, width: colWidths.tax, align: 'right' as const },
          { text: formatCurrency(item.total, invoice.currency), width: colWidths.total, align: 'right' as const },
        ];

        columns.forEach((col, i) => {
          doc.text(col.text, colPositions[i] + 5, rowY, {
            width: col.width,
            align: col.align,
          });
        });

        rowY += rowHeight;
      });

      // Draw table border
      doc
        .strokeColor('#e5e7eb')
        .lineWidth(1)
        .rect(MARGIN, tableTop - 5, CONTENT_WIDTH, rowY - tableTop + 5)
        .stroke();

      // Totals Section
      const totalsX = PAGE_WIDTH - MARGIN - 200;
      const totalsY = rowY + 30;
      const valueX = PAGE_WIDTH - MARGIN;

      doc.fontSize(10);

      // Subtotal
      doc
        .fillColor('#666666')
        .text('Subtotal:', totalsX, totalsY);
      doc
        .fillColor('#333333')
        .text(formatCurrency(invoice.subtotal, invoice.currency), valueX, totalsY, {
          width: 100,
          align: 'right',
        });

      // Tax
      doc
        .fillColor('#666666')
        .text('Tax:', totalsX, totalsY + 18);
      doc
        .fillColor('#333333')
        .text(formatCurrency(invoice.taxAmount, invoice.currency), valueX, totalsY + 18, {
          width: 100,
          align: 'right',
        });

      // Total
      doc
        .font('Helvetica-Bold')
        .fontSize(12)
        .fillColor('#1a1a1a')
        .text('Total:', totalsX, totalsY + 40);
      doc
        .text(formatCurrency(invoice.total, invoice.currency), valueX, totalsY + 40, {
          width: 100,
          align: 'right',
        });

      // Notes section
      if (invoice.notes) {
        const notesY = totalsY + 80;
        
        doc
          .font('Helvetica-Bold')
          .fontSize(10)
          .fillColor('#1a1a1a')
          .text('Notes:', MARGIN, notesY);
        
        doc
          .font('Helvetica')
          .fontSize(9)
          .fillColor('#666666')
          .text(invoice.notes, MARGIN, notesY + 15, {
            width: CONTENT_WIDTH,
          });
      }

      // Footer
      const footerY = PAGE_HEIGHT - MARGIN;
      doc
        .fontSize(8)
        .fillColor('#999999')
        .text(
          'Thank you for your business!',
          MARGIN,
          footerY,
          { width: CONTENT_WIDTH, align: 'center' }
        );

      doc.end();
    } catch (error) {
      reject(new PDFGenerationError(
        'Failed to generate invoice PDF',
        error instanceof Error ? error : undefined
      ));
    }
  });
}

The `generateInvoicePDF` function returns a Promise resolving to a Buffer containing the PDF data. This async design ensures proper stream handling in Node.js environments.
</think>