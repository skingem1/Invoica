export default function Hero() {
  return (
    <section className="relative pt-32 pb-20 bg-invoica-blue overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-invoica-blue via-invoica-blue to-invoica-purple/20" />
      <div className="relative max-w-7xl mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="inline-flex items-center px-3 py-1 rounded-full bg-invoica-purple/10 border border-invoica-purple/20 mb-6">
              <span className="text-xs font-medium text-invoica-purple-light">Built on the x402 protocol</span>
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-tight mb-6">
              The Financial OS<br />for AI Agents
            </h1>
            <p className="text-lg text-invoica-gray-300 mb-8 max-w-lg">
              Automated invoicing, tax compliance, budget enforcement, and settlement detection.
              Your AI agents handle payments — Invoica handles the financial infrastructure.
            </p>
            <div className="flex flex-wrap gap-4">
              <a href="https://app.invoica.ai/api-keys" className="inline-flex items-center px-6 py-3 text-sm font-medium text-white bg-invoica-purple rounded-lg hover:bg-invoica-purple/90 transition-colors">
                Get Your API Key
                <svg className="ml-2 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
              </a>
              <a href="https://docs.invoica.ai" className="inline-flex items-center px-6 py-3 text-sm font-medium text-invoica-gray-300 border border-invoica-gray-600 rounded-lg hover:border-invoica-gray-400 hover:text-white transition-colors">
                Read the Docs
              </a>
            </div>
          </div>
          <div className="hidden lg:block">
            <div className="bg-invoica-blue/50 border border-invoica-gray-700 rounded-xl p-6 font-mono text-sm">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-3 h-3 rounded-full bg-red-500/50" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/50" />
                <div className="w-3 h-3 rounded-full bg-green-500/50" />
                <span className="ml-2 text-invoica-gray-400 text-xs">invoice.ts</span>
              </div>
              <pre className="text-invoica-gray-300 leading-relaxed overflow-x-auto"><code>{`import { InvoicaClient } from '@invoica/sdk';

const client = new InvoicaClient({
  apiKey: 'inv_live_abc123...',
});

const invoice = await client.invoices.create({
  amount: 5000,
  currency: 'USD',
  description: 'AI Agent API Usage',
  buyer: { companyName: 'Acme AI' },
  seller: {
    name: 'My Platform',
    wallet: '0x742d...bD18',
  },
});

console.log(invoice.invoiceNumber);
// => "INV-2026-0001"`}</code></pre>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
