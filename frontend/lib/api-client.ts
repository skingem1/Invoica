import { Invoice } from '@/types/invoices';
import { ApiError } from '@/lib/errors';

export interface ApiConfig {
  baseUrl?: string;
  headers?: Record<string, string>;
}

let apiConfig: ApiConfig = {
  baseUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000',
  headers: {
    'Content-Type': 'application/json',
  },
};

export function configureApi(config: Partial<ApiConfig>) {
  apiConfig = { ...apiConfig, ...config };
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new ApiError(
      errorData.message || `API Error: ${response.status}`,
      response.status,
      errorData
    );
  }
  return response.json();
}

export async function apiGet<T>(
  endpoint: string,
  params?: Record<string, string | undefined>
): Promise<T> {
  const url = new URL(`${apiConfig.baseUrl}${endpoint}`);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        url.searchParams.append(key, value);
      }
    });
  }

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: apiConfig.headers,
    
  });

  return handleResponse<T>(response);
}

export async function apiPost<T>(
  endpoint: string,
  data?: unknown
): Promise<T> {
  const response = await fetch(`${apiConfig.baseUrl}${endpoint}`, {
    method: 'POST',
    headers: apiConfig.headers,
    
    body: data ? JSON.stringify(data) : undefined,
  });

  return handleResponse<T>(response);
}

export async function apiDelete<T>(endpoint: string): Promise<T> {
  const response = await fetch(`${apiConfig.baseUrl}${endpoint}`, {
    method: 'DELETE',
    headers: apiConfig.headers,
    
  });

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

export async function createNewApiKey(
  name: string,
  expiresInDays?: number
): Promise<CreateApiKeyResponse> {
  return apiPost<CreateApiKeyResponse>('/v1/api-keys', {
    name,
    expiresInDays,
  });
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

export interface InvoiceListResponse {
  invoices: Array<{
    id: string;
    invoiceNumber: string;
    amount: number;
    currency: string;
    status: string;
    createdAt: string;
  }>;
  total: number;
  limit: number;
  offset: number;
}

export async function fetchInvoices(
  params?: { limit?: string; offset?: string; status?: string }
): Promise<InvoiceListResponse> {
  return apiGet<InvoiceListResponse>('/v1/invoices', params);
}


export async function fetchInvoiceById(id: string): Promise<Invoice> {
  return apiGet<Invoice>(`/v1/invoices/${id}`);
}

export { ApiError };
