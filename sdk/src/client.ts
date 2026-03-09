/**
 * Invoica Client SDK
 * Main client for interacting with the Invoica API
 */

import type {
  Invoice,
  CreateInvoiceRequest,
  Settlement,
  InvoiceStatus,
  ListInvoicesParams,
  InvoicaConfig,
  InvoiceListResponse,
} from './types';

const DEFAULT_BASE_URL = 'https://api.invoica.ai';

/**
 * Custom error class for Invoica API errors
 */
export class InvoicaError extends Error {
  /** HTTP status code */
  public statusCode: number;
  /** Error code from the API */
  public code: string;

  constructor(message: string, statusCode: number, code: string) {
    super(message);
    this.name = 'InvoicaError';
    this.statusCode = statusCode;
    this.code = code;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Invoica API Client
 * Provides methods for interacting with the Invoica API
 * to manage invoices and track settlements
 */
export class InvoicaClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;

  /**
   * Creates a new InvoicaClient instance
   * @param config - Configuration object containing API key and optional base URL
   * @example
   * const client = new InvoicaClient({ apiKey: 'your-api-key' });
   */
  constructor(config: InvoicaConfig) {
    if (!config.apiKey) throw new Error('apiKey is required');
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl ?? DEFAULT_BASE_URL;
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });

    const data = await res.json() as { error?: string; code?: string } & T;

    if (!res.ok) {
      throw new InvoicaError(
        (data as { error?: string }).error ?? res.statusText,
        res.status,
        (data as { code?: string }).code ?? 'UNKNOWN_ERROR',
      );
    }

    return data;
  }

  /** Create a new invoice */
  async createInvoice(request: CreateInvoiceRequest): Promise<Invoice> {
    return this.request<Invoice>('POST', '/v1/invoices', request);
  }

  /** List invoices with optional filters */
  async listInvoices(params?: ListInvoicesParams): Promise<InvoiceListResponse> {
    const qs = params ? '?' + new URLSearchParams(params as Record<string, string>).toString() : '';
    return this.request<InvoiceListResponse>('GET', `/v1/invoices${qs}`);
  }

  /** Get a single invoice by ID */
  async getInvoice(id: string): Promise<Invoice> {
    return this.request<Invoice>('GET', `/v1/invoices/${id}`);
  }

  /** Get settlement status for an invoice */
  async getSettlement(invoiceId: string): Promise<Settlement> {
    return this.request<Settlement>('GET', `/v1/invoices/${invoiceId}/settlement`);
  }
}
