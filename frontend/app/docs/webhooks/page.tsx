```tsx
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function WebhooksPage() {
  return (
    <div className="max-w-4xl mx-auto py-10 px-6">
      <h1 className="text-4xl font-bold mb-4">Webhooks</h1>
      <p className="text-lg text-muted-foreground mb-10">
        Receive real-time notifications when invoice and settlement events occur.
      </p>

      <section className="mb-10">
        <h2 className="text-2xl font-semibold mb-4">Register a Webhook</h2>
        <p className="mb-4">
          Method: <Badge variant="secondary">POST</Badge> /v1/webhooks
        </p>

        <Card className="bg-gray-100 border-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-mono">Request Body</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-sm font-mono whitespace-pre-wrap">{`{
  "url": "https://your-app.com/webhook",
  "events": ["invoice.created", "settlement.completed"],
  "secret": "your_webhook_secret"
}`}</pre>
          </CardContent>
        </Card>

        <Card className="bg-gray-100 border-0 mt-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-mono">Response</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-sm font-mono whitespace-pre-wrap">{`{
  "id": "wh_123",
  "url": "https://your-app.com/webhook",
  "events": ["invoice.created", "settlement.completed"],
  "active": true,
  "createdAt": "2024-01-15T10:30:00Z"
}`}</pre>
          </CardContent>
        </Card>
      </section>

      <section className="mb-10">
        <h2 className="text-2xl font-semibold mb-4">Event Types</h2>
        <Card className="bg-gray-100 border-0">
          <CardContent className="pt-6 space-y-3">
            <div>
              <Badge className="mr-2">invoice.created</Badge>
              <span className="text-muted-foreground">A new invoice has been created.</span>
            </div>
            <div>
              <Badge className="mr-2">invoice.paid</Badge>
              <span className="text-muted-foreground">An invoice has been paid.</span>
            </div>
            <div>
              <Badge className="mr-2">settlement.completed</Badge>
              <span className="text-muted-foreground">A settlement has been completed.</span>
            </div>
            <div>
              <Badge className="mr-2">settlement.failed</Badge>
              <span className="text-muted-foreground">A settlement has failed.</span>
            </div>
            <div>
              <Badge className="mr-2">apikey.revoked</Badge>
              <span className="text-muted-foreground">An API key has been revoked.</span>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="mb-10">
        <h2 className="text-2xl font-semibold mb-4">Verifying Signatures</h2>
        <p className="mb-4 text-muted-foreground">
          Each webhook request includes an X-Signature header with HMAC-SHA256.
        </p>
        <Card className="bg-gray-100 border-0">
          <CardContent className="pt-6">
            <pre className="text-sm font-mono">{`import { constructEvent } from '@invoica/sdk';

const event = constructEvent(payload, signature, secret);`}</pre>
          </CardContent>
        </Card>
      </section>

      <section>
        <h2 className="text-2xl font-semibold mb-4">Retry Policy</h2>
        <p className="text-muted-foreground">
          Failed deliveries are retried 3 times with exponential backoff.
        </p>
      </section>
    </div>
  );
}
```