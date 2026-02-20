'use client';

import { useState } from 'react';
import { createNewApiKey } from '@/lib/api-client';

interface WelcomeOnboardingProps {
  onComplete: () => void;
}

export function WelcomeOnboarding({ onComplete }: WelcomeOnboardingProps) {
  const [step, setStep] = useState<'welcome' | 'creating' | 'showKey'>('welcome');
  const [apiSecret, setApiSecret] = useState('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  async function handleCreateKey() {
    setStep('creating');
    setError('');
    try {
      const result = await createNewApiKey('My First Key');
      setApiSecret(result.secret);
      setStep('showKey');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create API key');
      setStep('welcome');
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(apiSecret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: select the text
    }
  }

  if (step === 'welcome') {
    return (
      <div className="max-w-2xl mx-auto mt-8">
        <div className="bg-gradient-to-br from-[#635BFF]/5 via-white to-[#635BFF]/10 border border-[#635BFF]/20 rounded-2xl p-8 text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-[#635BFF] to-[#818CF8] rounded-2xl flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.841m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
            </svg>
          </div>

          <h2 className="text-2xl font-bold text-gray-900 mb-2">Welcome to Invoica!</h2>
          <p className="text-gray-500 mb-8 max-w-md mx-auto">
            The financial OS for AI agents. Create your API key to start generating invoices, processing payments, and managing tax compliance.
          </p>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8 text-left">
            <div className="bg-white rounded-xl p-4 border border-gray-100">
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center mb-3">
                <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
              </div>
              <h3 className="font-semibold text-sm text-gray-900">1. Get API Key</h3>
              <p className="text-xs text-gray-500 mt-1">Create your key to authenticate API requests</p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-gray-100">
              <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center mb-3">
                <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="font-semibold text-sm text-gray-900">2. Create Invoice</h3>
              <p className="text-xs text-gray-500 mt-1">POST to /v1/invoices to generate invoices</p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-gray-100">
              <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center mb-3">
                <svg className="w-4 h-4 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="font-semibold text-sm text-gray-900">3. Get Paid</h3>
              <p className="text-xs text-gray-500 mt-1">x402 protocol handles payments automatically</p>
            </div>
          </div>

          <button
            onClick={handleCreateKey}
            className="px-8 py-3 bg-gradient-to-r from-[#635BFF] to-[#818CF8] text-white rounded-xl font-semibold text-sm hover:shadow-lg hover:shadow-[#635BFF]/25 transition-all"
          >
            Create My API Key
          </button>

          <button
            onClick={onComplete}
            className="block mx-auto mt-3 text-sm text-gray-400 hover:text-gray-600 transition-colors"
          >
            Skip for now
          </button>
        </div>
      </div>
    );
  }

  if (step === 'creating') {
    return (
      <div className="max-w-2xl mx-auto mt-8">
        <div className="bg-white border rounded-2xl p-8 text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#635BFF] mx-auto mb-4" />
          <p className="text-gray-500">Creating your API key...</p>
        </div>
      </div>
    );
  }

  // step === 'showKey'
  return (
    <div className="max-w-2xl mx-auto mt-8">
      <div className="bg-white border border-green-200 rounded-2xl p-8">
        <div className="text-center mb-6">
          <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-1">Your API Key is Ready!</h2>
          <p className="text-sm text-gray-500">Copy it now — you won&apos;t be able to see it again.</p>
        </div>

        <div className="bg-gray-900 rounded-xl p-4 mb-4">
          <div className="flex items-center justify-between gap-3">
            <code className="text-green-400 text-sm font-mono break-all flex-1">{apiSecret}</code>
            <button
              onClick={handleCopy}
              className="flex-shrink-0 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-white text-xs font-medium transition-colors"
            >
              {copied ? '✓ Copied' : 'Copy'}
            </button>
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-6">
          <p className="text-xs text-amber-800">
            <strong>Important:</strong> Store this key securely. It provides full API access to your account. Never expose it in client-side code or public repositories.
          </p>
        </div>

        <div className="bg-gray-50 rounded-xl p-4 mb-6">
          <p className="text-xs font-semibold text-gray-700 mb-2">Quick start — create your first invoice:</p>
          <pre className="text-xs text-gray-600 font-mono overflow-x-auto whitespace-pre">{`curl -X POST https://igspopoejhsxvwvxyhbh.supabase.co/functions/v1/api/v1/invoices \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"amount": 100, "currency": "USD", "customerName": "Acme Corp", "customerEmail": "billing@acme.com"}'`}</pre>
        </div>

        <div className="flex gap-3 justify-center">
          <button
            onClick={onComplete}
            className="px-6 py-2.5 bg-gradient-to-r from-[#635BFF] to-[#818CF8] text-white rounded-xl font-semibold text-sm hover:shadow-lg transition-all"
          >
            Go to Dashboard
          </button>
          <a
            href="https://invoica.mintlify.app"
            target="_blank"
            rel="noopener noreferrer"
            className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-xl font-semibold text-sm hover:bg-gray-50 transition-all"
          >
            Read Docs
          </a>
        </div>
      </div>
    </div>
  );
}
