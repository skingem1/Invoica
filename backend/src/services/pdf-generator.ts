/**
 * PDF Invoice Generator Service
 * 
 * This module provides functionality to generate PDF invoices using PDFKit.
 * It validates invoice data using Zod schemas and produces professional-looking
 * PDF documents with header, addresses, line items table, and totals.
 * 
 * @module services/pdf-generator
 */

import PDFDocument from 'pdfkit';
import { z } from 'zod';

/**
 * Represents a party (seller or buyer) in an invoice
 */
export interface InvoiceParty {
  name: string;
  address: string;
  vatNumber: string;
}

/**
 * Represents a single line item in an invoice
 */
export interface InvoiceLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  total: number;
}

/**
 * Complete invoice data structure
 */
export interface InvoiceData {
  invoiceNumber: string;
  issueDate: Date;
  dueDate: Date;
  seller: InvoiceParty;
  buyer: InvoiceParty;
  lineItems: InvoiceLineItem[];
  subtotal: number;
  taxAmount: number;
  total: number;
  currency: string;
  notes?: string;
}

// ISO 4217 currency codes for validation
const ISO_4217_CURRENCIES = [
  'AED', 'AFN', 'ALL', 'AMD', 'ANG', 'AOA', 'ARS', 'AUD', 'AWG', 'AZN',
  'BAM', 'BBD', 'BDT', 'BGN', 'BHD', 'BIF', 'BMD', 'BND', 'BOB', 'BRL',
  'BSD', 'BTN', 'BWP', 'BYN', 'BZD', 'CAD', 'CDF', 'CHF', 'CLP', 'CNY',
  'COP', 'CRC', 'CUP', 'CVE', 'CZK', 'DJF', 'DKK', 'DOP', 'DZD', 'EGP',
  'ERN', 'ETB', 'EUR', 'FJD', 'FKP', 'FOK', 'GBP', 'GEL', 'GGP', 'GHS',
  'GIP', 'GMD', 'GNF', 'GTQ', 'GYD', 'HKD', 'HNL', 'HRK', 'HTG', 'HUF',
  'IDR', 'ILS', 'IMP', 'INR', 'IQD', 'IRR', 'ISK', 'JEP', 'JMD', 'JOD',
  'JPY', 'KES', 'KGS', 'KHR', 'KID', 'KMF', 'KPW', 'KRW', 'KWD', 'KYD',
  'KZT', 'LAK', 'LBP', 'LKR', 'LRD', 'LSL', 'LYD', 'MAD', 'MDL', 'MGA',
  'MKD', 'MMK', 'MNT', 'MOP', 'MRU', 'MUR', 'MVR', 'MWK', 'MXN', 'MYR',
  'MZN', 'NAD', 'NGN', 'NIO', 'NOK', 'NPR', 'NZD', 'OMR', 'PAB', 'PEN',
  'PGK', 'PHP', 'PKR', 'PLN', 'PYG', 'QAR', 'RON', 'RSD', 'RUB', 'RWF',
  'SAR', 'SBD', 'SCR', 'SDG', 'SEK', 'SGD', 'SHP', 'SLE', 'SOS', 'SRD',
  'SSP', 'STN', 'SYP', 'SZL', 'THB', 'TJS', 'TMT', 'TND', 'TOP', 'TRY',
  'TTD', 'TVD', 'TWD', 'TZS', 'UAH', 'UGX', 'USD', 'UYU', 'UZS', 'VES',
  'VND', 'VUV', 'WST', 'XAF', 'XCD', 'XOF', 'XPF', 'YER', 'ZAR', 'ZMW',
  'ZWL'
] as const;

/**
 * Zod schema for validating InvoiceParty
 */
const InvoicePartySchema = z.object({
  name: z.string().min(1, 'Party name is required'),
  address: z.string().min(1, 'Party address is required'),
  vatNumber: z.string().min(1, 'VAT number is required'),
});

/**
 * Zod schema for validating InvoiceLineItem
 */
const InvoiceLineItemSchema = z.object({
  description: z.string().min(1, 'Line item description is required'),
  quantity: z.number().positive('Quantity must be positive'),
  unitPrice: z.number().min(0, 'Unit price cannot be negative'),
  taxRate: z.number().min(0, 'Tax rate cannot be negative').max(100, 'Tax rate cannot exceed 100%'),
  total: z.number().min(0, 'Line item total cannot be negative'),
});

/**
 * Zod schema for validating InvoiceData
 */
export const InvoiceDataSchema = z.object({
  invoiceNumber: z.string().min(1, 'Invoice number is required'),
  issueDate: z.instanceof(Date, { message: 'Issue date must be a valid Date' }),
  dueDate: z.instanceof(Date, { message: 'Due date must be a valid Date' }),
  seller: InvoicePartySchema,
  buyer: InvoicePartySchema,
  lineItems: z.array(InvoiceLineItemSchema).min(1, 'At least one line item is required'),
  subtotal: z.number().min(0, 'Subtotal cannot be negative'),
  taxAmount: z.number().min(0, 'Tax amount cannot be negative'),
  total: z.number().min(0, 'Total cannot be negative'),
  currency: z.string().length(3, 'Currency must be a 3-letter ISO 4217 code').refine(
    (code) => ISO_4217_CURRENCIES.includes(code.toUpperCase() as typeof ISO_4217_CURRENCIES[number]),
    { message: 'Currency must be a valid ISO 4217 code' }
  ),
  notes: z.string().optional(),
});

/**
 * Type for validated invoice data (inferred from schema)
 */
export type ValidatedInvoiceData = z.infer<typeof InvoiceDataSchema>;

/**
 * Custom error class for PDF generation failures
 */
export class PDFGenerationError extends Error {
  constructor(
    message: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'PDFGenerationError';
    Error.captureStackTrace(this, PDFGenerationError);
  }
}

/**
 * Custom error class for validation failures
 */
export class InvoiceValidationError extends Error {
  constructor(
    message: string,
    public readonly errors?: z.ZodError
  ) {
    super(message);
    this.name = 'InvoiceValidationError';
    Error.captureStackTrace(this, InvoiceValidationError);
  }
}

/**
 * Validates invoice data using Zod schema
 * 
 * @param data - The invoice data to validate
 * @returns The validated invoice data
 * @throws InvoiceValidationError if validation fails
 */
export function validateInvoiceData(data: unknown): ValidatedInvoiceData {
  const result = InvoiceDataSchema.safeParse(data);
  
  if (!result.success) {
    throw new InvoiceValidationError(
      'Invoice data validation failed',
      result.error
    );
  }
  
  return result.data;
}

/**
 * Formats a date for display in the invoice
 * 
 * @param date - The date to format
 * @returns Formatted date string (YYYY-MM-DD)
 */
function formatDate(date: Date): string {
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    return 'Invalid Date';
  }
  return date.toISOString().split('T')[0];
}

/**
 * Formats a number as currency
 * 
 * @param amount - The amount to format
 * @param currency - The currency code
 * @returns Formatted currency string
 */
function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Generates a PDF invoice buffer from invoice data
 * 
 * @param invoice - The invoice data to generate PDF from
 * @returns A Promise resolving to a Buffer containing the PDF data
 * @throws PDFGenerationError if PDF generation fails
 * @throws InvoiceValidationError if invoice data is invalid
 */
export async function generateInvoicePDF(invoice: InvoiceData): Promise<Buffer> {
  // Validate input data first
  const validatedInvoice = validateInvoiceData(invoice);

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 50,
        bufferPages: true,
      });

      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
      });

      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(chunks);
        resolve(pdfBuffer);
      });

      doc.on('error', (err: Error) => {
        reject(new PDFGenerationError('Failed to generate PDF', err));
      });

      // ========== HEADER SECTION ==========
      doc
        .fontSize(24)
        .font('Helvetica-Bold')
        .fillColor('#1a1a1a')
        .text('INVOICE', 50, 50);

      doc
        .fontSize(10)
        .font('Helvetica')
        .fillColor('#666666')
        .text(`Invoice Number: ${validatedInvoice.invoiceNumber}`, 400, 50, { align: 'right' })
        .text(`Issue Date: ${formatDate(validatedInvoice.issueDate)}`, 400, 65, { align: 'right' })
        .text(`Due Date: ${formatDate(validatedInvoice.dueDate)}`, 400, 80, { align: 'right' });

      // Horizontal line under header
      doc
        .strokeColor('#cccccc')
        .lineWidth(1)
        .moveTo(50, 110)
        .lineTo(545, 110)
        .stroke();

      // ========== ADDRESSES SECTION ==========
      const sellerY = 130;
      
      // Seller (From)
      doc
        .fontSize(11)
        .font('Helvetica-Bold')
        .fillColor('#1a1a1a')
        .text('FROM:', 50, sellerY);
      
      doc
        .fontSize(10)
        .font('Helvetica')
        .fillColor('#333333')
        .text(validatedInvoice.seller.name, 50, sellerY + 18)
        .text(validatedInvoice.seller.address, 50, sellerY + 33)
        .text(`VAT: ${validatedInvoice.seller.vatNumber}`, 50, sellerY + 48);

      // Buyer (Bill To)
      doc
        .fontSize(11)
        .font('Helvetica-Bold')
        .fillColor('#1a1a1a')
        .text('BILL TO:', 300, sellerY);
      
      doc
        .fontSize(10)
        .font('Helvetica')
        .fillColor('#333333')
        .text(validatedInvoice.buyer.name, 300, sellerY + 18)
        .text(validatedInvoice.buyer.address, 300, sellerY + 33)
        .text(`VAT: ${validatedInvoice.buyer.vatNumber}`, 300, sellerY + 48);

      // ========== LINE ITEMS TABLE ==========
      const tableTop = 220;
      const tableHeaders = ['Description', 'Qty', 'Unit Price', 'Tax %', 'Total'];
      const columnWidths = [220, 60, 90, 60, 85];
      const columnX = [50, 270, 330, 420, 480];

      // Table header background
      doc
        .fillColor('#f5f5f5')
        .rect(50, tableTop - 5, 495, 20)
        .fill();

      // Table headers
      doc
        .fontSize(10)
        .font('Helvetica-Bold')
        .fillColor('#1a1a1a');

      columnX.forEach((x, i) => {
        doc.text(tableHeaders[i], x, tableTop, {
          width: columnWidths[i],
          align: i === 0 ? 'left' : 'right'
        });
      });

      // Table header underline
      doc
        .strokeColor('#cccccc')
        .lineWidth(0.5)
        .moveTo(50, tableTop + 15)
        .lineTo(545, tableTop + 15)
        .stroke();

      // Line items
      let currentY = tableTop + 25;
      
      doc.font('Helvetica').fontSize(9);

      validatedInvoice.lineItems.forEach((item, index) => {
        // Alternate row background
        if (index % 2 === 1) {
          doc
            .fillColor('#fafafa')
            .rect(50, currentY - 4, 495, 16)
            .fill();
        }

        doc.fillColor('#333333');

        // Description (truncate if too long)
        const maxDescLength = 40;
        const description = item.description.length > maxDescLength
          ? item.description.substring(0, maxDescLength) + '...'
          : item.description;

        doc.text(description, columnX[0], currentY, {
          width: columnWidths[0],
          align: 'left'
        });

        doc.text(item.quantity.toString(), columnX[1], currentY, {
          width: columnWidths[1],
          align: 'right'
        });

        doc.text(formatCurrency(item.unitPrice, validatedInvoice.currency), columnX[2], currentY, {
          width: columnWidths[2],
          align: 'right'
        });

        doc.text(`${item.taxRate}%`, columnX[3], currentY, {
          width: columnWidths[3],
          align: 'right'
        });

        doc.text(formatCurrency(item.total, validatedInvoice.currency), columnX[4], currentY, {
          width: columnWidths[4],
          align: 'right'
        });

        currentY += 16;
      });

      // ========== TOTALS SECTION ==========
      const totalsY = currentY + 20;

      // Totals background
      doc
        .fillColor('#f5f5f5')
        .rect(350, totalsY - 5, 195, 70)
        .fill();

      doc.fontSize(10);

      // Subtotal
      doc
        .font('Helvetica')
        .fillColor('#666666')
        .text('Subtotal:', 360, totalsY);
      
      doc
        .fillColor('#333333')
        .text(formatCurrency(validatedInvoice.subtotal, validatedInvoice.currency), 480, totalsY, {
          width: 55,
          align: 'right'
        });

      // Tax Amount
      doc
        .font('Helvetica')
        .fillColor('#666666')
        .text('Tax:', 360, totalsY + 18);
      
      doc
        .fillColor('#333333')
        .text(formatCurrency(validatedInvoice.taxAmount, validatedInvoice.currency), 480, totalsY + 18, {
          width: 55,
          align: 'right'
        });

      // Divider line
      doc
        .strokeColor('#999999')
        .lineWidth(0.5)
        .moveTo(360, totalsY + 35)
        .lineTo(545, totalsY + 35)
        .stroke();

      // Total
      doc
        .font('Helvetica-Bold')
        .fontSize(12)
        .fillColor('#1a1a1a')
        .text('TOTAL:', 360, totalsY + 42);
      
      doc
        .text(formatCurrency(validatedInvoice.total, validatedInvoice.currency), 480, totalsY + 42, {
          width: 55,
          align: 'right'
        });

      // ========== NOTES SECTION ==========
      if (validatedInvoice.notes && validatedInvoice.notes.trim().length > 0) {
        const notesY = totalsY + 90;
        
        doc
          .fontSize(10)
          .font('Helvetica-Bold')
          .fillColor('#1a1a1a')
          .text('Notes:', 50, notesY);
        
        doc
          .font('Helvetica')
          .fontSize(9)
          .fillColor('#666666')
          .text(validatedInvoice.notes, 50, notesY + 15, {
            width: 495,
            align: 'left'
          });
      }

      // ========== FOOTER ==========
      const pageHeight = doc.page.height;
      doc
        .fontSize(8)
        .font('Helvetica')
        .fillColor('#999999')
        .text(
          'Generated by Countable Invoice System',
          50,
          pageHeight - 50,
          { align: 'center', width: 495 }
        );

      // Finalize the PDF
      doc.end();

    } catch (error) {
      if (error instanceof InvoiceValidationError || error instanceof PDFGenerationError) {
        reject(error);
      } else {
        reject(new PDFGenerationError(
          'Unexpected error during PDF generation',
          error instanceof Error ? error : new Error(String(error))
        ));
      }
    }
  });
}