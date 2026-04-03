/**
 * pact-session-jwt.ts — HMAC-SHA256 session JWT for PACT Chamber 2/4
 * No npm deps. Signs session_id + expiry, verifies on callback.
 * Env: PACT_SESSION_SECRET (defaults to PACT_SIGNING_SECRET || 'dev-secret')
 */
import * as crypto from 'crypto';

const SECRET = () => process.env.PACT_SESSION_SECRET || process.env.PACT_SIGNING_SECRET || 'dev-pact-secret';
const TTL_MS = 60 * 60 * 1000; // 1 hour

export function issueSessionJwt(sessionId: string): string {
  const payload = { sessionId, exp: Date.now() + TTL_MS };
  const data = JSON.stringify(payload);
  const sig = crypto.createHmac('sha256', SECRET()).update(data).digest('hex');
  return Buffer.from(JSON.stringify({ data, sig })).toString('base64url');
}

export function verifySessionJwt(
  token: string,
  expectedSessionId: string,
): { valid: boolean; reason?: string } {
  try {
    const { data, sig } = JSON.parse(Buffer.from(token, 'base64url').toString()) as { data: string; sig: string };
    const expected = crypto.createHmac('sha256', SECRET()).update(data).digest('hex');
    if (expected !== sig) return { valid: false, reason: 'Invalid signature' };
    const payload = JSON.parse(data) as { sessionId: string; exp: number };
    if (payload.exp < Date.now()) return { valid: false, reason: 'Session JWT expired' };
    if (payload.sessionId !== expectedSessionId) return { valid: false, reason: 'Session ID mismatch' };
    return { valid: true };
  } catch {
    return { valid: false, reason: 'Malformed token' };
  }
}