import { CreateInvoiceParams, Invoice, InvoiceFilter } from './types';

export class CountableClient {
  private baseUrl: string;
  private apiKey: string;

  constructor(baseUrl: string, apiKey: string) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }
    return response.json();
  }

  createInvoice(params: CreateInvoiceParams): Promise<Invoice> {
    return this.request<Invoice>('POST', '/invoices', params);
  }

  getInvoice(id: string): Promise<Invoice> {
    return this.request<Invoice>('GET', `/invoices/${id}`);
  }

  listInvoices(filter?: InvoiceFilter): Promise<Invoice[]> {
    const query = filter ? `?${new URLSearchParams(filter as Record<string, string>).toString()}` : '';
    return this.request<Invoice[]>('GET', `/invoices${query}`);
  }
}