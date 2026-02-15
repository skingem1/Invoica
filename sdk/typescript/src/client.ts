import { InvoicaConfig, RequestOptions } from './config';
import { Invoice, InvoiceStatus, CreateInvoiceParams, SettlementStatus, GetSettlementParams } from './types';
import { validateParams } from './validation';

export class InvoicaClient {
  private readonly config: InvoicaConfig;
  private readonly baseUrl: string;

  constructor(config: InvoicaConfig) {
    this.config = config;
    this.baseUrl = `${config.baseUrl}/v1`;
  }

  private async request<T>(method: string, path: string, options?: RequestOptions): Promise<T> {
    const url = `${this.baseUrl}${path}${options?.query ? `?${new URLSearchParams(options.query as Record<string, string>).toString()}` : ''}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.config.apiKey}`,
      ...options?.headers,
    };
    const response = await fetch(url, { method, headers, body: options?.body ? JSON.stringify(options.body) : undefined });
    if (!response.ok) throw new Error(`Invoica API error: ${response.status} ${response.statusText}`);
    return response.json() as Promise<T>;
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
    return this.request<SettlementStatus[]>('GET', '/settlements', { query: invoiceId ? { invoiceId } : undefined });
  }
}