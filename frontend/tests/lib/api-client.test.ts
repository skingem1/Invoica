import { fetchDashboardStats, fetchRecentActivity, fetchSettlement } from '@/lib/api-client';

global.fetch = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
});

describe('fetchDashboardStats', () => {
  it('returns dashboard stats on success', async () => {
    const mockStats = { totalInvoices: 10, pending: 2, settled: 8, revenue: 5000 };
    (fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => mockStats });
    
    const result = await fetchDashboardStats();
    expect(result).toEqual(mockStats);
    expect(fetch).toHaveBeenCalledWith('/api/v1/dashboard/stats', expect.any(Object));
  });

  it('throws error on API failure', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({ ok: false, status: 500 });
    
    await expect(fetchDashboardStats()).rejects.toThrow('API Error: 500');
  });
});

describe('fetchRecentActivity', () => {
  it('returns activity list on success', async () => {
    const mockActivity = [{ id: '1', type: 'invoice' as const, title: 'Test', description: 'desc', timestamp: '2024-01-01', status: 'success' as const }];
    (fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => mockActivity });
    
    const result = await fetchRecentActivity();
    expect(result).toEqual(mockActivity);
  });
});

describe('fetchSettlement', () => {
  it('returns settlement data for invoice', async () => {
    const mockSettlement = { invoiceId: 'inv-123', status: 'confirmed', txHash: '0xabc', chain: 'ethereum', confirmedAt: '2024-01-01', amount: 1000, currency: 'USD' };
    (fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => mockSettlement });
    
    const result = await fetchSettlement('inv-123');
    expect(result).toEqual(mockSettlement);
    expect(fetch).toHaveBeenCalledWith('/api/v1/settlements/inv-123', expect.any(Object));
  });
});