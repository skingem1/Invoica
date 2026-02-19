'use client';

const tiers = [
  {
    name: 'Free',
    price: '$0',
    period: '/month',
    description: 'Perfect for experimenting and building your first integration.',
    features: [
      '100 invoices per month',
      'Basic tax calculation',
      'Webhook notifications',
      'Community support',
      'Sandbox environment',
    ],
    cta: 'Start Free',
    href: 'https://invoica-b89o.vercel.app',
    highlighted: false,
  },
  {
    name: 'Pro',
    price: '$49',
    period: '/month',
    description: 'For production AI agent platforms with growing transaction volume.',
    features: [
      '10,000 invoices per month',
      'Multi-jurisdiction tax compliance',
      'Budget enforcement',
      'Priority webhook delivery',
      'Email support',
      'Advanced analytics',
    ],
    cta: 'Start Pro Trial',
    href: 'https://invoica-b89o.vercel.app',
    highlighted: true,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    description: 'For large-scale agent deployments with custom compliance needs.',
    features: [
      'Unlimited invoices',
      'Custom tax jurisdiction rules',
      'Dedicated settlement monitoring',
      'SLA guarantees',
      'Dedicated account manager',
      'Custom integrations',
    ],
    cta: 'Contact Sales',
    href: 'mailto:sales@invoica.ai',
    highlighted: false,
  },
];

export default function Pricing() {
  return (
    <section id="pricing" className="py-28 bg-invoica-gray-50 relative">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-20">
          <div className="inline-flex items-center justify-center mb-6">
            <div className="h-px w-12 bg-gradient-to-r from-transparent to-invoica-purple" />
            <span className="mx-4 text-xs font-semibold text-invoica-purple uppercase tracking-widest">Pricing</span>
            <div className="h-px w-12 bg-gradient-to-l from-transparent to-invoica-purple" />
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-invoica-blue mb-6 tracking-tight">
            Simple, transparent pricing
          </h2>
          <p className="text-lg text-invoica-gray-500 max-w-2xl mx-auto">
            Start free. Scale as your agents grow. No hidden fees.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className={`relative rounded-2xl p-8 transition-all duration-300 ${
                tier.highlighted
                  ? 'bg-white shadow-2xl shadow-invoica-purple/10 border-2 border-invoica-purple scale-105 z-10'
                  : 'bg-white shadow-sm border border-invoica-gray-200 hover:shadow-lg hover:border-invoica-gray-300'
              }`}
            >
              {tier.highlighted && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-5 py-1.5 bg-gradient-to-r from-invoica-purple to-invoica-purple-light text-white text-xs font-semibold rounded-full shadow-lg shadow-invoica-purple/30">
                  Most Popular
                </div>
              )}

              <div className="mb-8">
                <h3 className="text-lg font-semibold text-invoica-blue mb-2">{tier.name}</h3>
                <div className="flex items-baseline gap-1 mb-3">
                  <span className="text-5xl font-bold text-invoica-blue tracking-tight">{tier.price}</span>
                  <span className="text-invoica-gray-400 text-sm">{tier.period}</span>
                </div>
                <p className="text-sm text-invoica-gray-500">{tier.description}</p>
              </div>

              <ul className="space-y-4 mb-10">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3 text-sm text-invoica-gray-600">
                    <svg className="w-5 h-5 text-invoica-purple flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    {feature}
                  </li>
                ))}
              </ul>

              <a
                href={tier.href}
                className={`block w-full text-center py-3.5 rounded-xl text-sm font-semibold transition-all duration-300 ${
                  tier.highlighted
                    ? 'bg-gradient-to-r from-invoica-purple to-invoica-purple-light text-white hover:shadow-lg hover:shadow-invoica-purple/30 hover:-translate-y-0.5'
                    : 'border-2 border-invoica-gray-200 text-invoica-blue hover:border-invoica-purple hover:text-invoica-purple hover:bg-invoica-purple/5'
                }`}
              >
                {tier.cta}
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
