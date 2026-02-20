'use client';

import { useState, useEffect } from 'react';
import { fetchDashboardStats, fetchRecentActivity, fetchApiKeys, DashboardStats, RecentActivityItem } from '@/lib/api-client';
import { WelcomeOnboarding } from '@/components/welcome-onboarding';
import { FileText, Clock, CheckCircle2, XCircle } from 'lucide-react';

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activity, setActivity] = useState<RecentActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    try {
      const [statsData, activityData, keys] = await Promise.all([
        fetchDashboardStats(),
        fetchRecentActivity(),
        fetchApiKeys().catch(() => []),
      ]);
      setStats(statsData);
      setActivity(activityData);

      // Show onboarding if user has no API keys and no invoices
      const isNewUser = keys.length === 0 && (statsData.totalInvoices ?? 0) === 0;
      const dismissed = typeof window !== 'undefined' && localStorage.getItem('invoica_onboarding_dismissed');
      setShowOnboarding(isNewUser && !dismissed);
    } finally {
      setLoading(false);
    }
  }

  function handleOnboardingComplete() {
    setShowOnboarding(false);
    if (typeof window !== 'undefined') {
      localStorage.setItem('invoica_onboarding_dismissed', '1');
    }
    // Reload stats in case a key was just created
    loadDashboard();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    );
  }

  if (showOnboarding) {
    return <WelcomeOnboarding onComplete={handleOnboardingComplete} />;
  }

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-100 rounded-lg">
              <FileText className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Invoices</p>
              <p className="text-2xl font-semibold">{stats?.totalInvoices ?? 0}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-amber-100 rounded-lg">
              <Clock className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Pending</p>
              <p className="text-2xl font-semibold">{stats?.pending ?? 0}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-100 rounded-lg">
              <CheckCircle2 className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Settled</p>
              <p className="text-2xl font-semibold">{stats?.settled ?? 0}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-red-100 rounded-lg">
              <XCircle className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Revenue</p>
              <p className="text-2xl font-semibold">${(stats?.revenue ?? 0).toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="text-lg font-semibold mb-4">Recent Activity</h2>
        <div className="space-y-4">
          {activity.length === 0 ? (
            <p className="text-center text-gray-400 py-6">No recent activity yet. Create your first invoice via the API.</p>
          ) : (
            activity.map((item) => (
              <div key={item.id} className="flex items-center gap-4 pb-4 border-b last:border-0">
                <div className={`w-2 h-2 rounded-full ${item.status === 'success' ? 'bg-green-500' : item.status === 'pending' ? 'bg-amber-500' : 'bg-red-500'}`} />
                <div className="flex-1">
                  <p className="font-medium">{item.title}</p>
                  <p className="text-sm text-gray-500">{item.description}</p>
                </div>
                <p className="text-sm text-gray-400">{item.timestamp}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
