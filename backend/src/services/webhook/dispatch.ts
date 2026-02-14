import { WebhookEvent, DispatchResult, WebhookRegistration } from './types';
import { signPayload } from './signature';

export async function dispatch(
  event: WebhookEvent,
  registrationMap: Map<string, WebhookRegistration>
): Promise<DispatchResult[]> {
  const results: DispatchResult[] = [];
  const payload = JSON.stringify(event);
  const timestamp = Date.now();

  for (const [, registration] of registrationMap) {
    if (registration.eventType !== event.type) continue;

    const signature = signPayload(payload, registration.secret);

    try {
      const response = await fetch(registration.url, {
        method: 'POST',
        headers: {
          'X-Countable-Signature': signature,
          'X-Countable-Event': event.type,
          'X-Countable-Timestamp': String(timestamp),
          'Content-Type': 'application/json',
        },
        body: payload,
      });

      results.push({
        success: response.ok,
        statusCode: response.status,
        url: registration.url,
        eventType: event.type,
      });
    } catch (error) {
      results.push({
        success: false,
        statusCode: 0,
        url: registration.url,
        eventType: event.type,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return results;
}