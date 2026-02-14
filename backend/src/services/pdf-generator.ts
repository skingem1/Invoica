import PDFDocument from 'pdfkit';
import { z } from 'zod';

// Type definitions
export interface Seller {
  name: string;
  address: string;
  vatNumber: string;
}

export interface Buyer {
  name: string;
  address: string;
  vatNumber: string;
}

export interface LineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  total: number;
}

export interface InvoiceData {
  invoiceNumber: string;
  issueDate: Date;
  dueDate: Date;
  seller: Seller;
  buyer: Buyer;
  lineItems: LineItem[];
  subtotal: number;
  taxAmount: number;
  total: number;
  currency: string;
  notes?: string;
}

// Zod schema
export const LineItemSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().positive(),
  unitPrice: z.number().min(0),
  taxRate: z.number().min(0).max(100),
  total: z.number().min(0),
});

export const SellerSchema = z.object({
  name: z.string().min(1),
  address: z.string().min(1),
  vatNumber: z.string().min(1),
});

export const BuyerSchema = z.object({
  name: z.string().min(1),
  address: z.string().min(1),
  vatNumber: z.string().min(1),
});

export const InvoiceDataSchema = z.object({
  invoiceNumber: z.string().min(1),
  issueDate: z.instanceof(Date),
  dueDate: z.instanceof(Date),
  seller: SellerSchema,
  buyer: BuyerSchema,
  lineItems: z.array(LineItemSchema).min(1),
  subtotal: z.number().min(0),
  taxAmount: z.number().min(0),
  total: z.number().min(0),
  currency: z.string().length(3),
  notes: z.string().optional(),
});