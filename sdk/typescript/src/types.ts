export interface GetSettlementParams {
  invoiceId: string;
}

export interface SettlementStatus {
  invoiceId: string;
  status: string;
  txHash: string;
  chain: string;
  confirmedAt: Date;
  amount: number;
  currency: string;
}

export type WebhookEventType =
  | 'invoice.created'
  | 'invoice.settled'
  | 'invoice.processing'
  | 'invoice.completed'
  | 'invoice.failed'
  | 'settlement.created';

export interface Invoice {
  id: string;
  number: string;
  amount: number;
  currency: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ApiResponse<T> {
  data: T;
  success: boolean;
  error?: string;
}

export interface CreateInvoiceParams {
  amount: number;
  currency: string;
  description?: string;
  metadata?: Record<string, string>;
}