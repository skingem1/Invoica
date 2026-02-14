/**
 * Countable TypeScript SDK - Type Definitions
 */

export interface Invoice {
  id: string;
  amount: number;
  currency: string;
  status: string;
  createdAt: string;
  paidAt: string | null;
  metadata: Record<string, string>;
}

export interface CreateInvoiceParams {
  amount: number;
  currency: string;
  description?: string;
  metadata?: Record<string, string>;
}

export interface InvoiceFilter {
  status?: string;
  limit?: number;
  offset?: number;
}

export interface Settlement {
  id: string;
  invoiceId: string;
  txHash: string;
  chain: string;
  amount: number;
  confirmedAt: string | null;
}

export interface ApiError {
  code: string;
  message: string;
  statusCode: number;
}

export interface WebhookEvent {
  id: string;
  type: string;
  data: unknown;
  createdAt: string;
}