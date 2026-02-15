export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export interface ApiError {
  message: string;
  status: number;
}

export async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(API_BASE_URL + path, {
    headers: { 'Content-Type': 'application/json' },
  });
  if (!response.ok) {
    throw { message: 'API request failed', status: response.status } as ApiError;
  }
  return response.json();
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(API_BASE_URL + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw { message: 'API request failed', status: response.status } as ApiError;
  }
  return response.json();
}

export interface InvoiceListResponse {
  invoices: { id: string; number: string; amount: number; currency: string; status: string; createdAt: string }[];
  total: number;
  limit: number;
  offset: number;
}

export async function fetchInvoices(limit?: number, offset?: number): Promise<InvoiceListResponse> {
  const params = new URLSearchParams();
  if (limit) params.set('limit', String(limit));
  if (offset) params.set('offset', String(offset));
  const query = params.toString();
  return apiGet<InvoiceListResponse>(`/v1/invoices${query ? '?' + query : ''}`);
}

export async function fetchInvoiceById(id: string): Promise<{ id: string; number: string; amount: number; currency: string; status: string; createdAt: string; paidAt: string | null; metadata: Record<string, string> }> {
  return apiGet(`/v1/invoices/${id}`);
}