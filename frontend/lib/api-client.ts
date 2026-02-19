import { createClient } from '@/lib/supabase';

export interface ApiConfig {
  baseUrl?: string;
  headers?: Record<string, string>;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://igspopoejhsxvwvxyhbh.supabase.co/functions/v1/api';

async function getAuthHeaders(): Promise<Record<string, string>> {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`;
  }
  return headers;
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || errorData.message || `API Error: ${response.status}`);
  }
  return response.json();
}

export async function apiGet<T>(endpoint: string, params?: Record<string, string | undefined>): Promise<T> {
  const url = new URL(`${API_URL}${endpoint}`);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) url.searchParams.append(key, value);
    });
  }
  const headers = await getAuthHeaders();
  const response = await fetch(url.toString(), { method: 'GET', headers });
  return handleResponse<T>(response);
}

export async function apiPost<T>(endpoint: string, data?: unknown): Promise<T> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_URL}${endpoint}`, {
    method: 'POST', headers,
    body: data ? JSON.stringify(data) : undefined,
  });
  return handleResponse<T>(response);
}

export async function apiDelete<T>(endpoint: string): Promise<T> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_URL}${endpoint}`, { method: 'DELETE', headers });
  return handleResponse<T>(response);
}

export interface Settlement {
  id: string;
  amount: number;
  currency: string;
  status: 'pending' | 'completed' | 'failed';
  createdAt: string;
  completedAt?: string;
}

export async function fetchSettlement(id: string): Promise<Settlement> {
  return apiGet<Settlement>(`/v1/settlements/${id}`);
}

export interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  expiresAt?: string;
  lastUsedAt?: string;
}

export interface CreateApiKeyResponse {
  apiKey: ApiKey;
  secret: string;
}

export async function fetchApiKeys(): Promise<ApiKey[]> {
  return apiGet<ApiKey[]>('/v1/api-keys');
}

export async function createNewApiKey(name: string, expiresInDays?: number): Promise<CreateApiKeyResponse> {
  return apiPost<CreateApiKeyResponse>('/v1/api-keys', { name, expiresInDays });
}

export async function deleteApiKey(id: string): Promise<void> {
  return apiDelete<void>(`/v1/api-keys/${id}`);
}

export async function revokeApiKey(id: string): Promise<void> {
  return apiDelete<void>(`/v1/api-keys/${id}`);
}

export async function rotateApiKey(id: string): Promise<CreateApiKeyResponse> {
  return apiPost<CreateApiKeyResponse>(`/v1/api-keys/${id}/rotate`);
}

export interface DashboardStats {
  totalInvoices: number;
  pending: number;
  settled: number;
  revenue: number;
  totalTax?: number;
}

export interface RecentActivityItem {
  id: string;
  title: string;
  description: string;
  status: 'success' | 'pending' | 'failed';
  timestamp: string;
}

export async function fetchDashboardStats(): Promise<DashboardStats> {
  return apiGet<DashboardStats>('/v1/dashboard/stats');
}

export async function fetchRecentActivity(): Promise<RecentActivityItem[]> {
  return apiGet<RecentActivityItem[]>('/v1/dashboard/activity');
}

export interface TaxSummary {
  totalSubtotal: number;
  totalTax: number;
  totalWithTax: number;
  invoiceCount: number;
  byCountry: Record<string, { count: number; subtotal: number; tax: number }>;
}

export async function fetchTaxSummary(): Promise<{ success: boolean; data: TaxSummary }> {
  return apiGet<{ success: boolean; data: TaxSummary }>('/v1/dashboard/tax-summary');
}

export interface InvoiceListItem {
  id: string;
  invoiceNumber: string;
  amount: number;
  currency: string;
  status: string;
  createdAt: string;
  settledAt?: string;
  customerName?: string;
  customerEmail?: string;
  sellerName?: string;
  serviceDescription?: string;
  subtotal?: number;
  taxRate?: number;
  taxAmount?: number;
  total?: number;
  taxType?: string;
  taxCountry?: string;
}

export interface InvoiceListResponse {
  invoices: InvoiceListItem[];
  total: number;
  limit: number;
  offset: number;
}

export async function fetchInvoices(params?: { limit?: string; offset?: string; status?: string }): Promise<InvoiceListResponse> {
  return apiGet<InvoiceListResponse>('/v1/invoices', params);
}

export async function fetchInvoiceById(id: string): Promise<InvoiceListItem & { metadata?: Record<string, unknown> }> {
  return apiGet<InvoiceListItem & { metadata?: Record<string, unknown> }>(`/v1/invoices/${id}`);
}

export class ApiError extends Error {
  status: number;
  data?: unknown;
  constructor(message: string, status: number, data?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}
