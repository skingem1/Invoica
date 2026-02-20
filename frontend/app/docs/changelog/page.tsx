interface ChangeEntry {
  version: string;
  date: string;
  changes: string[];
}

const entries: ChangeEntry[] = [
  {
    version: '1.4.0',
    date: '2026-02-20',
    changes: [
      'New Web3 Growth plan at $24/mo with 5,000 invoices and 25,000 API calls',
      'Web3 projects now see tailored pricing (Free + Growth) during onboarding',
      'Registered companies continue to see Free + Pro ($49) + Enterprise tiers',
      'Added Plans & Pricing documentation page',
    ],
  },
  {
    version: '1.3.0',
    date: '2026-02-16',
    changes: [
      'Added backend API routes for invoices, API keys, webhooks, and settlements',
      'Added Express app entry point with middleware stack',
      'Completed SDK test coverage for retry, debug, and client-config modules',
    ],
  },
  {
    version: '1.2.0',
    date: '2026-02-15',
    changes: [
      'Fixed SDK import chain — all modules now use v2 transport and error handling',
      'Added SDK tests for pagination, events, and timeout modules',
      'New documentation pages: error handling, environments, quickstart',
    ],
  },
  {
    version: '1.1.0',
    date: '2026-02-14',
    changes: [
      'SDK consolidation — barrel exports, interceptors, environment detection',
      'New tests for rate-limit, error-compat, and request-builder',
      'Added webhook events and quickstart documentation',
    ],
  },
  {
    version: '1.0.0',
    date: '2026-02-13',
    changes: [
      'Initial release of Invoica TypeScript SDK',
      'Core client with invoice, settlement, and API key management',
      'Webhook signature verification and rate limiting',
    ],
  },
];

export default function ChangelogPage() {
  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-6">Changelog</h1>
      <div className="space-y-8">
        {entries.map((entry) => (
          <div key={entry.version} className="border-l-4 border-blue-500 pl-4">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-xl font-semibold">v{entry.version}</span>
              <span className="text-sm text-gray-500">{entry.date}</span>
            </div>
            <ul className="list-disc list-inside space-y-1 text-gray-600">
              {entry.changes.map((c, i) => (<li key={i}>{c}</li>))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}