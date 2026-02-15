import { InvoicaConfig, RequestOptions } from './config';
import { Invoice, CreateInvoiceParams, SettlementStatus, GetSettlementParams } from './types';
import { validateParams } from './validation';

export class InvoicaClient {
  private readonly config: InvoicaConfig;
  private readonly baseUrl: string;

  constructor(config: InvoicaConfig) {
    this.config = config;
    this.baseUrl = config.baseUrl + '/v1';
  }

  private async request<T>(method: string, path: string, options?: RequestOptions): Promise<T> {
    const url = new URL(this.baseUrl + path);
    if (options?.params) {
      Object.entries(options.params).forEach(([key, value]) => {
        if (value !== undefined) url.searchParams.append(key, String(value));
      });
    }
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.config.apiKey}`,
      ...options?.headers,
    };
    const response = await fetch(url.toString(), { method, headers, body: options?.body ? JSON.stringify(options.body) : undefined });
    if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
    return response.json();
  }

  async getInvoice(invoiceId: string): Promise<Invoice> {
    return this.request<Invoice>('GET', `/invoices/${invoiceId}`);
  }

  async createInvoice(params: CreateInvoiceParams): Promise<Invoice> {
    validateParams(params);
    return this.request<Invoice>('POST', '/invoices', { body: params });
  }

  async getSettlement(params: GetSettlementParams): Promise<SettlementStatus> {
    return this.request<SettlementStatus>('GET', `/settlements/${params.invoiceId}`);
  }

  async listSettlements(invoiceId?: string): Promise<SettlementStatus[]> {
    const query = invoiceId ? { invoiceId } : {};
    return this.request<SettlementStatus[]>('GET', '/settlements', { params: query });
  }

  async listInvoices(params?: { limit?: number; offset?: number }): Promise<{ invoices: Invoice[]; total: number; limit: number; offset: number }> {
    const query: Record<string, string> = {};
    if (params?.limit !== undefined) query.limit = String(params.limit);
    if (params?.offset !== undefined) query.offset = String(params.offset);
    return this.request<{ invoices: Invoice[]; total: number; limit: number; offset: number }>('GET', '/invoices', { params: query });
  }
}