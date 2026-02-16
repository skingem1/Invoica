export default function SdkOverviewPage() {
  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-6">TypeScript SDK Overview</h1>
      <p className="text-gray-600 mb-8">The Invoica TypeScript SDK provides a type-safe client for the Invoica API.</p>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">Installation</h2>
        <pre className="bg-gray-900 text-green-400 p-4 rounded-lg text-sm overflow-x-auto">npm install @invoica/sdk</pre>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">Key Features</h2>
        <ul className="space-y-3">
          {[
            { title: 'Type Safety', desc: 'Full TypeScript support with typed requests and responses' },
            { title: 'Auto Retry', desc: 'Configurable retry with exponential backoff for resilient API calls' },
            { title: 'Rate Limiting', desc: 'Built-in rate limit tracking to avoid 429 errors' },
            { title: 'Webhook Verification', desc: 'HMAC-SHA256 signature verification for webhook payloads' },
            { title: 'Debug Logging', desc: 'Optional debug output via INVOICA_DEBUG environment variable' },
          ].map((f) => (
            <li key={f.title} className="flex gap-3">
              <span className="font-medium text-blue-600 min-w-[140px]">{f.title}</span>
              <span className="text-gray-600">{f.desc}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">Quick Example</h2>
        <pre className="bg-gray-900 text-green-400 p-4 rounded-lg text-sm overflow-x-auto">{`import { CountableClient } from '@invoica/sdk';

const client = new CountableClient({ apiKey: 'your-key' });
const invoice = await client.invoices.create({
  amount: 1000,
  currency: 'USD',
  description: 'API service fee'
});`}</pre>
      </section>

      <section>
        <h2 className="text-2xl font-semibold mb-4">Modules</h2>
        <div className="grid grid-cols-2 gap-4">
          {[
            { name: 'Client', path: '/docs/sdk-reference' },
            { name: 'Authentication', path: '/docs/authentication' },
            { name: 'Webhooks', path: '/docs/webhooks' },
            { name: 'Error Handling', path: '/docs/error-handling' },
          ].map((m) => (
            <a key={m.name} href={m.path} className="p-4 border rounded-lg hover:border-blue-500 transition-colors">
              <span className="font-medium">{m.name}</span>
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}