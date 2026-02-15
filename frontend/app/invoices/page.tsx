```tsx
"use client";

import { useState, useEffect } from "react";
import { fetchInvoices } from "@/lib/api-client";
import type { InvoiceListResponse } from "@/types/invoices";

type Invoice = InvoiceListResponse["invoices"][number];

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadInvoices() {
      try {
        const data = await fetchInvoices();
        setInvoices(data.invoices);
      } catch (error) {
        console.error("Failed to fetch invoices:", error);
      } finally {
        setLoading(false);
      }
    }

    loadInvoices();
  }, []);

  if (loading) {
    return (
      <div className="loading-spinner" role="status">
        <span className="sr-only">Loading invoices...</span>
      </div>
    );
  }

  if (invoices.length === 0) {
    return <div>No invoices found</div>;
  }

  return (
    <div>
      <h1>Invoices</h1>
      <table>
        <thead>
          <tr>
            <th>Invoice Number</th>
            <th>Amount</th>
            <th>Currency</th>
            <th>Status</th>
            <th>Created</th>
          </tr>
        </thead>
        <tbody>
          {invoices.map((invoice) => (
            <tr key={invoice.id}>
              <td>{invoice.invoice_number}</td>
              <td>{invoice.amount}</td>
              <td>{invoice.currency}</td>
              <td>{invoice.status}</td>
              <td>{invoice.created_at}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```