// frontend/lib/api-client.ts

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.countable.ai';

interface RequestOptions extends RequestInit {
  params?: Record<string, string>;
}

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public data?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new ApiError(
      response.status,
      errorData.message || `HTTP error ${response.status}`,
      errorData
    );
  }
  return response.json();
}

function buildUrl(endpoint: string, params?: Record<string, string>): string {
  const url = new URL(`${API_BASE_URL}${endpoint}`);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });
  }
  return url.toString();
}

export async function apiGet<T = unknown>(
  endpoint: string,
  params?: Record<string, string>
): Promise<T> {
  const response = await fetch(buildUrl(endpoint, params), {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
  });
  return handleResponse<T>(response);
}

export async function apiPost<T = unknown>(
  endpoint: string,
  data?: unknown
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: data ? JSON.stringify(data) : undefined,
  });
  return handleResponse<T>(response);
}

export async function apiDelete(endpoint: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new ApiError(
      response.status,
      errorData.message || `HTTP error ${response.status}`,
      errorData
    );
  }
}

// ====================
// Settlement API
// ====================

export interface Settlement {
  id: string;
  customerId: string;
  amount: number;
  currency: string;
  status: 'pending' | 'completed' | 'failed';
  createdAt: string;
}

export async function fetchSettlement(settlementId: string): Promise<Settlement> {
  return apiGet<Settlement>(`/v1/settlements/${settlementId}`);
}

// ====================
// API Key Management
// ====================

export interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  tier: string;
  plan: string;
  permissions: string[];
  isActive: boolean;
  createdAt: string;
  lastUsedAt: string | null;
}

export interface CreateApiKeyResponse extends ApiKey {
  key?: string;
}

export async function fetchApiKeys(customerId: string): Promise<ApiKey[]> {
  return apiGet<ApiKey[]>('/v1/api-keys', { customerId });
}

export async function createNewApiKey(data: {
  customerId: string;
  customerEmail: string;
  name: string;
}): Promise<CreateApiKeyResponse> {
  return apiPost<CreateApiKeyResponse>('/v1/api-keys', data);
}

export async function revokeApiKey(id: string): Promise<void> {
  return apiDelete(`/v1/api-keys/${id}`);
}

export async function rotateApiKey(id: string): Promise<CreateApiKeyResponse> {
  return apiPost<CreateApiKeyResponse>(`/v1/api-keys/${id}/rotate`, {});
}

// Re-export ApiError for external use
export { ApiError };