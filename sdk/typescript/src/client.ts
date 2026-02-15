import axios, { AxiosInstance, AxiosError } from 'axios';

export class InvoicaError extends Error {
  constructor(public message: string, public statusCode?: number) {
    super(message);
    this.name = 'InvoicaError';
  }
}

export class InvoicaClient {
  private client: AxiosInstance;

  constructor(private apiKey: string, private baseUrl = 'https://api.invoica.ai') {
    this.client = axios.create({ baseURL: this.baseUrl });
    this.client.interceptors.request.use((config) => {
      config.headers['Authorization'] = `Bearer ${this.apiKey}`;
      config.headers['X-Invoica-Version'] = '2024-01-01';
      return config;
    });
  }

  async createInvoice(data: Record<string, unknown>) {
    try {
      const response = await this.client.post('/invoices', data);
      return response.data;
    } catch (e) {
      const err = e as AxiosError;
      throw new InvoicaError(err.message, err.response?.status);
    }
  }

  async getInvoice(id: string) {
    try {
      const response = await this.client.get(`/invoices/${id}`);
      return response.data;
    } catch (e) {
      const err = e as AxiosError;
      throw new InvoicaError(err.message, err.response?.status);
    }
  }

  async listInvoices() {
    try {
      const response = await this.client.get('/invoices');
      return response.data;
    } catch (e) {
      const err = e as AxiosError;
      throw new InvoicaError(err.message, err.response?.status);
    }
  }
}