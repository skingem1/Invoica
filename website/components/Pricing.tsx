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
    href: 'https://app.invoica.ai',
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
    href: 'https://app.invoica.ai',
    highlighted: true,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    description: 'For large-scale agent deployments with custom compliance requirements.',
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
    <section id="pricing" className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-invoica-blue mb-4">
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
              className={`rounded-xl p-8 ${
                tier.highlighted
                  ? 'border-2 border-invoica-purple shadow-xl relative'
                  : 'border border-invoica-gray-200'
              }`}
            >
              {tier.highlighted && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-invoica-purple text-white text-xs font-medium rounded-full">
                  Most Popular
                </div>
              )}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-invoica-blue mb-2">{tier.name}</h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-invoica-blue">{tier.price}</span>
                  <span className="text-invoica-gray-500">{tier.period}</span>
                </div>
                <p className="text-sm text-invoica-gray-500 mt-2">{tier.description}</p>
              </div>
              <ul className="space-y-3 mb-8">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm text-invoica-gray-600">
                    <svg className="w-5 h-5 text-invoica-purple flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    {feature}
                  </li>
                ))}
              </ul>
              <a
                href={tier.href}
                className={`block w-full text-center py-3 rounded-lg text-sm font-medium transition-colors ${
                  tier.highlighted
                    ? 'bg-invoica-purple text-white hover:bg-invoica-purple/90'
                    : 'border border-invoica-gray-300 text-invoica-blue hover:border-invoica-purple hover:text-invoica-purple'
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
