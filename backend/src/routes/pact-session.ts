/**
 * pact-session.ts — PACT Chamber 2/4 session management
 * POST /v1/pact/session/start        — Chamber 2 entry, issue JWT, default PROVISIONAL
 * POST /v1/pact/session/:id/cred-update — Update session with credential data
 * GET  /v1/pact/session/:id          — Read session state
 */
import { Router, Request, Response } from 'express';
import { fetchHelixaCred } from '../lib/helixa';
import { issueSessionJwt, verifySessionJwt } from '../lib/pact-session-jwt';
import * as crypto from 'crypto';

const router = Router();

export interface PactSession {
  sessionId: string;
  grantor: string;
  ceiling: string;
  maxUsdc: number;
  score: number | null;
  status: 'provisional' | 'resolved' | 'complete';
  createdAt: string;
  updatedAt: string;
}
export const sessions = new Map<string, PactSession>();

export function resolveCeiling(score: number | null, verified: boolean): { ceiling: string; maxUsdc: number } {
  if (score === null || score === 0) return { ceiling: 'PROVISIONAL', maxUsdc: 50 };
  if (!verified) return { ceiling: 'PROVISIONAL', maxUsdc: 50 };
  if (score < 30) return { ceiling: 'REJECTED', maxUsdc: 0 };
  if (score < 50) return { ceiling: 'RESTRICTED', maxUsdc: 100 };
  if (score < 60) return { ceiling: 'RESTRICTED', maxUsdc: 1000 };
  if (score < 70) return { ceiling: 'STANDARD', maxUsdc: 10000 };
  if (score < 85) return { ceiling: 'STANDARD', maxUsdc: 10000 };
  return { ceiling: 'FULL', maxUsdc: 1_000_000 };
}

router.post('/session/start', async (req: Request, res: Response) => {
  const { grantor } = req.body as { grantor?: string };
  if (!grantor) {
    res.status(400).json({ success: false, error: { message: 'grantor required', code: 'MISSING_GRANTOR' } });
    return;
  }
  const sessionId = crypto.randomUUID();
  const jwt = issueSessionJwt(sessionId);
  const now = new Date().toISOString();
  const session: PactSession = {
    sessionId, grantor, ceiling: 'PROVISIONAL', maxUsdc: 50,
    score: null, status: 'provisional', createdAt: now, updatedAt: now,
  };
  sessions.set(sessionId, session);
  fetchHelixaCred(grantor).then((cred) => {
    const s = sessions.get(sessionId);
    if (!s || s.status === 'complete') return;
    const { ceiling, maxUsdc } = resolveCeiling(cred?.score ?? null, cred?.verification_status === 'verified');
    s.ceiling = ceiling; s.maxUsdc = maxUsdc; s.score = cred?.score ?? null;
    s.status = 'resolved'; s.updatedAt = new Date().toISOString();
    console.info(`[pact-session] ${sessionId} ceiling resolved: ${ceiling} (score=${s.score})`);
  }).catch((err) => console.error('[pact-session] helixa async error:', (err as Error).message));
  console.info(`[pact-session] ${sessionId} started grantor=${grantor} ceiling=PROVISIONAL`);
  res.json({ success: true, sessionId, ceiling: 'PROVISIONAL', maxUsdc: 50, jwt });
});

router.post('/session/:id/cred-update', (req: Request, res: Response) => {
  const { id } = req.params;
  const authHeader = req.headers['authorization'];
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : authHeader || '';
  const verify = verifySessionJwt(token, id);
  if (!verify.valid) {
    res.status(401).json({ success: false, error: { message: verify.reason || 'Unauthorized', code: 'INVALID_JWT' } });
    return;
  }
  const session = sessions.get(id);
  if (!session) {
    res.status(404).json({ success: false, error: { message: 'Session not found', code: 'NOT_FOUND' } });
    return;
  }
  const { score, verification_status } = req.body as { score?: number; verification_status?: string };
  const { ceiling, maxUsdc } = resolveCeiling(score ?? null, verification_status === 'verified');
  session.ceiling = ceiling;
  session.maxUsdc = maxUsdc;
  session.score = score ?? null;
  session.status = 'resolved';
  session.updatedAt = new Date().toISOString();
  console.info(`[pact-session] ${id} cred-update ceiling=${ceiling} score=${score}`);
  res.json({ success: true, sessionId: id, ceiling, maxUsdc });
});

router.get('/session/:id', (req: Request, res: Response) => {
  const session = sessions.get(req.params.id);
  if (!session) {
    res.status(404).json({ success: false, error: { message: 'Session not found', code: 'NOT_FOUND' } });
    return;
  }
  res.json({ success: true, session });
});

export default router;