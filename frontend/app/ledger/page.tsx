'use client';

import { useState, useEffect, useCallback } from 'react';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://65.108.90.178:3001';
const KEY_STORAGE = 'invoica_api_key';

interface LedgerEntry {
  lineNumber: number;
  entryDate: string;
  invoiceId: string;
  invoiceNumber: number;
  description: string;
  debitAgent: string;
  creditAgent: string;
  amount: number;
  currency: string;
  status: string;
  txHash: string | null;
  network: string;
  blockExplorer: string | null;
  createdAt: string;
  settledAt: string | null;
  completedAt: string | null;
}

interface LedgerSummaryItem {
  agentId: string;
  agentName: string;
  totalDebits: number;
  totalCredits: number;
  confirmedNetBalance: number;
  transactionCount: number;
}

interface LedgerMeta {
  companyId: string;
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  Confirmed: 'bg-green-100 text-green-700',
  Settled: 'bg-blue-100 text-blue-700',
  Processing: 'bg-yellow-100 text-yellow-700',
  Pending: 'bg-slate-100 text-slate-600',
};

export default function LedgerPage() {
  const [apiKey, setApiKey] = useState<string>('');
  const [keyInput, setKeyInput] = useState('');
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [summary, setSummary] = useState<LedgerSummaryItem[]>([]);
  const [meta, setMeta] = useState<LedgerMeta | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'ledger' | 'summary'>('ledger');
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(KEY_STORAGE);
    if (stored) setApiKey(stored);
  }, []);

  const fetchLedger = useCallback(async (key: string) => {
    setLoading(true);
    setError('');
    try {
      const [ledgerRes, summaryRes] = await Promise.all([
        fetch(`${BACKEND_URL}/v1/ledger?limit=50`, {
          headers: { Authorization: `Bearer ${key}` },
        }),
        fetch(`${BACKEND_URL}/v1/ledger/summary`, {
          headers: { Authorization: `Bearer ${key}` },
        }),
      ]);

      if (ledgerRes.status === 401) {
        setError('Invalid API key. Please check and try again.');
        localStorage.removeItem(KEY_STORAGE);
        setApiKey('');
        return;
      }

      const ledgerData = await ledgerRes.json();
      const summaryData = await summaryRes.json();

      if (ledgerData.success) {
        setEntries(ledgerData.data);
        setMeta(ledgerData.meta);
      }
      if (summaryData.success) {
        setSummary(summaryData.data);
      }
    } catch {
      setError('Failed to connect to backend.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (apiKey) fetchLedger(apiKey);
  }, [apiKey, fetchLedger]);

  const handleKeySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const k = keyInput.trim();
    if (!k.startsWith('sk_')) {
      setError('API key must start with sk_');
      return;
    }
    localStorage.setItem(KEY_STORAGE, k);
    setApiKey(k);
    setKeyInput('');
    setError('');
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/v1/ledger/export.csv`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = res.headers.get('Content-Disposition')?.split('filename=')[1]?.replace(/"/g, '') || 'invoica-ledger.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError('Download failed.');
    } finally {
      setDownloading(false);
    }
  };

  // ── No key yet: show input ──────────────────────────────────────────────────
  if (!apiKey) {
    return (
      <div className="p-6 max-w-md mx-auto mt-20">
        <div className="bg-white border border-slate-200 rounded-xl p-8 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-[#635BFF]/10 flex items-center justify-center">
              <svg className="w-5 h-5 text-[#635BFF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2a4 4 0 014-4h4m0 0l-2-2m2 2l-2 2M3 7h7m0 0V5m0 2v2" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Ledger Access</h2>
              <p className="text-sm text-slate-500">Enter your Invoica API key</p>
            </div>
          </div>
          <form onSubmit={handleKeySubmit} className="space-y-4">
            <input
              type="text"
              value={keyInput}
              onChange={e => setKeyInput(e.target.value)}
              placeholder="sk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              className="w-full px-3 py-2 font-mono text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#635BFF]/30"
              autoFocus
            />
            {error && <p className="text-sm text-red-500">{error}</p>}
            <button
              type="submit"
              className="w-full py-2 px-4 bg-[#635BFF] text-white rounded-lg text-sm font-semibold hover:bg-[#635BFF]/90"
            >
              Access Ledger
            </button>
          </form>
          <p className="text-xs text-slate-400 mt-4 text-center">
            Create an API key in the <a href="/api-keys" className="text-[#635BFF] hover:underline">API Keys</a> section
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Ledger</h1>
          {meta && (
            <p className="text-sm text-slate-500 mt-0.5">
              Company: <span className="font-mono text-slate-700">{meta.companyId}</span>
              {' · '}{meta.total} entries
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            {downloading ? 'Downloading…' : 'Export CSV'}
          </button>
          <button
            onClick={() => fetchLedger(apiKey)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-[#635BFF] text-white rounded-lg hover:bg-[#635BFF]/90"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
          <button
            onClick={() => { localStorage.removeItem(KEY_STORAGE); setApiKey(''); setEntries([]); setSummary([]); }}
            className="text-xs text-slate-400 hover:text-slate-600"
            title="Switch API key"
          >
            Switch key
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{error}</div>
      )}

      {/* Summary cards */}
      {summary.length > 0 && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-xs text-slate-500 uppercase tracking-wide">Agents</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{summary.length}</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-xs text-slate-500 uppercase tracking-wide">Total Confirmed</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">
              ${summary.reduce((s, a) => s + a.totalDebits, 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-xs text-slate-500 uppercase tracking-wide">Total Entries</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{meta?.total ?? entries.length}</p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-slate-200 mb-4">
        {(['ledger', 'summary'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize border-b-2 -mb-px transition-colors ${
              tab === t ? 'border-[#635BFF] text-[#635BFF]' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {t === 'ledger' ? 'Transaction Ledger' : 'Agent Balances'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#635BFF]" />
        </div>
      ) : tab === 'ledger' ? (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-500 w-10">#</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500">Date</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500">Description</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500">Payer (Debit)</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500">Recipient (Credit)</th>
                <th className="text-right px-4 py-3 font-medium text-slate-500">Amount</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500">Status</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500">On-Chain Proof</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {entries.map(e => (
                <tr key={e.invoiceId} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-400 text-xs">{e.lineNumber}</td>
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                    {e.entryDate ? new Date(e.entryDate).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-4 py-3 text-slate-700 max-w-[200px] truncate" title={e.description}>
                    {e.description}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-600 max-w-[140px] truncate" title={e.debitAgent}>
                    {e.debitAgent}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-600 max-w-[140px] truncate" title={e.creditAgent}>
                    {e.creditAgent}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-900 whitespace-nowrap">
                    {e.currency} {Number(e.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[e.status] || 'bg-slate-100 text-slate-600'}`}>
                      {e.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {e.txHash && e.blockExplorer ? (
                      <a
                        href={e.blockExplorer}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-xs text-[#635BFF] hover:underline"
                        title={e.txHash}
                      >
                        {e.txHash.slice(0, 10)}…
                      </a>
                    ) : (
                      <span className="text-slate-300 text-xs">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {entries.length === 0 && (
            <div className="py-16 text-center text-slate-400">
              No transactions yet for this company.
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-500">Agent</th>
                <th className="text-right px-4 py-3 font-medium text-slate-500">Total Debits</th>
                <th className="text-right px-4 py-3 font-medium text-slate-500">Total Credits</th>
                <th className="text-right px-4 py-3 font-medium text-slate-500">Net Balance</th>
                <th className="text-right px-4 py-3 font-medium text-slate-500">Transactions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {summary.map(a => (
                <tr key={a.agentId} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs text-slate-700">{a.agentId}</td>
                  <td className="px-4 py-3 text-right text-red-600 font-medium">${a.totalDebits.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right text-green-600 font-medium">${a.totalCredits.toFixed(2)}</td>
                  <td className={`px-4 py-3 text-right font-bold ${a.confirmedNetBalance >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                    {a.confirmedNetBalance >= 0 ? '+' : ''}${a.confirmedNetBalance.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-500">{a.transactionCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {summary.length === 0 && (
            <div className="py-16 text-center text-slate-400">No agent data yet.</div>
          )}
        </div>
      )}
    </div>
  );
}
