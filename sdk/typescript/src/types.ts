/**
 * Countable SDK Type Definitions
 */

export interface GetSettlementParams {
  invoiceId: string;
}

export interface SettlementStatus {
  invoiceId: string;
  status: 'pending' | 'confirmed' | 'failed';
  txHash: string | null;
  chain: string;
  confirmedAt: string | null;
  amount: number;
  currency: string;
}

export type WebhookEventType =
  | 'invoice.created'
  | 'invoice.paid'
  | 'invoice.settled'
  | 'invoice.failed'
  | 'settlement.confirmed'
  | 'settlement.failed';

export interface Invoice {
  id: string;
  number: string;
  amount: number;
  currency: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: string;
  updatedAt: string;
}

export interface ApiResponse<T> {
  data: T;
  success: boolean;
  error?: string;
}