import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import {
  Invoice,
  CreateInvoiceParams,
  Settlement,
  InvoiceListResponse,
  SettlementListResponse,
  ApiKey,
  CreateApiKeyParams,
  ApiKeyListResponse,
} from './types';
import { InvoicaError } from './errors';

export interface InvoicaClientConfig {
  baseUrl: string;
  apiKey: string;
}

/**
 * Invoica SDK Client for interacting with the Invoica API
 */
export class InvoicaClient {
  private readonly client: AxiosInstance;

  constructor(config: InvoicaClientConfig) {
    this.client = axios.create({
      baseURL: config.baseUrl,
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        const message = error.response?.data?.message || error.message;
        throw new InvoicaError(message, error.response?.status, error.response?.data);
      }
    );
  }

  /**
   * Make an authenticated request to the API
   */
  private async request<T>(method: string, url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.request<T>({
      method,
      url,
      data,
      ...config,
    });
    return response.data;
  }

  /**
   * Get a single invoice by ID
   */
  async getInvoice(id: string): Promise<Invoice> {
    return this.request<Invoice>('GET', `/invoices/${id}`);
  }

  /**
   * Create a new invoice
   */
  async createInvoice(params: CreateInvoiceParams): Promise<Invoice> {
    return this.request<Invoice>('POST', '/invoices', params);
  }

  /**
   * Get a single settlement by ID
   */
  async getSettlement(id: string): Promise<Settlement> {
    return this.request<Settlement>('GET', `/settlements/${id}`);
  }

  /**
   * List all settlements with optional filtering
   */
  async listSettlements(params?: { limit?: number; offset?: number }): Promise<SettlementListResponse> {
    return this.request<SettlementListResponse>('GET', '/settlements', undefined, { params });
  }

  /**
   * List all invoices with optional filtering
   */
  async listInvoices(params?: { limit?: number; offset?: number; status?: string }): Promise<InvoiceListResponse> {
    return this.request<InvoiceListResponse>('GET', '/invoices', undefined, { params });
  }

  /**
   * Create a new API key
   */
  async createApiKey(params: CreateApiKeyParams): Promise<ApiKey> {
    return this.request<ApiKey>('POST', '/api-keys', params);
  }

  /**
   * Revoke an API key by ID
   */
  async revokeApiKey(id: string): Promise<void> {
    return this.request<void>('DELETE', `/api-keys/${id}`);
  }

  /**
   * List all API keys
   */
  async listApiKeys(): Promise<ApiKeyListResponse> {
    return this.request<ApiKeyListResponse>('GET', '/api-keys');
  }
}