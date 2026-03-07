'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth-provider';
import { fetchAdminSystem, fetchInvoices, AdminSystemData } from '@/lib/api-client';

const ADMIN_EMAILS = ['skininthegem@gmail.com', 'twmnif@gmail.com'];

function formatUptime(ms: number | null): string {
  if (!ms) return '—';
  const s = Math.floor((Date.now() - ms) / 1000);
  if (s < 60) return s + 's';
  if (s < 3600) return Math.floor(s / 60) + 'm';
  if (s < 86400) return Math.floor(s / 3600) + 'h ' + Math.floor((s % 3600) / 60) + 'm';
  return Math.floor(s / 86400) + 'd ' + Math.floor((s % 86400) / 3600) + 'h';
}

function formatBytes(bytes: number): string {
  if (!bytes) return '—';
  return (bytes / 1024 / 1024).toFixed(0) + 'mb';
}

function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { label: string; cls: string }> = {
    online:     { label: 'online',      cls: 'bg-green-100 text-green-800' },
    stopped:    { label: 'idle',        cls: 'bg-slate-100 text-slate-600' },
    errored:    { label: 'errored',     cls: 'bg-red-100 text-red-700' },
    launching:  { label: 'starting',    cls: 'bg-amber-100 text-amber-700' },
    approved:   { label: 'approved',    cls: 'bg-green-100 text-green-800' },
    rejected:   { label: 'rejected',    cls: 'bg-red-100 text-red-700' },
    pending:    { label: 'pending',     cls: 'bg-amber-100 text-amber-700' },
    running:    { label: 'running',     cls: 'bg-blue-100 text-blue-700' },
    review:     { label: 'review',      cls: 'bg-purple-100 text-purple-700' },
    COMPLETED:  { label: 'paid',        cls: 'bg-green-100 text-green-800' },
    SETTLED:    { label: 'settled',     cls: 'bg-green-100 text-green-800' },
    PENDING:    { label: 'pending',     cls: 'bg-amber-100 text-amber-700' },
    PROCESSING: { label: 'processing',  cls: 'bg-blue-100 text-blue-700' },
  };
  const c = cfg[status] ?? { label: status, cls: 'bg-slate-100 text-slate-500' };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${c.cls}`}>
      {c.label}
    </span>
  );
}

const PERSISTENT = new Set(['backend', 'ceo-ai-bot', 'openclaw-gateway', 'sprint-runner']);

export default function AdminPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [system, setSystem] = useState<AdminSystemData | null>(null);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      const [sys, inv] = await Promise.all([
        fetchAdminSystem(),
        fetchInvoices({ limit: '20' }),
      ]);
      setSystem(sys);
      setInvoices(inv.invoices ?? []);
      setLastUpdated(new Date());
    } catch (e: any) {
      setError(e.message ?? 'Failed to load');
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!loading && user && !ADMIN_EMAILS.includes(user.email ?? '')) {
      router.push('/');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (!loading && user && ADMIN_EMAILS.includes(user.email ?? '')) {
      load();
      const interval = setInterval(load, 30000);
      return () => clearInterval(interval);
    }
  }, [user, loading, load]);

  if (loading || !user) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#635BFF]" />
      </div>
    );
  }

  if (!ADMIN_EMAILS.includes(user.email ?? '')) return null;

  const persistent = system?.processes.filter(p => PERSISTENT.has(p.name)) ?? [];
  const cron       = system?.processes.filter(p => !PERSISTENT.has(p.name)) ?? [];

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Admin Dashboard</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {lastUpdated ? `Last updated ${lastUpdated.toLocaleTimeString()}` : 'Loading…'}
          </p>
        </div>
        <button
          onClick={load}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#635BFF] rounded-lg hover:bg-[#4f46e5] disabled:opacity-50 transition-colors"
        >
          <svg
            className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          Refresh
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* PM2 Process Monitor */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-900">Process Monitor</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {system
              ? `${system.processes.length} processes — server time ${new Date(system.serverTime).toLocaleTimeString()}`
              : 'Loading…'}
          </p>
        </div>

        {persistent.length > 0 && (
          <>
            <div className="px-6 py-2 bg-slate-50 border-b border-slate-100">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Always-on</p>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500 border-b border-slate-100">
                  <th className="px-6 py-2 font-medium">Name</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium">PID</th>
                  <th className="px-4 py-2 font-medium">Uptime</th>
                  <th className="px-4 py-2 font-medium">Restarts</th>
                  <th className="px-4 py-2 font-medium">Memory</th>
                </tr>
              </thead>
              <tbody>
                {persistent.map(p => (
                  <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="px-6 py-3 font-medium text-slate-800">{p.name}</td>
                    <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
                    <td className="px-4 py-3 text-slate-500 font-mono text-xs">{p.pid ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{formatUptime(p.uptime)}</td>
                    <td className="px-4 py-3 text-slate-600">{p.restarts}</td>
                    <td className="px-4 py-3 text-slate-600">{formatBytes(p.memory)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {cron.length > 0 && (
          <>
            <div className="px-6 py-2 bg-slate-50 border-b border-slate-100 border-t">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Scheduled (cron)</p>
            </div>
            <table className="w-full text-sm">
              <tbody>
                {cron.map(p => (
                  <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="px-6 py-2.5 font-medium text-slate-700 w-48">{p.name}</td>
                    <td className="px-4 py-2.5"><StatusBadge status={p.status} /></td>
                    <td className="px-4 py-2.5 text-slate-400 text-xs">restarts: {p.restarts}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {!system && (
          <div className="px-6 py-8 text-center text-sm text-slate-400">
            Fetching process data…
          </div>
        )}
      </div>

      {/* Sprint Status + Git Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Sprint Status */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="text-base font-semibold text-slate-900">Sprint Status</h2>
            {system?.sprint && (
              <p className="text-xs text-slate-500 mt-0.5 font-mono truncate">{system.sprint.file}</p>
            )}
          </div>
          {system?.sprint ? (
            <div className="p-6 space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-slate-600">
                    {system.sprint.approved}/{system.sprint.total} approved
                  </span>
                  <span className="text-slate-500">
                    {system.sprint.rejected} rejected · {system.sprint.pending} pending
                  </span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2">
                  <div
                    className="bg-[#635BFF] h-2 rounded-full transition-all"
                    style={{
                      width: `${system.sprint.total
                        ? (system.sprint.approved / system.sprint.total) * 100
                        : 0}%`,
                    }}
                  />
                </div>
              </div>
              <div className="space-y-1 max-h-72 overflow-y-auto">
                {system.sprint.tasks.map(t => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between py-1.5 border-b border-slate-50 last:border-0"
                  >
                    <div className="flex-1 min-w-0 mr-3">
                      <span className="text-xs font-mono text-slate-700 truncate block">{t.id}</span>
                      <span className="text-xs text-slate-400">{t.agent} · {t.type}</span>
                    </div>
                    <StatusBadge status={t.status} />
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-6 text-sm text-slate-400">
              {system ? 'No sprint data found' : 'Loading…'}
            </div>
          )}
        </div>

        {/* Git Activity */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="text-base font-semibold text-slate-900">Git Activity</h2>
            <p className="text-xs text-slate-500 mt-0.5">Last 20 commits</p>
          </div>
          <div className="overflow-y-auto max-h-96">
            {system?.commits && system.commits.length > 0 ? (
              <ul className="divide-y divide-slate-50">
                {system.commits.map((c, i) => {
                  const sha = c.slice(0, 7);
                  const msg = c.slice(8);
                  return (
                    <li key={i} className="px-6 py-2.5 hover:bg-slate-50 flex gap-3 items-start">
                      <span className="font-mono text-xs text-[#635BFF] shrink-0 pt-0.5">{sha}</span>
                      <span className="text-sm text-slate-700 leading-snug">{msg}</span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="px-6 py-4 text-sm text-slate-400">
                {system ? 'No commits' : 'Loading…'}
              </p>
            )}
          </div>
        </div>

      </div>

      {/* Invoice Summary */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-900">Invoices</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {invoices.length} invoice{invoices.length !== 1 ? 's' : ''}
          </p>
        </div>
        {invoices.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 border-b border-slate-100">
                <th className="px-6 py-2 font-medium">#</th>
                <th className="px-4 py-2 font-medium">Customer</th>
                <th className="px-4 py-2 font-medium">Amount</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv: any) => (
                <tr key={inv.id} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="px-6 py-3 font-mono text-xs text-slate-500">#{inv.invoiceNumber}</td>
                  <td className="px-4 py-3 text-slate-800 font-medium">
                    {inv.customerName || inv.customerEmail || '—'}
                  </td>
                  <td className="px-4 py-3 text-slate-700 font-medium">
                    {inv.amount} {inv.currency}
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={inv.status} /></td>
                  <td className="px-4 py-3 text-slate-500">
                    {new Date(inv.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="px-6 py-4 text-sm text-slate-400">
            {refreshing ? 'Loading…' : 'No invoices'}
          </p>
        )}
      </div>

    </div>
  );
}

