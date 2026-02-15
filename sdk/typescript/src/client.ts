import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import {
  Invoice,
  InvoiceCreateInput,
  Settlement,
  SettlementListResponse,
  InvoiceListResponse,
  ApiKey,
  ApiKeyCreateResponse,
  WebhookRegistrationConfig,
  WebhookRegistration,
  WebhookListResponse,
} from './types';

export class InvoicaClient {
  private readonly client: AxiosInstance;

  constructor(private readonly config: { baseUrl: string; apiKey: string }) {
    this.client = axios.create({
      baseURL: config.baseUrl,
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
    });
  }

  private async request<T>(method: string, url: string, data?: unknown): Promise<T> {
    const config: AxiosRequestConfig = {
      method,
      url,
      ...(data && { data }),
    };

    try {
      const response = await this.client.request<T>(config);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const message = error.response?.data?.message || error.message;
        throw new Error(`Invoica API Error: ${message}`);
      }
      throw error;
    }
  }

  async getInvoice(id: string): Promise<Invoice> {
    return this.request<Invoice>('GET', `/invoices/${id}`);
  }

  async createInvoice(input: InvoiceCreateInput): Promise<Invoice> {
    return this.request<Invoice>('POST', '/invoices', input);
  }

  async getSettlement(id: string): Promise<Settlement> {
    return this.request<Settlement>('GET', `/settlements/${id}`);
  }

  async listSettlements(params?: { limit?: number; offset?: number }): Promise<SettlementListResponse> {
    const query = new URLSearchParams();
    if (params?.limit) query.append('limit', String(params.limit));
    if (params?.offset) query.append('offset', String(params.offset));
    const queryString = query.toString();
    return this.request<SettlementListResponse>('GET', `/settlements${queryString ? `?${queryString}` : ''}`);
  }

  async listInvoices(params?: { limit?: number; offset?: number; status?: string }): Promise<InvoiceListResponse> {
    const query = new URLSearchParams();
    if (params?.limit) query.append('limit', String(params.limit));
    if (params?.offset) query.append('offset', String(params.offset));
    if (params?.status) query.append('status', params.status);
    const queryString = query.toString();
    return this.request<InvoiceListResponse>('GET', `/invoices${queryString ? `?${queryString}` : ''}`);
  }

  async createApiKey(name: string): Promise<ApiKeyCreateResponse> {
    return this.request<ApiKeyCreateResponse>('POST', '/api-keys', { name });
  }

  async revokeApiKey(id: string): Promise<void> {
    return this.request<void>('DELETE', `/api-keys/${id}`);
  }

  async listApiKeys(): Promise<ApiKey[]> {
    return this.request<ApiKey[]>('GET', '/api-keys');
  }

  async registerWebhook(config: WebhookRegistrationConfig): Promise<WebhookRegistration> {
    return this.request<WebhookRegistration>('POST', '/webhooks', config);
  }

  async listWebhooks(): Promise<WebhookListResponse> {
    return this.request<WebhookListResponse>('GET', '/webhooks');
  }

  async deleteWebhook(id: string): Promise<void> {
    return this.request<void>('DELETE', `/webhooks/${id}`);
  }
}