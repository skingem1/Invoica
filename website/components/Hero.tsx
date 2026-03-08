'use client';

import Image from 'next/image';

export default function Hero() {
  return (
    <section className="relative pt-32 pb-24 overflow-hidden bg-white min-h-[90vh] flex items-center">
      {/* Subtle background effects */}
      <div className="absolute inset-0">
        {/* Gradient orbs - lighter for white bg */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-invoica-purple/5 rounded-full blur-3xl animate-pulse-slow" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-invoica-purple-light/5 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '2s' }} />
        <div className="absolute top-1/2 right-1/3 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '4s' }} />
        {/* Grid overlay */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: 'linear-gradient(rgba(10,37,64,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(10,37,64,0.1) 1px, transparent 1px)',
          backgroundSize: '64px 64px',
        }} />
      </div>

      <div className="relative max-w-7xl mx-auto px-6 w-full">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left content */}
          <div className="animate-fade-in-up">
            <div className="inline-flex items-center px-4 py-1.5 rounded-full bg-invoica-purple/5 border border-invoica-purple/15 mb-8">
              <div className="w-2 h-2 rounded-full bg-invoica-purple animate-glow mr-3" />
              <span className="text-xs font-medium text-invoica-gray-500 tracking-wide uppercase">Now in Public Beta</span>
            </div>

            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-invoica-blue leading-[1.1] mb-8 tracking-tight">
              The Financial OS
              <br />
              <span className="bg-gradient-to-r from-invoica-purple to-invoica-purple-light bg-clip-text text-transparent">
                for AI Agents
              </span>
            </h1>

            <p className="text-lg md:text-xl text-invoica-gray-500 mb-10 max-w-lg leading-relaxed">
              Your agents can now pay, invoice, and settle autonomously. Built on x402 — the open protocol for agent payments.
            </p>

            <div className="flex flex-wrap gap-4">
              <a
                href="https://app.invoica.ai/api-keys?utm_source=hn&utm_medium=post&utm_campaign=beta2026"
                className="group inline-flex items-center px-8 py-4 text-sm font-semibold text-white bg-gradient-to-r from-invoica-purple to-invoica-purple-light rounded-full hover:shadow-xl hover:shadow-invoica-purple/30 transition-all duration-300 hover:-translate-y-0.5"
              >
                Claim Free Beta Access →
              </a>

              <a
                href="#demo"
                className="group inline-flex items-center px-8 py-4 text-sm font-semibold text-invoica-gray-600 bg-white border border-invoica-gray-200 rounded-full hover:border-invoica-purple/30 hover:text-invoica-purple transition-all duration-300 hover:-translate-y-0.5"
              >
                Watch Demo
                <svg className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h1m4 0h1m6-10V7a3 3 0 00-3-3H6a3 3 0 00-3 3v4a3 3 0 003 3h7m3-10l3 3m-3-3v6" />
                </svg>
              </a>
            </div>

            <div className="mt-8 flex items-center text-sm text-invoica-gray-400">
              <span>Built on the x402 protocol  •  <span className="inline-flex items-center"><span className="w-2 h-2 rounded-full bg-green-500 animate-pulse mr-1"></span>14 real settlements</span> live on Base</span>
            </div>
          </div>

          {/* Right content - Dashboard preview */}
          <div className="relative animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
            <div className="relative">
              {/* Glow effect behind dashboard */}
              <div className="absolute -inset-4 bg-gradient-to-r from-invoica-purple/20 to-invoica-purple-light/20 rounded-3xl blur-2xl opacity-30" />
              
              {/* Dashboard mockup */}
              <div className="relative bg-white rounded-2xl shadow-2xl border border-invoica-gray-100 overflow-hidden">
                <div className="bg-gradient-to-r from-invoica-purple to-invoica-purple-light p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                        <div className="w-4 h-4 rounded bg-white/60" />
                      </div>
                      <div>
                        <div className="text-white font-semibold">Agent Dashboard</div>
                        <div className="text-white/70 text-sm">Live settlements</div>
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <div className="w-3 h-3 rounded-full bg-white/30" />
                      <div className="w-3 h-3 rounded-full bg-white/30" />
                      <div className="w-3 h-3 rounded-full bg-white/60" />
                    </div>
                  </div>
                </div>
                
                <div className="p-6 space-y-4">
                  {/* Stats row */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-green-50 rounded-lg p-3">
                      <div className="text-green-600 text-sm font-medium">Active</div>
                      <div className="text-green-900 text-lg font-bold">$2,847</div>
                    </div>
                    <div className="bg-blue-50 rounded-lg p-3">
                      <div className="text-blue-600 text-sm font-medium">Pending</div>
                      <div className="text-blue-900 text-lg font-bold">$1,203</div>
                    </div>
                    <div className="bg-purple-50 rounded-lg p-3">
                      <div className="text-purple-600 text-sm font-medium">Settled</div>
                      <div className="text-purple-900 text-lg font-bold">$8,921</div>
                    </div>
                  </div>
                  
                  {/* Transaction list */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-invoica-gray-50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                        <div>
                          <div className="font-medium text-sm">OpenAI API Call</div>
                          <div className="text-xs text-invoica-gray-500">2 minutes ago</div>
                        </div>
                      </div>
                      <div className="text-sm font-semibold">$0.0023</div>
                    </div>
                    
                    <div className="flex items-center justify-between p-3 bg-invoica-gray-50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="w-2 h-2 rounded-full bg-blue-500" />
                        <div>
                          <div className="font-medium text-sm">Claude API Call</div>
                          <div className="text-xs text-invoica-gray-500">5 minutes ago</div>
                        </div>
                      </div>
                      <div className="text-sm font-semibold">$0.0041</div>
                    </div>
                    
                    <div className="flex items-center justify-between p-3 bg-invoica-gray-50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="w-2 h-2 rounded-full bg-purple-500" />
                        <div>
                          <div className="font-medium text-sm">Data Processing</div>
                          <div className="text-xs text-invoica-gray-500">12 minutes ago</div>
                        </div>
                      </div>
                      <div className="text-sm font-semibold">$0.0156</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}