// Type definitions for API responses

export interface InvoiceListResponse {
  invoices: Array<{
    id: string;
    invoiceNumber: string;
    amount: number;
    status: string;
    createdAt: string;
    customerName: string;
  }>;
  total: number;
  limit: number;
  offset: number;
}