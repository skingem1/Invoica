```tsx
"use client";

import Link from "next/link";

export default function GettingStarted() {
  return (
    <div className="max-w-4xl mx-auto py-12 px-6">
      <h1 className="text-3xl font-bold mb-8">Getting Started</h1>

      <section className="mb-10">
        <h2 className="text-2xl font-semibold mb-4">Install</h2>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>npm install @countable/invoica-sdk</code>
        </pre>
      </section>

      <section className="mb-10">
        <h2 className="text-2xl font-semibold mb-4">Quick Start</h2>

        <h3 className="text-xl font-medium mb-3">Initialize Client</h3>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto mb-6">
          <code>{`import { InvoicaClient } from '@countable/invoica-sdk';

const client = new InvoicaClient({
  apiKey: 'inv_live_xxxxx'
});`}</code>
        </pre>

        <h3 className="text-xl font-medium mb-3">Create Invoice</h3>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto mb-6">
          <code>{`const invoice = await client.invoices.create({
  customer_email: 'customer@example.com',
  line_items: [{ description: 'Service', amount: 5000 }]
});`}</code>
        </pre>

        <h3 className="text-xl font-medium mb-3">Verify Webhook</h3>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{`const payload = await client.webhooks.verify(
  request.headers,
  request.body
);`}</code>
        </pre>
      </section>

      <section>
        <h2 className="text-2xl font-semibold mb-4">Authentication</h2>
        <p className="text-gray-600 mb-4">
          The SDK uses API key authentication. Keys follow the format:{" "}
          <code className="bg-gray-100 px-2 py-1 rounded">inv_live_xxxxx</code> or{" "}
          <code className="bg-gray-100 px-2 py-1 rounded">inv_test_xxxxx</code>.
        </p>
        <p className="text-gray-600">
          Get your API keys from the{" "}
          <Link href="/api-keys" className="text-blue-600 hover:underline">
            API Keys
          </Link>{" "}
          page.
        </p>
      </section>
    </div>
  );
}
```