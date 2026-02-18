'use client';

import React from 'react';

export interface InvoiceDetailProps {
  invoice: {
    id: string;
    number: string;
    amount: number;
    currency: string;
    status: string;
    createdAt: string;
    paidAt: string | null;
    metadata: Record<string, string>;
  } | null;
  isLoading?: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  processing: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  settled: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
};

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
}

function formatDate(dateString: string | null): string {
  if (!dateString) return 'Not yet';
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function InvoiceDetail({ invoice, isLoading }: InvoiceDetailProps): JSX.Element {
  if (isLoading) {
    return <div className="p-4">Loading invoice details...</div>;
  }

  if (!invoice) {
    return <div className="p-4">Invoice not found</div>;
  }

  const statusColor = STATUS_COLORS[invoice.status.toLowerCase()] || 'bg-gray-100 text-gray-800';

  return (
    <div className="rounded-lg border border-slate-200 p-6 space-y-4">
      <h2 className="font-bold text-xl">{invoice.number}</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <span className="text-slate-500 text-sm">Amount</span>
          <p className="font-medium">{formatCurrency(invoice.amount, invoice.currency)}</p>
        </div>
        <div>
          <span className="text-slate-500 text-sm">Status</span>
          <p>
            <span className={`inline-block px-2 py-1 rounded text-sm font-medium ${statusColor}`}>
              {invoice.status}
            </span>
          </p>
        </div>
        <div>
          <span className="text-slate-500 text-sm">Created</span>
          <p className="font-medium">{formatDate(invoice.createdAt)}</p>
        </div>
        <div>
          <span className="text-slate-500 text-sm">Paid</span>
          <p className="font-medium">{formatDate(invoice.paidAt)}</p>
        </div>
      </div>
      {Object.keys(invoice.metadata).length > 0 && (
        <div>
          <span className="text-slate-500 text-sm">Metadata</span>
          <pre className="mt-1 bg-slate-50 p-3 rounded text-sm overflow-x-auto">
            {JSON.stringify(invoice.metadata, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
