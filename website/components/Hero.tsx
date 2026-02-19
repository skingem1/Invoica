'use client';

export default function Hero() {
  return (
    <section className="relative pt-32 pb-24 overflow-hidden bg-invoica-blue min-h-[90vh] flex items-center">
      {/* Animated gradient background */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-invoica-blue via-invoica-blue to-[#1a1145]" />
        {/* Gradient orbs */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-invoica-purple/20 rounded-full blur-3xl animate-pulse-slow" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-invoica-purple-light/10 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '2s' }} />
        <div className="absolute top-1/2 right-1/3 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '4s' }} />
        {/* Grid overlay */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
          backgroundSize: '64px 64px',
        }} />
      </div>

      <div className="relative max-w-7xl mx-auto px-6 w-full">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left content */}
          <div className="animate-fade-in-up">
            <div className="inline-flex items-center px-4 py-1.5 rounded-full bg-white/5 border border-white/10 mb-8 backdrop-blur-sm">
              <div className="w-2 h-2 rounded-full bg-invoica-purple animate-glow mr-3" />
              <span className="text-xs font-medium text-invoica-gray-300 tracking-wide uppercase">Built on the x402 Protocol</span>
            </div>

            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-white leading-[1.1] mb-8 tracking-tight">
              The Financial OS
              <br />
              <span className="bg-gradient-to-r from-invoica-purple to-invoica-purple-light bg-clip-text text-transparent">
                for AI Agents
              </span>
            </h1>

            <p className="text-lg md:text-xl text-invoica-gray-300 mb-10 max-w-lg leading-relaxed">
              Automated invoicing, tax compliance, budget enforcement, and settlement detection.
              Your AI agents handle payments — Invoica handles the infrastructure.
            </p>

            <div className="flex flex-wrap gap-4">
              <a
                href="https://app.invoica.ai/api-keys"
                className="group inline-flex items-center px-8 py-4 text-sm font-semibold text-white bg-gradient-to-r from-invoica-purple to-invoica-purple-light rounded-full hover:shadow-xl hover:shadow-invoica-purple/30 transition-all duration-300 hover:-translate-y-0.5"
              >
                Start Building
                <svg className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
              </a>
              <a
                href="https://docs.invoica.ai"
                className="inline-flex items-center px-8 py-4 text-sm font-semibold text-white/80 border border-white/15 rounded-full hover:bg-white/5 hover:text-white hover:border-white/25 transition-all duration-300"
              >
                Read the Docs
              </a>
            </div>
          </div>

          {/* Right side — floating code block */}
          <div className="hidden lg:block animate-float">
            <div className="relative">
              {/* Glow effect behind card */}
              <div className="absolute -inset-4 bg-gradient-to-r from-invoica-purple/20 to-invoica-purple-light/20 rounded-2xl blur-2xl" />
              <div className="relative bg-[#0d1b2a]/80 backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-2xl">
                {/* Terminal header */}
                <div className="flex items-center gap-2 mb-6">
                  <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
                  <div className="w-3 h-3 rounded-full bg-[#febc2e]" />
                  <div className="w-3 h-3 rounded-full bg-[#28c840]" />
                  <span className="ml-3 text-invoica-gray-400 text-xs font-mono">invoice.ts</span>
                </div>
                <pre className="font-mono text-sm leading-7 overflow-x-auto"><code>
                  <span className="text-invoica-purple-light">import</span>{' '}
                  <span className="text-white">{'{ InvoicaClient }'}</span>{' '}
                  <span className="text-invoica-purple-light">from</span>{' '}
                  <span className="text-green-400">{`'@invoica/sdk'`}</span>
                  {'\n\n'}
                  <span className="text-invoica-purple-light">const</span>{' '}
                  <span className="text-white">client</span>{' '}
                  <span className="text-invoica-gray-400">=</span>{' '}
                  <span className="text-invoica-purple-light">new</span>{' '}
                  <span className="text-yellow-300">InvoicaClient</span>
                  <span className="text-white">{'({'}</span>
                  {'\n'}
                  {'  '}<span className="text-white">apiKey</span>
                  <span className="text-invoica-gray-400">:</span>{' '}
                  <span className="text-green-400">{`'sk_live_abc123...'`}</span>
                  {'\n'}
                  <span className="text-white">{'})'}</span>
                  {'\n\n'}
                  <span className="text-invoica-purple-light">const</span>{' '}
                  <span className="text-white">invoice</span>{' '}
                  <span className="text-invoica-gray-400">=</span>{' '}
                  <span className="text-invoica-purple-light">await</span>{' '}
                  <span className="text-white">client.invoices.</span>
                  <span className="text-yellow-300">create</span>
                  <span className="text-white">{'({'}</span>
                  {'\n'}
                  {'  '}<span className="text-white">amount</span>
                  <span className="text-invoica-gray-400">:</span>{' '}
                  <span className="text-orange-300">5000</span>
                  <span className="text-invoica-gray-400">,</span>
                  {'\n'}
                  {'  '}<span className="text-white">currency</span>
                  <span className="text-invoica-gray-400">:</span>{' '}
                  <span className="text-green-400">{`'USD'`}</span>
                  <span className="text-invoica-gray-400">,</span>
                  {'\n'}
                  {'  '}<span className="text-white">description</span>
                  <span className="text-invoica-gray-400">:</span>{' '}
                  <span className="text-green-400">{`'AI Agent API Usage'`}</span>
                  {'\n'}
                  <span className="text-white">{'})'}</span>
                  {'\n\n'}
                  <span className="text-invoica-gray-400">{'// => INV-2026-0001'}</span>
                </code></pre>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
