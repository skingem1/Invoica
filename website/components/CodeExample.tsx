export default function CodeExample() {
  return (
    <section className="py-20 bg-invoica-gray-50">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="text-3xl md:text-4xl font-bold text-invoica-blue mb-4">
              Built for developers
            </h2>
            <p className="text-lg text-invoica-gray-500 mb-6">
              A clean, typed API that feels natural. Create invoices, calculate taxes,
              and monitor settlements with just a few lines of code.
            </p>
            <ul className="space-y-3 mb-8">
              <li className="flex items-center gap-3 text-invoica-gray-600">
                <svg className="w-5 h-5 text-invoica-purple flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span className="text-sm">Full TypeScript types for every API response</span>
              </li>
              <li className="flex items-center gap-3 text-invoica-gray-600">
                <svg className="w-5 h-5 text-invoica-purple flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span className="text-sm">Automatic retries with exponential backoff</span>
              </li>
              <li className="flex items-center gap-3 text-invoica-gray-600">
                <svg className="w-5 h-5 text-invoica-purple flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span className="text-sm">Webhook signature verification helpers</span>
              </li>
              <li className="flex items-center gap-3 text-invoica-gray-600">
                <svg className="w-5 h-5 text-invoica-purple flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span className="text-sm">Tree-shakeable — import only what you need</span>
              </li>
            </ul>
            <a href="https://docs.invoica.ai/quickstart" className="inline-flex items-center text-sm font-medium text-invoica-purple hover:text-invoica-purple/80 transition-colors">
              Read the quickstart guide
              <svg className="ml-1 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
            </a>
          </div>
          <div className="bg-invoica-blue rounded-xl p-6 font-mono text-sm shadow-2xl">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-3 h-3 rounded-full bg-red-500/50" />
              <div className="w-3 h-3 rounded-full bg-yellow-500/50" />
              <div className="w-3 h-3 rounded-full bg-green-500/50" />
              <span className="ml-2 text-invoica-gray-400 text-xs">webhook-handler.ts</span>
            </div>
            <pre className="text-invoica-gray-300 leading-relaxed overflow-x-auto"><code>{`import { verifyWebhook } from '@invoica/sdk';

app.post('/webhooks', (req, res) => {
  const event = verifyWebhook(
    req.body,
    req.headers['x-invoica-signature'],
    process.env.WEBHOOK_SECRET
  );

  switch (event.type) {
    case 'invoice.settled':
      // Payment confirmed on-chain
      grantAccess(event.data.buyer);
      break;

    case 'invoice.failed':
      // Handle payment failure
      notifyAgent(event.data.agentId);
      break;
  }

  res.status(200).send('OK');
});`}</code></pre>
          </div>
        </div>
      </div>
    </section>
  );
}
