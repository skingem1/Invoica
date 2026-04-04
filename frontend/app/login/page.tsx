'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const router = useRouter();
  const supabase = createClient();

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');
    if (isSignUp) {
      const { error } = await supabase.auth.signUp({
        email, password,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) setError(error.message);
      else setMessage('Check your email for a confirmation link!');
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
      else router.push('/');
    }
    setLoading(false);
  };

  const handleOAuth = async (provider: 'google' | 'github') => {
    setLoading(true);
    setError('');
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) { setError(error.message); setLoading(false); }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left: branding panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-[#0A2540] flex-col justify-between p-12 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 -left-20 w-96 h-96 rounded-full bg-[#635BFF] blur-3xl" />
          <div className="absolute bottom-20 right-10 w-80 h-80 rounded-full bg-[#818CF8] blur-3xl" />
        </div>
        <div className="relative">
          <Image src="/logo-dark.png" alt="Invoica" width={432} height={115} className="h-[67px] w-auto" />
        </div>
        <div className="relative space-y-6">
          <h1 className="text-4xl font-bold text-white leading-tight">
            The Financial OS<br /><span className="text-[#818CF8]">for AI Agents</span>
          </h1>
          <p className="text-slate-400 text-lg max-w-md">Automated invoicing, tax compliance, and settlement tracking for the x402 protocol.</p>
          <div className="flex items-center justify-center gap-3 mt-4 text-sm text-gray-500">
            <span className="px-3 py-1 bg-[#635BFF]/10 text-[#635BFF] rounded-full text-xs font-medium">x402 Foundation</span>
            <span>Linux Foundation · Stripe · Coinbase · AWS</span>
          </div>
          <div className="space-y-3 pt-4">
            {['Real-time invoice generation', 'Multi-chain settlement tracking', 'EU VAT and tax compliance'].map((f, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-[#635BFF]/20 flex items-center justify-center">
                  <svg className="w-3 h-3 text-[#818CF8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                </div>
                <span className="text-slate-300">{f}</span>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-4 pt-6">
            <div className="p-6 rounded-xl bg-white/5 border border-white/10">
              <h3 className="font-semibold mb-2">Settlement Detection</h3>
              <p className="text-sm text-gray-400">Cross-chain transaction indexing with automatic invoice reconciliation.</p>
            </div>
            <div className="p-6 rounded-xl bg-white/5 border border-white/10">
              <h3 className="font-semibold mb-2">Business Verification</h3>
              <p className="text-sm text-gray-400">KYB compliance screening for B2B agent transactions.</p>
            </div>
            <div className="p-6 rounded-xl bg-white/5 border border-white/10">
              <h3 className="font-semibold mb-2">Trust-Gated Sessions</h3>
              <p className="text-sm text-gray-400">PACT protocol — agents get spending ceilings based on Helixa reputation scores. Higher trust = higher limits.</p>
            </div>
          </div>
        </div>
        <div className="relative text-slate-500 text-sm">
          © 2026 Invoica. Built for the agent economy.
        </div>
      </div>
      {/* Right: auth form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-gray-50">
        <div className="w-full max-w-md space-y-8">
          <div className="lg:hidden flex items-center justify-between mb-8">
            <Image src="/logo.png" alt="Invoica" width={160} height={43} className="h-10 w-auto" />
          </div>
          <div>
            <h2 className="text-3xl font-bold text-gray-900">{isSignUp ? 'Create your account' : 'Welcome back'}</h2>
            <p className="mt-2 text-gray-600">{isSignUp ? 'Start automating agent payments today' : 'Sign in to your dashboard'}</p>
          </div>
          <form onSubmit={handleEmailAuth} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:ring-2 focus:ring-[#635BFF] focus:border-transparent outline-none transition" placeholder="you@company.com" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
                className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:ring-2 focus:ring-[#635BFF] focus:border-transparent outline-none transition" placeholder="••••••••" />
            </div>
            {error && <div className="p-3 rounded-lg bg-red-50 text-red-600 text-sm">{error}</div>}
            {message && <div className="p-3 rounded-lg bg-green-50 text-green-600 text-sm">{message}</div>}
            <button type="submit" disabled={loading}
              className="w-full py-3 px-4 rounded-lg bg-[#635BFF] text-white font-medium hover:bg-[#5452e8] transition disabled:opacity-50 disabled:cursor-not-allowed">
              {loading ? 'Processing...' : isSignUp ? 'Create Account' : 'Sign In'}
            </button>
          </form>
          <div className="relative">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200" /></div>
            <div className="relative flex justify-center text-sm"><span className="px-4 bg-gray-50 text-gray-500">Or continue with</span></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <button onClick={() => handleOAuth('google')} disabled={loading}
              className="flex items-center justify-center gap-2 py-3 px-4 rounded-lg border border-gray-200 hover:bg-gray-50 transition disabled:opacity-50">
              <svg className="w-5 h-5" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
              Google
            </button>
            <button onClick={() => handleOAuth('github')} disabled={loading}
              className="flex items-center justify-center gap-2 py-3 px-4 rounded-lg border border-gray-200 hover:bg-gray-50 transition disabled:opacity-50">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
              GitHub
            </button>
          </div>
          <p className="text-center text-sm text-gray-600">
            {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
            <button onClick={() => { setIsSignUp(!isSignUp); setError(''); setMessage(''); }} className="text-[#635BFF] font-medium hover:underline">
              {isSignUp ? 'Sign in' : 'Sign up'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}