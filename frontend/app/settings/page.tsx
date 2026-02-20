'use client';

import { useState } from 'react';

export default function SettingsPage() {
  const [companyName, setCompanyName] = useState('My Company');
  const [email, setEmail] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [notifications, setNotifications] = useState({
    invoiceCreated: true,
    paymentReceived: true,
    paymentOverdue: true,
    weeklyReport: false,
  });
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="mt-2 text-muted-foreground">
          Manage your account preferences and application settings.
        </p>
      </div>

      {/* General Settings */}
      <div className="rounded-lg border bg-card p-6 space-y-4">
        <h2 className="text-xl font-semibold">General</h2>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Company Name</label>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#635BFF] focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Billing Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="billing@company.com"
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#635BFF] focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Default Currency</label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#635BFF] focus:border-transparent bg-white"
            >
              <option value="USD">USD - US Dollar</option>
              <option value="EUR">EUR - Euro</option>
              <option value="GBP">GBP - British Pound</option>
              <option value="USDC">USDC - USD Coin</option>
            </select>
          </div>
        </div>
      </div>

      {/* Notifications */}
      <div className="rounded-lg border bg-card p-6 space-y-4">
        <h2 className="text-xl font-semibold">Notifications</h2>
        <div className="space-y-3">
          {([
            ['invoiceCreated', 'Invoice Created', 'Get notified when a new invoice is created by an agent'],
            ['paymentReceived', 'Payment Received', 'Get notified when a payment is settled on-chain'],
            ['paymentOverdue', 'Payment Overdue', 'Get notified when an invoice becomes overdue'],
            ['weeklyReport', 'Weekly Report', 'Receive a weekly summary of all invoicing activity'],
          ] as const).map(([key, label, desc]) => (
            <label key={key} className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={notifications[key]}
                onChange={(e) => setNotifications(prev => ({ ...prev, [key]: e.target.checked }))}
                className="mt-1 h-4 w-4 rounded border-slate-300 text-[#635BFF] focus:ring-[#635BFF]"
              />
              <div>
                <div className="text-sm font-medium text-slate-900">{label}</div>
                <div className="text-xs text-slate-500">{desc}</div>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Billing */}
      <div className="rounded-lg border bg-card p-6 space-y-4">
        <h2 className="text-xl font-semibold">Billing</h2>
        <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
          <div>
            <div className="font-medium text-slate-900">Free Plan</div>
            <div className="text-sm text-slate-500">100 invoices/month</div>
          </div>
          <a
            href="/billing"
            className="px-4 py-2 text-sm font-medium text-[#635BFF] border border-[#635BFF] rounded-md hover:bg-[#635BFF]/5 transition-colors"
          >
            Manage Billing
          </a>
        </div>
      </div>

      {/* Save */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          className="px-6 py-2.5 text-sm font-semibold text-white bg-[#635BFF] rounded-md hover:bg-[#635BFF]/90 transition-colors"
        >
          {saved ? 'Saved!' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}
