'use client';

const stats = [
  { value: 'x402', label: 'Native Protocol', description: 'First-class support for x402 EIP-712 payment proofs' },
  { value: '100+', label: 'SDK Modules', description: 'Fully typed TypeScript with 26 React hooks' },
  { value: 'Base', label: 'Mainnet Live', description: 'Real settlements on Base. Multichain support in development.' },
  { value: '<10m', label: 'Time to First Invoice', description: 'From API key to production invoice in minutes' },
];

export default function SocialProof() {
  return (
    <section className="py-28 bg-invoica-blue relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-invoica-purple/30 to-transparent" />
      <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-invoica-purple/30 to-transparent" />
      <div className="absolute top-1/3 left-0 w-96 h-96 bg-invoica-purple/5 rounded-full blur-3xl" />
      <div className="absolute bottom-1/3 right-0 w-80 h-80 bg-invoica-purple-light/5 rounded-full blur-3xl" />

      <div className="relative max-w-7xl mx-auto px-6">
        {/* Section header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center justify-center mb-6">
            <div className="h-px w-12 bg-gradient-to-r from-transparent to-invoica-purple" />
            <span className="mx-4 text-xs font-semibold text-invoica-purple-light uppercase tracking-widest">By the Numbers</span>
            <div className="h-px w-12 bg-gradient-to-l from-transparent to-invoica-purple" />
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4 tracking-tight">
            Built for the autonomous economy
          </h2>
          <p className="text-invoica-gray-400 text-lg max-w-xl mx-auto">
            Production-ready infrastructure. Real settlements. No demos.
          </p>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
          {stats.map((stat) => (
            <div key={stat.label} className="text-center p-8 rounded-2xl bg-white/5 border border-white/10">
              <div className="text-5xl font-bold text-white mb-2 tracking-tight">{stat.value}</div>
              <div className="text-sm font-semibold text-invoica-purple-light mb-2">{stat.label}</div>
              <div className="text-xs text-invoica-gray-400 leading-relaxed">{stat.description}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
