export default function Footer() {
  return (
    <footer className="bg-invoica-blue py-16">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid md:grid-cols-4 gap-8 mb-12">
          <div>
            <h3 className="text-lg font-bold text-white mb-4">Invoica</h3>
            <p className="text-sm text-invoica-gray-400 leading-relaxed">
              The Financial OS for AI Agents. Automated invoicing, tax compliance, and settlement detection built on the x402 protocol.
            </p>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white mb-4">Product</h4>
            <ul className="space-y-2">
              <li><a href="https://docs.invoica.ai" className="text-sm text-invoica-gray-400 hover:text-white transition-colors">Documentation</a></li>
              <li><a href="https://docs.invoica.ai/api-reference/overview" className="text-sm text-invoica-gray-400 hover:text-white transition-colors">API Reference</a></li>
              <li><a href="https://docs.invoica.ai/sdk/overview" className="text-sm text-invoica-gray-400 hover:text-white transition-colors">SDK</a></li>
              <li><a href="#pricing" className="text-sm text-invoica-gray-400 hover:text-white transition-colors">Pricing</a></li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white mb-4">Resources</h4>
            <ul className="space-y-2">
              <li><a href="https://docs.invoica.ai/quickstart" className="text-sm text-invoica-gray-400 hover:text-white transition-colors">Quickstart</a></li>
              <li><a href="https://docs.invoica.ai/guides/create-invoice" className="text-sm text-invoica-gray-400 hover:text-white transition-colors">Guides</a></li>
              <li><a href="https://docs.invoica.ai/concepts/x402-protocol" className="text-sm text-invoica-gray-400 hover:text-white transition-colors">x402 Protocol</a></li>
              <li><a href="https://github.com/skingem1/Invoica" className="text-sm text-invoica-gray-400 hover:text-white transition-colors">GitHub</a></li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white mb-4">Company</h4>
            <ul className="space-y-2">
              <li><a href="https://twitter.com/NexusCollectv" className="text-sm text-invoica-gray-400 hover:text-white transition-colors">Twitter / X</a></li>
              <li><a href="https://github.com/skingem1/Invoica" className="text-sm text-invoica-gray-400 hover:text-white transition-colors">Open Source</a></li>
              <li><a href="mailto:hello@invoica.ai" className="text-sm text-invoica-gray-400 hover:text-white transition-colors">Contact</a></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-invoica-gray-700 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-invoica-gray-500">
            Built by Nexus Collective
          </p>
          <p className="text-sm text-invoica-gray-500">
            Powered by the x402 protocol
          </p>
        </div>
      </div>
    </footer>
  );
}
