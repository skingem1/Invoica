const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

async function apiGet<T>(endpoint: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!response.ok) throw new Error(`API Error: ${response.status}`);
  return response.json();
}

async function apiPost<T>(endpoint: string, data: unknown): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error(`API Error: ${response.status}`);
  return response.json();
}

export interface Invoice {
  id: string;
  amount: number;
  currency: string;
  status: string;
  createdAt: string;
}

export async function fetchInvoices(): Promise<Invoice[]> {
  return apiGet<Invoice[]>('/v1/invoices');
}

export async function fetchInvoiceById(id: string): Promise<Invoice> {
  return apiGet<Invoice>(`/v1/invoices/${id}`);
}

export interface DashboardStats {
  totalInvoices: number;
  pending: number;
  settled: number;
  revenue: number;
}

export interface RecentActivityItem {
  id: string;
  type: 'invoice' | 'payment';
  title: string;
  description: string;
  timestamp: string;
  status: 'success' | 'pending' | 'failed';
}

export async function fetchDashboardStats(): Promise<DashboardStats> {
  return apiGet<DashboardStats>('/v1/dashboard/stats');
}

export async function fetchRecentActivity(): Promise<RecentActivityItem[]> {
  return apiGet<RecentActivityItem[]>('/v1/dashboard/activity');
}

export async function fetchSettlement(invoiceId: string): Promise<{
  invoiceId: string;
  status: string;
  txHash: string | null;
  chain: string;
  confirmedAt: string | null;
  amount: number;
  currency: string;
}> {
  return apiGet(`/v1/settlements/${invoiceId}`);
}