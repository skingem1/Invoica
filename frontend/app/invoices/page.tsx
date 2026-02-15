```tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchInvoices, InvoiceListResponse } from '@/lib/api-client';
import { InvoiceTable } from '@/components/invoices/invoice-table';

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<InvoiceListResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadInvoices = async () => {
      try {
        const data = await fetchInvoices();
        setInvoices(data);
      } catch (error) {
        console.error('Failed to fetch invoices:', error);
      } finally {
        setLoading(false);
      }
    };

    loadInvoices();
  }, []);

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Invoices</h1>
        <Link
          href="/invoices/new"
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          New Invoice
        </Link>
      </div>

      {loading && (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
        </div>
      )}

      <InvoiceTable invoices={invoices?.invoices ?? []} loading={loading} />
    </div>
  );
}
```