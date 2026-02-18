export default function Navbar() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-invoica-gray-200">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <a href="/" className="text-xl font-bold text-invoica-blue">
            Invoica
          </a>
          <div className="hidden md:flex items-center gap-6">
            <a href="https://docs.invoica.ai" className="text-sm text-invoica-gray-600 hover:text-invoica-blue transition-colors">
              Docs
            </a>
            <a href="#pricing" className="text-sm text-invoica-gray-600 hover:text-invoica-blue transition-colors">
              Pricing
            </a>
            <a href="https://github.com/skingem1/Invoica" className="text-sm text-invoica-gray-600 hover:text-invoica-blue transition-colors">
              GitHub
            </a>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <a href="https://app.invoica.ai" className="text-sm text-invoica-gray-600 hover:text-invoica-blue transition-colors">
            Dashboard
          </a>
          <a href="https://app.invoica.ai/api-keys" className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-invoica-purple rounded-lg hover:bg-invoica-purple/90 transition-colors">
            Get API Key
          </a>
        </div>
      </div>
    </nav>
  );
}
