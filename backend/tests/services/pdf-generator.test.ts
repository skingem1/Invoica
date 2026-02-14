/**
 * PDF Generator Service Tests
 * 
 * Tests for the invoice PDF generation functionality including
 * validation, error handling, and successful generation cases.
 */

import { generateInvoicePDF, InvoiceData, InvoiceLineItem, InvoiceParty } from '../../src/services/pdf-generator';
import { z } from 'zod';

// Test data factories
const createSeller = (overrides?: Partial<InvoiceParty>): InvoiceParty => ({
  name: 'Test Company Ltd',
  address: '123 Business St, City, Country',
  vatNumber: 'VAT123456789',
  ...overrides,
});

const createBuyer = (overrides?: Partial<InvoiceParty>): InvoiceParty => ({
  name: 'Client Company Inc',
  address: '456 Client Ave, Town, Country',
  vatNumber: 'VAT987654321',
  ...overrides,
});

const createLineItem = (overrides?: Partial<InvoiceLineItem>): InvoiceLineItem => ({
  description: 'Test Service',
  quantity: 1,
  unitPrice: 100,
  taxRate: 20,
  total: 120,
  ...overrides,
});

const createValidInvoiceData = (overrides?: Partial<InvoiceData>): InvoiceData => ({
  invoiceNumber: 'INV-2024-001',
  issueDate: new Date('2024-01-15'),
  dueDate: new Date('2024-02-15'),
  seller: createSeller(),
  buyer: createBuyer(),
  lineItems: [createLineItem()],
  subtotal: 100,
  taxAmount: 20,
  total: 120,
  currency: 'USD',
  notes: 'Thank you for your business',
  ...overrides,
});

describe('generateInvoicePDF', () => {
  it('should generate a valid PDF buffer from invoice data', async () => {
    const invoiceData = createValidInvoiceData();
    const pdfBuffer = await generateInvoicePDF(invoiceData);
    
    expect(pdfBuffer).toBeInstanceOf(Buffer);
    expect(pdfBuffer.length).toBeGreaterThan(0);
  });

  it('should handle missing optional notes field', async () => {
    const invoiceData = createValidInvoiceData({ notes: undefined });
    const pdfBuffer = await generateInvoicePDF(invoiceData);
    
    expect(pdfBuffer).toBeInstanceOf(Buffer);
  });

  it('should validate currency against ISO 4217 codes', async () => {
    const invalidCurrencyData = createValidInvoiceData({ currency: 'INVALID' });
    
    await expect(generateInvoicePDF(invalidCurrencyData)).rejects.toThrow();
  });

  it('should reject negative quantities', async () => {
    const invalidData = createLineItem({ quantity: -1 });
    
    await expect(generateInvoicePDF(createValidInvoiceData({ lineItems: [invalidData] }))).rejects.toThrow();
  });
});