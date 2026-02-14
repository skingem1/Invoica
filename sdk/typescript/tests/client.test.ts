import { CountableClient } from '../src/client';
import { CreateInvoiceParams, Invoice, InvoiceFilter } from '../src/types';

global.fetch = jest.fn();

describe('CountableClient', () => {
  const client = new CountableClient('https://api.countable.com', 'test-key');

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('createInvoice sends POST request with params', async () => {
    const mockInvoice: Invoice = { id: 'inv-1', amount: 100, status: 'pending' };
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => mockInvoice });

    const result = await client.createInvoice({ amount: 100, customerId: 'cust-1' });

    expect(fetch).toHaveBeenCalledWith('https://api.countable.com/invoices',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ amount: 100, customerId: 'cust-1' }) }));
    expect(result).toEqual(mockInvoice);
  });

  it('getInvoice sends GET request with id path', async () => {
    const mockInvoice: Invoice = { id: 'inv-1', amount: 100, status: 'pending' };
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => mockInvoice });

    const result = await client.getInvoice('inv-1');

    expect(fetch).toHaveBeenCalledWith('https://api.countable.com/invoices/inv-1',
      expect.objectContaining({ method: 'GET' }));
    expect(result).toEqual(mockInvoice);
  });

  it('listInvoices sends GET with filter query params', async () => {
    const mockInvoices: Invoice[] = [{ id: 'inv-1', amount: 100, status: 'pending' }];
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => mockInvoices });

    const filter: InvoiceFilter = { status: 'pending' };
    const result = await client.listInvoices(filter);

    expect(fetch).toHaveBeenCalledWith('https://api.countable.com/invoices?status=pending',
      expect.objectContaining({ method: 'GET' }));
    expect(result).toEqual(mockInvoices);
  });

  it('listInvoices returns all when no filter provided', async () => {
    const mockInvoices: Invoice[] = [];
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => mockInvoices });

    const result = await client.listInvoices();

    expect(fetch).toHaveBeenCalledWith('https://api.countable.com/invoices',
      expect.objectContaining({ method: 'GET' }));
    expect(result).toEqual(mockInvoices);
  });

  it('throws error on failed request', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 404 });

    await expect(client.getInvoice('bad-id')).rejects.toThrow('Request failed with status 404');
  });
});