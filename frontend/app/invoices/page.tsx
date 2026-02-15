'use client';

import { useState, useEffect } from 'react';
import { fetchInvoices, InvoiceListResponse } from '@/lib/api-client';

type Invoice = InvoiceListResponse['invoices'][number];

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadInvoices() {
      try {
        const data = await fetchInvoices();
        setInvoices(data.invoices);
      } catch (error) {
        console.error('Failed to fetch invoices:', error);
      } finally {
        setLoading(false);
      }
    }

    loadInvoices();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-600" />
      </div>
    );
  }

  if (invoices.length === 0) {
    return (
      <div className="text-center py-20 text-slate-500">
        No invoices found.
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Invoices</h1>
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Invoice Number</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Amount</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Currency</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {invoices.map((invoice) => (
              <tr key={invoice.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-slate-900">{invoice.invoiceNumber}</td>
                <td className="px-4 py-3 text-slate-700">{invoice.amount.toFixed(2)}</td>
                <td className="px-4 py-3 text-slate-500">{invoice.currency}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    invoice.status === 'paid' ? 'bg-green-100 text-green-700' :
                    invoice.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                    invoice.status === 'overdue' ? 'bg-red-100 text-red-700' :
                    'bg-slate-100 text-slate-600'
                  }`}>
                    {invoice.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-500">
                  {new Date(invoice.createdAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
