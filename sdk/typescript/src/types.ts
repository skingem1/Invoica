/**
 * Countable SDK Type Definitions
 * @package @countable/sdk
 */

export type SettlementStatus = 'pending' | 'confirmed' | 'failed';

export interface GetSettlementParams {
  invoiceId?: string;
  status?: SettlementStatus;
  limit?: number;
  offset?: number;
}

export type WebhookEventType =
  | 'invoice.created'
  | 'invoice.updated'
  | 'invoice.paid'
  | 'settlement.created'
  | 'settlement.confirmed';

export interface Invoice {
  id: string;
  number: string;
  amount: number;
  currency: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  description?: string;
  customerId?: string;
  metadata?: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

export interface CreateInvoiceParams {
  amount: number;
  currency: string;
  description?: string;
  customerId?: string;
  metadata?: Record<string, string>;
}

export interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  lastUsedAt?: string;
}

export interface CreateApiKeyParams {
  name: string;
  permissions?: ('read' | 'write' | 'admin')[];
}

export interface ApiKeyListResponse {
  keys: ApiKey[];
  total: number;
  limit: number;
  offset: number;
}

export interface WebhookRegistrationConfig {
  url: string;
  events: WebhookEventType[];
  secret?: string;
}

export interface WebhookRegistration {
  id: string;
  url: string;
  events: WebhookEventType[];
  active: boolean;
  createdAt: string;
}

export interface WebhookListResponse {
  webhooks: WebhookRegistration[];
  total: number;
}

export interface InvoiceCreateInput {
  amount: number;
  currency: string;
  description?: string;
  customerId?: string;
  metadata?: Record<string, string>;
}

export interface Settlement {
  id: string;
  invoiceId: string;
  status: SettlementStatus;
  txHash: string | null;
  chain: string;
  amount: number;
  currency: string;
  confirmedAt: string | null;
  createdAt: string;
}

export interface SettlementListResponse {
  settlements: Settlement[];
  total: number;
  limit: number;
  offset: number;
}

export interface InvoiceListResponse {
  invoices: Invoice[];
  total: number;
  limit: number;
  offset: number;
}

export interface ApiKeyCreateResponse {
  id: string;
  name: string;
  key: string;
  createdAt: string;
}