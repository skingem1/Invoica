'use client';

const stats = [
  { value: 'x402', label: 'Native Protocol', description: 'First-class support for x402 EIP-712 payment proofs' },
  { value: '100', label: 'SDK Modules', description: 'Fully typed TypeScript with 26 React hooks' },
  { value: 'Base', label: 'Mainnet Live', description: 'Real settlements on Base — not just a demo' },
  { value: '<10m', label: 'Time to First Invoice', description: 'From API key to production invoice in minutes' },
];

const testimonials = [
  {
    quote: "Invoica gave our finance team visibility into every agent transaction. For the first time, we can actually reconcile autonomous payments.",
    author: "CTO",
    company: "Enterprise AI Platform",
    avatar: "C",
    color: "from-purple-500 to-indigo-600",
  },
  {
    quote: "The x402 integration was seamless. We plugged Invoica into our agent payment loop in an afternoon — invoices started appearing instantly.",
    author: "Lead Engineer",
    company: "AI Infrastructure Co.",
    avatar: "L",
    color: "from-emerald-500 to-teal-600",
  },
  {
    quote: "Finally a billing layer that thinks in agents. Budget enforcement per-agent, automatic settlement detection — it just works.",
    author: "Head of Product",
    company: "Autonomous Agent Studio",
    avatar: "H",
    color: "from-orange-500 to-rose-600",
  },
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
        {/* Stats row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 mb-24">
          {stats.map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="text-5xl font-bold text-white mb-2 tracking-tight">{stat.value}</div>
              <div className="text-sm font-semibold text-invoica-purple-light mb-1">{stat.label}</div>
              <div className="text-xs text-invoica-gray-400 leading-relaxed">{stat.description}</div>
            </div>
          ))}
        </div>

        {/* Section header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center justify-center mb-6">
            <div className="h-px w-12 bg-gradient-to-r from-transparent to-invoica-purple" />
            <span className="mx-4 text-xs font-semibold text-invoica-purple-light uppercase tracking-widest">Early Adopters</span>
            <div className="h-px w-12 bg-gradient-to-l from-transparent to-invoica-purple" />
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4 tracking-tight">
            Trusted by teams building the autonomous economy
          </h2>
        </div>

        {/* Testimonials */}
        <div className="grid md:grid-cols-3 gap-8">
          {testimonials.map((t) => (
            <div
              key={t.company}
              className="relative p-8 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/8 hover:border-white/20 transition-all duration-300"
            >
              {/* Quote mark */}
              <div className="text-6xl font-serif text-invoica-purple/30 leading-none mb-4 select-none">&ldquo;</div>
              <p className="text-sm text-invoica-gray-300 leading-relaxed mb-8 -mt-4">
                {t.quote}
              </p>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${t.color} flex items-center justify-center text-white text-sm font-bold flex-shrink-0`}>
                  {t.avatar}
                </div>
                <div>
                  <div className="text-sm font-semibold text-white">{t.author}</div>
                  <div className="text-xs text-invoica-gray-400">{t.company}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
