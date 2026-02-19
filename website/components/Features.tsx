'use client';

const features = [
  {
    title: 'Automated Invoicing',
    description: 'Generate professional invoices for every AI agent transaction. Line items, tax breakdowns, and PDF delivery — fully automated.',
    iconPath: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  },
  {
    title: 'Tax Compliance',
    description: 'Multi-jurisdiction VAT and sales tax calculation. Automatic rate lookup, reverse charge handling, and audit-ready reporting.',
    iconPath: 'M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z',
  },
  {
    title: 'Budget Enforcement',
    description: 'Hierarchical spending limits per agent, team, or department. Transactions exceeding budgets are blocked before execution.',
    iconPath: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
  },
  {
    title: 'Settlement Detection',
    description: 'Dual on-chain monitoring — poll-based and event-driven — ensures no payment confirmation is ever missed.',
    iconPath: 'M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1',
  },
  {
    title: 'TypeScript SDK',
    description: '100 modules, 26 React hooks, 19 UI components. Fully typed, tree-shakeable, and designed for developer experience.',
    iconPath: 'M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4',
  },
  {
    title: 'Developer Dashboard',
    description: 'Manage API keys, view invoices, monitor settlements, and configure webhooks from a single interface.',
    iconPath: 'M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z',
  },
];

export default function Features() {
  return (
    <section id="features" className="py-28 bg-white relative">
      {/* Subtle grid background */}
      <div className="absolute inset-0 opacity-[0.02]" style={{
        backgroundImage: 'radial-gradient(circle at 1px 1px, #0A2540 1px, transparent 0)',
        backgroundSize: '40px 40px',
      }} />

      <div className="relative max-w-7xl mx-auto px-6">
        <div className="text-center mb-20">
          <div className="inline-flex items-center justify-center mb-6">
            <div className="h-px w-12 bg-gradient-to-r from-transparent to-invoica-purple" />
            <span className="mx-4 text-xs font-semibold text-invoica-purple uppercase tracking-widest">Features</span>
            <div className="h-px w-12 bg-gradient-to-l from-transparent to-invoica-purple" />
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-invoica-blue mb-6 tracking-tight">
            Everything your agents need
          </h2>
          <p className="text-lg text-invoica-gray-500 max-w-2xl mx-auto leading-relaxed">
            Financial infrastructure that works as autonomously as your AI agents.
            No manual intervention required.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <div
              key={feature.title}
              className="group relative p-8 rounded-2xl border border-invoica-gray-100 hover:border-invoica-purple/20 bg-white hover:bg-gradient-to-b hover:from-white hover:to-invoica-purple/[0.02] transition-all duration-500 hover:shadow-xl hover:shadow-invoica-purple/5 hover:-translate-y-1"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              {/* Icon */}
              <div className="w-14 h-14 flex items-center justify-center rounded-xl bg-gradient-to-br from-invoica-blue to-invoica-blue/80 text-white mb-6 group-hover:from-invoica-purple group-hover:to-invoica-purple-light group-hover:shadow-lg group-hover:shadow-invoica-purple/20 transition-all duration-500">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={feature.iconPath} />
                </svg>
              </div>

              <h3 className="text-lg font-semibold text-invoica-blue mb-3">{feature.title}</h3>
              <p className="text-sm text-invoica-gray-500 leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
