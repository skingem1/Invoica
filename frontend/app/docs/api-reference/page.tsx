import React from 'react';

const endpoints = [
  { method: 'POST', path: '/invoices', description: 'Create a new invoice' },
  { method: 'GET', path: '/invoices', description: 'List all invoices' },
  { method: 'GET', path: '/invoices/:id', description: 'Get invoice details' },
  { method: 'POST', path: '/settlements', description: 'Initiate settlement' },
  { method: 'GET', path: '/api-keys', description: 'List API keys' },
];

const methodStyles = {
  GET: 'bg-green-100 text-green-800',
  POST: 'bg-blue-100 text-blue-800',
};

export default function ApiReferencePage() {
  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">API Reference</h1>
      <p className="text-gray-600 mb-8">
        The Countable API is a REST API that uses standard HTTP methods. All requests should be made to the base URL: <code className="bg-gray-100 px-2 py-1 rounded">https://api.invoica.dev/v1</code>
      </p>

      <section>
        <h2 className="text-2xl font-semibold mb-4">Endpoints</h2>
        {endpoints.map((ep, i) => (
          <div key={i} className="border rounded-lg p-4 mb-4">
            <div className="flex items-center gap-3 mb-2">
              <span className={`px-2 py-1 rounded text-sm font-medium ${methodStyles[ep.method as keyof typeof methodStyles]}`}>
                {ep.method}
              </span>
              <span className="font-mono text-gray-800">{ep.path}</span>
            </div>
            <p className="text-gray-500 text-sm">{ep.description}</p>
          </div>
        ))}
      </section>

      <section className="mt-8">
        <h2 className="text-2xl font-semibold mb-4">Authentication</h2>
        <p className="text-gray-600">
          All API requests require authentication via the <code className="bg-gray-100 px-2 py-1 rounded">X-API-Key</code> header. Include your API key in the request headers for every call.
        </p>
      </section>
    </div>
  );
}