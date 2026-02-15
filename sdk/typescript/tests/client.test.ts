import { InvoicaClient, InvoicaError } from '../src/client';

jest.mock('axios', () => ({
  create: jest.fn(() => ({
    get: jest.fn(),
    post: jest.fn(),
    interceptors: { request: { use: jest.fn() } },
  })),
}));

import axios from 'axios';
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('InvoicaClient', () => {
  let client: InvoicaClient;

  beforeEach(() => {
    jest.clearAllMocks();
    client = new InvoicaClient('test-key');
  });

  it('uses default baseUrl', () => {
    expect(mockedAxios.create).toHaveBeenCalledWith({ baseURL: 'https://api.invoica.ai' });
  });

  it('creates invoice and returns data', async () => {
    const mockInstance = mockedAxios.create();
    (mockInstance.post as jest.Mock).mockResolvedValue({ data: { id: 'inv-1' } });
    const result = await client.createInvoice({ amount: 100 });
    expect(result).toEqual({ id: 'inv-1' });
  });

  it('throws InvoicaError on failure', async () => {
    const mockInstance = mockedAxios.create();
    (mockInstance.post as jest.Mock).mockRejectedValue({ message: 'Err', response: { status: 400 } });
    await expect(client.createInvoice({})).rejects.toThrow(InvoicaError);
  });

  it('gets invoice by id', async () => {
    const mockInstance = mockedAxios.create();
    (mockInstance.get as jest.Mock).mockResolvedValue({ data: { id: 'inv-2' } });
    const result = await client.getInvoice('inv-2');
    expect(result).toEqual({ id: 'inv-2' });
  });

  it('lists all invoices', async () => {
    const mockInstance = mockedAxios.create();
    (mockInstance.get as jest.Mock).mockResolvedValue({ data: [{ id: 'inv-1' }, { id: 'inv-2' }] });
    const result = await client.listInvoices();
    expect(result).toHaveLength(2);
  });
});