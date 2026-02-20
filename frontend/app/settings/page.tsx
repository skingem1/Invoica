'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  fetchCompanyProfile,
  saveCompanyProfile,
  verifyCompanyProfile,
  fetchSupportedCountries,
  type CompanyProfile,
  type SupportedCountry,
} from '@/lib/api-client';

type ProfileType = 'registered_company' | 'web3_project' | null;

function VerificationBadge({ status }: { status: CompanyProfile['verification_status'] }) {
  const config = {
    verified: { label: 'Verified', bg: 'bg-emerald-50', text: 'text-emerald-700', ring: 'ring-emerald-600/20', icon: '✓' },
    pending: { label: 'Pending Review', bg: 'bg-amber-50', text: 'text-amber-700', ring: 'ring-amber-600/20', icon: '◷' },
    failed: { label: 'Verification Failed', bg: 'bg-red-50', text: 'text-red-700', ring: 'ring-red-600/20', icon: '✗' },
    unverified: { label: 'Unverified', bg: 'bg-slate-50', text: 'text-slate-600', ring: 'ring-slate-500/20', icon: '○' },
    not_applicable: { label: 'N/A', bg: 'bg-slate-50', text: 'text-slate-500', ring: 'ring-slate-400/20', icon: '—' },
  }[status];
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ring-1 ring-inset ${config.bg} ${config.text} ${config.ring}`}>
      <span>{config.icon}</span> {config.label}
    </span>
  );
}

export default function SettingsPage() {
  // General settings
  const [email, setEmail] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [notifications, setNotifications] = useState({
    invoiceCreated: true,
    paymentReceived: true,
    paymentOverdue: true,
    weeklyReport: false,
  });
  const [generalSaved, setGeneralSaved] = useState(false);

  // Company profile
  const [profile, setProfile] = useState<CompanyProfile | null>(null);
  const [countries, setCountries] = useState<SupportedCountry[]>([]);
  const [profileType, setProfileType] = useState<ProfileType>(null);
  const [companyName, setCompanyName] = useState('');
  const [companyCountry, setCompanyCountry] = useState('');
  const [regNumber, setRegNumber] = useState('');
  const [vatNumber, setVatNumber] = useState('');
  const [address, setAddress] = useState('');
  const [projectName, setProjectName] = useState('');
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState('');
  const [verifyMessage, setVerifyMessage] = useState('');
  const [loading, setLoading] = useState(true);

  const selectedCountry = countries.find(c => c.code === companyCountry);

  const loadProfile = useCallback(async () => {
    try {
      const [p, c] = await Promise.all([fetchCompanyProfile(), fetchSupportedCountries()]);
      setCountries(c);
      if (p) {
        setProfile(p);
        setProfileType(p.profile_type);
        setCompanyName(p.company_name || '');
        setCompanyCountry(p.company_country || '');
        setRegNumber(p.registration_number || '');
        setVatNumber(p.vat_number || '');
        setAddress(p.address || '');
        setProjectName(p.project_name || '');
      }
    } catch {
      // Profile not yet created — that's OK
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  const handleSaveGeneral = () => {
    setGeneralSaved(true);
    setTimeout(() => setGeneralSaved(false), 2000);
  };

  const handleSaveProfile = async () => {
    setProfileError('');
    setProfileSuccess('');
    setVerifyMessage('');
    setSaving(true);
    try {
      const payload = profileType === 'registered_company'
        ? { profile_type: 'registered_company' as const, company_name: companyName, company_country: companyCountry, registration_number: regNumber, vat_number: vatNumber || undefined, address: address || undefined }
        : { profile_type: 'web3_project' as const, project_name: projectName };
      const result = await saveCompanyProfile(payload);
      setProfile(result);
      setProfileSuccess('Company profile saved successfully.');
      setTimeout(() => setProfileSuccess(''), 3000);
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const handleVerify = async () => {
    setVerifyMessage('');
    setProfileError('');
    setVerifying(true);
    try {
      const result = await verifyCompanyProfile();
      setVerifyMessage(result.message);
      setProfile(result.profile);
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setVerifying(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-8 max-w-2xl">
        <div><h1 className="text-3xl font-bold tracking-tight">Settings</h1></div>
        <div className="rounded-2xl border bg-white p-8 flex items-center justify-center min-h-[200px]">
          <div className="flex items-center gap-3 text-slate-400">
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
            Loading settings...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="mt-2 text-slate-500">Manage your account preferences and company profile.</p>
      </div>

      {/* ─── Company Profile ─── */}
      <div className="rounded-2xl border bg-white p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Company Profile</h2>
            <p className="text-sm text-slate-500 mt-0.5">Set up your business identity for invoicing.</p>
          </div>
          {profile && <VerificationBadge status={profile.verification_status} />}
        </div>

        {/* Profile type selector */}
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setProfileType('registered_company')}
            className={`relative p-4 rounded-xl border-2 text-left transition-all ${
              profileType === 'registered_company'
                ? 'border-[#635BFF] bg-[#635BFF]/[0.04] shadow-sm'
                : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center gap-3 mb-2">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${profileType === 'registered_company' ? 'bg-[#635BFF]/10' : 'bg-slate-100'}`}>
                <svg className={`w-5 h-5 ${profileType === 'registered_company' ? 'text-[#635BFF]' : 'text-slate-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <div>
                <div className="font-semibold text-sm text-slate-900">Registered Company</div>
              </div>
            </div>
            <p className="text-xs text-slate-500">Traditional entity with tax, VAT, and compliance features.</p>
            {profileType === 'registered_company' && (
              <div className="absolute top-3 right-3">
                <svg className="w-5 h-5 text-[#635BFF]" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
              </div>
            )}
          </button>

          <button
            type="button"
            onClick={() => setProfileType('web3_project')}
            className={`relative p-4 rounded-xl border-2 text-left transition-all ${
              profileType === 'web3_project'
                ? 'border-[#635BFF] bg-[#635BFF]/[0.04] shadow-sm'
                : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center gap-3 mb-2">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${profileType === 'web3_project' ? 'bg-[#635BFF]/10' : 'bg-slate-100'}`}>
                <svg className={`w-5 h-5 ${profileType === 'web3_project' ? 'text-[#635BFF]' : 'text-slate-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
              <div>
                <div className="font-semibold text-sm text-slate-900">Web3 Project</div>
              </div>
            </div>
            <p className="text-xs text-slate-500">No country, no VAT, no tax — invoicing and ledger only.</p>
            {profileType === 'web3_project' && (
              <div className="absolute top-3 right-3">
                <svg className="w-5 h-5 text-[#635BFF]" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
              </div>
            )}
          </button>
        </div>

        {/* Registered Company Form */}
        {profileType === 'registered_company' && (
          <div className="space-y-4 pt-2">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Company Name</label>
              <input
                type="text"
                value={companyName}
                onChange={e => setCompanyName(e.target.value)}
                placeholder="Acme Corporation Ltd."
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#635BFF] focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Country of Registration</label>
              <select
                value={companyCountry}
                onChange={e => setCompanyCountry(e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#635BFF] focus:border-transparent bg-white"
              >
                <option value="">Select a country...</option>
                {countries.map(c => (
                  <option key={c.code} value={c.code}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {selectedCountry?.regLabel || 'Registration Number'}
              </label>
              <input
                type="text"
                value={regNumber}
                onChange={e => setRegNumber(e.target.value)}
                placeholder={selectedCountry?.regPlaceholder || 'Enter registration number'}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#635BFF] focus:border-transparent"
              />
              {selectedCountry && (
                <p className="mt-1 text-xs text-slate-400">Format: {selectedCountry.regFormat}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                VAT Number <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={vatNumber}
                onChange={e => setVatNumber(e.target.value)}
                placeholder="e.g. DE123456789"
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#635BFF] focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Registered Address <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <textarea
                value={address}
                onChange={e => setAddress(e.target.value)}
                placeholder="123 Business Street, City, Country"
                rows={2}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#635BFF] focus:border-transparent resize-none"
              />
            </div>

            {/* Verification info box */}
            {selectedCountry && (
              <div className={`p-3 rounded-lg text-sm ${selectedCountry.autoVerify ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'}`}>
                <div className="flex items-start gap-2">
                  <span className="mt-0.5">{selectedCountry.autoVerify ? '⚡' : 'ℹ️'}</span>
                  <span>
                    {selectedCountry.autoVerify
                      ? `Auto-verification available for ${selectedCountry.name}. Save your profile then click "Verify" to check your company in real-time.`
                      : `Automated verification is not yet available for ${selectedCountry.name}. Your registration will be saved and reviewed manually.`}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Web3 Project Form */}
        {profileType === 'web3_project' && (
          <div className="space-y-4 pt-2">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Project Name</label>
              <input
                type="text"
                value={projectName}
                onChange={e => setProjectName(e.target.value)}
                placeholder="My DeFi Protocol"
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#635BFF] focus:border-transparent"
              />
            </div>
            <div className="p-3 rounded-lg bg-slate-50 text-sm text-slate-600">
              <div className="flex items-start gap-2">
                <span className="mt-0.5">💡</span>
                <span>Web3 projects operate without country registration. No VAT, no tax obligations — only invoicing and ledger entries will be tracked.</span>
              </div>
            </div>
          </div>
        )}

        {/* Error / Success Messages */}
        {profileError && (
          <div className="p-3 rounded-lg bg-red-50 text-sm text-red-700 flex items-center gap-2">
            <span>✗</span> {profileError}
          </div>
        )}
        {profileSuccess && (
          <div className="p-3 rounded-lg bg-emerald-50 text-sm text-emerald-700 flex items-center gap-2">
            <span>✓</span> {profileSuccess}
          </div>
        )}
        {verifyMessage && (
          <div className={`p-3 rounded-lg text-sm flex items-center gap-2 ${profile?.verification_status === 'verified' ? 'bg-emerald-50 text-emerald-700' : profile?.verification_status === 'failed' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>
            <span>{profile?.verification_status === 'verified' ? '✓' : profile?.verification_status === 'failed' ? '✗' : '◷'}</span> {verifyMessage}
          </div>
        )}

        {/* Verified company name display */}
        {profile?.verified_company_name && profile.verification_status === 'verified' && (
          <div className="p-4 rounded-lg bg-emerald-50/50 border border-emerald-200">
            <div className="text-xs font-medium text-emerald-600 mb-1">Verified Company Name</div>
            <div className="text-sm font-semibold text-emerald-900">{profile.verified_company_name}</div>
            {profile.verified_at && (
              <div className="text-xs text-emerald-500 mt-1">Verified on {new Date(profile.verified_at).toLocaleDateString()}</div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        {profileType && (
          <div className="flex items-center gap-3 pt-1">
            <button
              onClick={handleSaveProfile}
              disabled={saving}
              className="px-5 py-2.5 text-sm font-semibold text-white bg-[#635BFF] rounded-lg hover:bg-[#635BFF]/90 transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Profile'}
            </button>
            {profileType === 'registered_company' && profile && profile.profile_type === 'registered_company' && profile.verification_status !== 'verified' && (
              <button
                onClick={handleVerify}
                disabled={verifying}
                className="px-5 py-2.5 text-sm font-semibold text-[#635BFF] border border-[#635BFF] rounded-lg hover:bg-[#635BFF]/5 transition-colors disabled:opacity-50"
              >
                {verifying ? 'Verifying...' : 'Verify Company'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* ─── General Settings ─── */}
      <div className="rounded-2xl border bg-white p-6 space-y-4">
        <h2 className="text-xl font-semibold">General</h2>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Billing Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="billing@company.com"
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#635BFF] focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Default Currency</label>
            <select
              value={currency}
              onChange={e => setCurrency(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#635BFF] focus:border-transparent bg-white"
            >
              <option value="USD">USD - US Dollar</option>
              <option value="EUR">EUR - Euro</option>
              <option value="GBP">GBP - British Pound</option>
              <option value="USDC">USDC - USD Coin</option>
            </select>
          </div>
        </div>
      </div>

      {/* ─── Notifications ─── */}
      <div className="rounded-2xl border bg-white p-6 space-y-4">
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
                onChange={e => setNotifications(prev => ({ ...prev, [key]: e.target.checked }))}
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

      {/* ─── Billing ─── */}
      <div className="rounded-2xl border bg-white p-6 space-y-4">
        <h2 className="text-xl font-semibold">Billing</h2>
        <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
          <div>
            <div className="font-medium text-slate-900">Free Plan</div>
            <div className="text-sm text-slate-500">100 invoices/month</div>
          </div>
          <a
            href="/billing"
            className="px-4 py-2 text-sm font-medium text-[#635BFF] border border-[#635BFF] rounded-lg hover:bg-[#635BFF]/5 transition-colors"
          >
            Manage Billing
          </a>
        </div>
      </div>

      {/* ─── Save General ─── */}
      <div className="flex justify-end">
        <button
          onClick={handleSaveGeneral}
          className="px-6 py-2.5 text-sm font-semibold text-white bg-[#635BFF] rounded-lg hover:bg-[#635BFF]/90 transition-colors"
        >
          {generalSaved ? 'Saved!' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}
