import { apiGet, apiPost, fetchInvoices, fetchInvoiceById, InvoiceListResponse } from '../../lib/api-client';

global.fetch = jest.fn();

describe('api-client', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('apiGet', () => {
    it('returns JSON on success', async () => {
      const mockData = { id: '1' };
      (fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => mockData });
      const result = await apiGet('/test');
      expect(result).toEqual(mockData);
    });

    it('throws ApiError on failure', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({ ok: false, status: 500 });
      await expect(apiGet('/test')).rejects.toEqual({ message: 'API request failed', status: 500 });
    });
  });

  describe('apiPost', () => {
    it('returns JSON on success', async () => {
      const mockData = { id: '2' };
      (fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => mockData });
      const result = await apiPost('/test', { name: 'test' });
      expect(result).toEqual(mockData);
    });
  });

  describe('fetchInvoices', () => {
    it('calls apiGet without params when no args', async () => {
      const mockResponse: InvoiceListResponse = { invoices: [], total: 0, limit: 10, offset: 0 };
      (fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => mockResponse });
      await fetchInvoices();
      expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/v1/invoices'), expect.any(Object));
    });

    it('builds query string with limit and offset', async () => {
      const mockResponse: InvoiceListResponse = { invoices: [], total: 1, limit: 5, offset: 10 };
      (fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => mockResponse });
      await fetchInvoices(5, 10);
      expect(fetch).toHaveBeenCalledWith(expect.stringContaining('limit=5&offset=10'), expect.any(Object));
    });
  });

  describe('fetchInvoiceById', () => {
    it('calls apiGet with invoice id path', async () => {
      const mockData = { id: '123', number: 'INV-001', amount: 100, currency: 'USD', status: 'pending', createdAt: '2024-01-01', paidAt: null, metadata: {} };
      (fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => mockData });
      const result = await fetchInvoiceById('123');
      expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/v1/invoices/123'), expect.any(Object));
      expect(result).toEqual(mockData);
    });
  });
});