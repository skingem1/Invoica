import { InvoicaClient } from '../src/client';
import { SettlementStatus } from '../src/types';

describe('InvoicaClient', () => {
  const client = new InvoicaClient({ apiKey: 'test-key', baseUrl: 'http://localhost' });

  describe('getSettlement', () => {
    it('returns settlement for valid invoiceId', async () => {
      const mock: SettlementStatus = { id: 's1', invoiceId: 'inv1', status: 'completed', amount: 100 };
      global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => mock });

      const result = await client.getSettlement({ invoiceId: 'inv1' });
      expect(result).toEqual(mock);
    });

    it('throws on API error', async () => {
      global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 404, statusText: 'Not Found' });

      await expect(client.getSettlement({ invoiceId: 'inv1' })).rejects.toThrow('Invoica API error: 404');
    });
  });

  describe('listSettlements', () => {
    it('returns all settlements when no invoiceId', async () => {
      const mock: SettlementStatus[] = [{ id: 's1', invoiceId: 'inv1', status: 'completed', amount: 100 }];
      global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => mock });

      const result = await client.listSettlements();
      expect(result).toEqual(mock);
    });

    it('filters by invoiceId when provided', async () => {
      const mock: SettlementStatus[] = [{ id: 's1', invoiceId: 'inv1', status: 'completed', amount: 100 }];
      global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => mock });

      const result = await client.listSettlements('inv1');
      expect(global.fetch).toHaveBeenCalledWith('http://localhost/v1/settlements?invoiceId=inv1', expect.any(Object));
      expect(result).toEqual(mock);
    });
  });
});