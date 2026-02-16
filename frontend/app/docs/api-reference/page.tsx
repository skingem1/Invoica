import React from 'react';

interface Endpoint {
  method: string;
  path: string;
  description: string;
}

const endpoints: Endpoint[] = [
  { method: 'POST', path: '/v1/invoices', description: 'Create a new invoice' },
  { method: 'GET', path: '/v1/invoices/:id', description: 'Get invoice by ID' },
  { method: 'GET', path: '/v1/invoices/number/:number', description: 'Get invoice by number' },
  { method: 'POST', path: '/v1/api-keys', description: 'Create a new API key' },
  { method: 'GET', path: '/v1/api-keys', description: 'List API keys for customer' },
  { method: 'POST', path: '/v1/api-keys/:id/revoke', description: 'Revoke an API key' },
  { method: 'POST', path: '/v1/api-keys/:id/rotate', description: 'Rotate an API key' },
  { method: 'POST', path: '/v1/webhooks', description: 'Register a webhook endpoint' },
  { method: 'GET', path: '/v1/webhooks', description: 'List registered webhooks' },
  { method: 'DELETE', path: '/v1/webhooks/:id', description: 'Remove a webhook' },
  { method: 'GET', path: '/v1/settlements/:id', description: 'Get settlement by ID' },
  { method: 'GET', path: '/v1/settlements', description: 'List settlements' },
  { method: 'GET', path: '/v1/health', description: 'Health check' },
];

const methodColors: Record<string, string> = {
  GET: 'bg-green-100 text-green-800',
  POST: 'bg-blue-100 text-blue-800',
  DELETE: 'bg-red-100 text-red-800',
};

export default function ApiReferencePage() {
  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-6">API Reference</h1>
      <p className="text-gray-600 mb-8">Complete list of Invoica REST API endpoints.</p>
      <div className="space-y-2">
        {endpoints.map((ep) => (
          <div key={`${ep.method}-${ep.path}`} className="flex items-center gap-4 p-3 border rounded-lg hover:bg-gray-50">
            <span className={`px-2 py-1 rounded text-xs font-mono font-bold ${methodColors[ep.method] || 'bg-gray-100'}`}>{ep.method}</span>
            <code className="text-sm font-mono text-gray-800 min-w-[260px]">{ep.path}</code>
            <span className="text-sm text-gray-500">{ep.description}</span>
          </div>
        ))}
      </div>
    </div>
  );
}