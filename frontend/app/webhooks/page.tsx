'use client';

import { useEffect, useState } from 'react';

interface Webhook {
  id: string;
  url: string;
  events: string[];
  status: 'active' | 'inactive';
  createdAt: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export default function WebhooksPage() {
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchWebhooks() {
      try {
        setLoading(true);
        const response = await fetch(`${API_URL}/v1/webhooks`);
        if (!response.ok) {
          throw new Error('Failed to fetch webhooks');
        }
        const data = await response.json();
        setWebhooks(data.webhooks || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    }

    fetchWebhooks();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-slate-900 mb-6">Webhooks</h1>
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Webhooks</h1>

      {webhooks.length === 0 ? (
        <div className="text-slate-500 text-center py-10">No webhooks registered</div>
      ) : (
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-600">URL</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Events</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {webhooks.map((webhook) => (
                <tr key={webhook.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{webhook.url}</td>
                  <td className="px-4 py-3 text-slate-500">{webhook.events.join(', ')}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      webhook.status === 'active'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-slate-100 text-slate-600'
                    }`}>
                      {webhook.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {new Date(webhook.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
