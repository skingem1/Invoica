// SDK Type Definitions
// This file exports all TypeScript types for the Countable SDK

export type SettlementStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface GetSettlementParams {
  id: string;
}

export type WebhookEventType = 
  | 'invoice.created'
  | 'invoice.settled'
  | 'invoice.completed'
  | 'invoice.failed'
  | 'settlement.created'
  | 'settlement.completed';

export interface Invoice {
  id: string;
  invoiceNumber: string;
  amount: number;
  currency: string;
  status: SettlementStatus;
  createdAt: string;
  updatedAt: string;
  paidAt?: string;
}

export interface ApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
}

export interface CreateInvoiceParams {
  amount: number;
  currency: string;
  description?: string;
  customerId?: string;
}

// New types for API Key management
export interface ApiKey {
  id: string;
  name: string;
  key: string;
  createdAt: string;
  lastUsedAt: string | null;
  revoked: boolean;
}

export interface CreateApiKeyParams {
  name: string;
}

export interface ApiKeyListResponse {
  apiKeys: ApiKey[];
  total: number;
}

// New types for Webhook registration
export interface WebhookRegistrationConfig {
  url: string;
  events: WebhookEventType[];
  secret: string;
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