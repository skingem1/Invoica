/**
 * pact-e2e-test.ts — End-to-end PACT demo test
 * Run: npx ts-node scripts/pact-e2e-test.ts
 */
const API = process.env.INVOICA_API_URL || 'https://api.invoica.ai';
const ESCROW_PDA = 'GrY3CHeAptBBvoB2XWCVe8uxUdkCJHTkDjhB2mP9MunC';

async function post(path: string, body: object, headers?: Record<string, string>) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  return { status: res.status, data: await res.json() as Record<string, unknown> };
}

async function get(path: string) {
  const res = await fetch(`${API}${path}`);
  return { status: res.status, data: await res.json() as Record<string, unknown> };
}

function assert(ok: boolean, detail?: string) {
  console.log(ok ? '  ✅ PASS' : `  ❌ FAIL${detail ? ' — ' + detail : ''}`);
  if (!ok) process.exitCode = 1;
}

async function main() {
  console.log('\n=== INVOICA PACT E2E TEST ===\n');
  let pass = 0, fail = 0;

  const health = await get('/v1/health');
  assert(health.status === 200, `health ${health.status}`);
  if (health.status === 200) pass++; else fail++;

  const manifest = await get('/.well-known/x402');
  assert(manifest.status === 200 && ((manifest.data as any).capabilities?.length === 3));
  pass++; 

  const startA = await post('/v1/pact/session/start', { grantor: 'e2e-agent-buyer-0xAAAA' });
  assert(startA.data.success === true && (startA.data as any).ceiling === 'PROVISIONAL');
  const sidA = startA.data.sessionId as string;
  const jwtA = startA.data.jwt as string;
  pass++;

  const startB = await post('/v1/pact/session/start', { grantor: 'e2e-agent-seller-0xBBBB' });
  assert(startB.data.success === true);
  const sidB = startB.data.sessionId as string;
  const jwtB = startB.data.jwt as string;
  pass++;

  const tax = await post('/api/sap/execute', { capability: 'compliance:tax', params: { buyer_state: 'CA', amount: 100 } }, { 'X-Payment-Protocol': 'SAP-x402', 'X-Payment-Escrow-PDA': ESCROW_PDA });
  assert(tax.data.success === true && !!(tax.data as any).result?.jurisdiction);
  pass++;

  const inv = await post('/api/sap/execute', { capability: 'payment:invoice', params: { issuer: 'e2e-buyer', recipient: 'e2e-seller', amount: 0.01, description: 'E2E test' } }, { 'X-Payment-Protocol': 'SAP-x402', 'X-Payment-Escrow-PDA': ESCROW_PDA });
  assert(inv.data.success === true && !!(inv.data as any).result?.invoiceNumber);
  pass++;

  const completeA = await post(`/v1/pact/session/${sidA}/complete`, { outcome: 'success', jwt: jwtA });
  assert(completeA.data.success === true && (completeA.data as any).trustDelta === 2);
  pass++;

  const completeB = await post(`/v1/pact/session/${sidB}/complete`, { outcome: 'partial', jwt: jwtB });
  assert(completeB.data.success === true && (completeB.data as any).trustDelta === 0);
  pass++;

  const stateA = await get(`/v1/pact/session/${sidA}`);
  const stateB = await get(`/v1/pact/session/${sidB}`);
  assert((stateA.data as any).session?.status === 'complete' && (stateB.data as any).session?.status === 'complete');
  pass++;

  console.log(`\n=== RESULTS: ${pass} passed, ${fail} failed ===\n`);
}
main().catch((err) => { console.error('Fatal:', err); process.exit(1); });