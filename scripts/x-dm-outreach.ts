/**
 * x-dm-outreach.ts
 *
 * X/Twitter DM outreach script for Invoica.
 * Searches for target accounts discussing x402, agent payments, and related topics,
 * then sends personalised DMs to qualified candidates.
 *
 * Zero external dependencies — uses only Node.js built-in modules.
 *
 * CLI usage:
 *   npx ts-node --transpile-only scripts/x-dm-outreach.ts --run
 *   npx ts-node --transpile-only scripts/x-dm-outreach.ts --dry-run
 *   npx ts-node --transpile-only scripts/x-dm-outreach.ts --status
 */

import * as https from 'https';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

// ---------------------------------------------------------------------------
// Load .env
// ---------------------------------------------------------------------------
try {
  require('dotenv/config');
} catch {
  // dotenv not installed — rely on env vars being set externally
}

// ---------------------------------------------------------------------------
// Credential remap: INVOICA_X_* → X_*
// ---------------------------------------------------------------------------
if (process.env.INVOICA_X_API_KEY)             process.env.X_API_KEY             = process.env.INVOICA_X_API_KEY;
if (process.env.INVOICA_X_API_SECRET)          process.env.X_API_SECRET          = process.env.INVOICA_X_API_SECRET;
if (process.env.INVOICA_X_ACCESS_TOKEN)        process.env.X_ACCESS_TOKEN        = process.env.INVOICA_X_ACCESS_TOKEN;
if (process.env.INVOICA_X_ACCESS_TOKEN_SECRET) process.env.X_ACCESS_TOKEN_SECRET = process.env.INVOICA_X_ACCESS_TOKEN_SECRET;
if (process.env.INVOICA_X_BEARER_TOKEN)        process.env.X_BEARER_TOKEN        = process.env.INVOICA_X_BEARER_TOKEN;

// ---------------------------------------------------------------------------
// Config constants
// ---------------------------------------------------------------------------
const MAX_CANDIDATES   = 20;
const MAX_DMS_PER_RUN  = 5;
const DM_DELAY_MS      = 30000;

const ROOT        = path.resolve(__dirname, '..');
const REPORTS_DIR = path.join(ROOT, 'reports', 'x-admin');
const STATE_FILE  = path.join(REPORTS_DIR, 'state.json');

// ---------------------------------------------------------------------------
// XCredentials interface + loadCredentials()
// ---------------------------------------------------------------------------
interface XCredentials {
  apiKey: string;
  apiSecret: string;
  accessToken: string;
  accessTokenSecret: string;
  bearerToken: string;
}

function loadCredentials(): XCredentials {
  const apiKey            = process.env.X_API_KEY;
  const apiSecret         = process.env.X_API_SECRET;
  const accessToken       = process.env.X_ACCESS_TOKEN;
  const accessTokenSecret = process.env.X_ACCESS_TOKEN_SECRET;
  const bearerToken       = process.env.X_BEARER_TOKEN;

  const missing: string[] = [];
  if (!apiKey)            missing.push('X_API_KEY');
  if (!apiSecret)         missing.push('X_API_SECRET');
  if (!accessToken)       missing.push('X_ACCESS_TOKEN');
  if (!accessTokenSecret) missing.push('X_ACCESS_TOKEN_SECRET');
  if (!bearerToken)       missing.push('X_BEARER_TOKEN');

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}\n` +
      'Set them in your .env file or export them before running this script.'
    );
  }

  return {
    apiKey: apiKey!,
    apiSecret: apiSecret!,
    accessToken: accessToken!,
    accessTokenSecret: accessTokenSecret!,
    bearerToken: bearerToken!,
  };
}

// ---------------------------------------------------------------------------
// OAuth 1.0a helpers
// ---------------------------------------------------------------------------

/** Percent-encode a string per RFC 3986. */
function pct(str: string): string {
  return encodeURIComponent(str).replace(/[!'()*]/g, (c) => {
    return '%' + c.charCodeAt(0).toString(16).toUpperCase();
  });
}

/** Build the full OAuth Authorization header value. */
function buildOAuthHeader(
  method: string,
  url: string,
  creds: XCredentials,
  extraParams?: Record<string, string>
): string {
  const nonce     = crypto.randomBytes(16).toString('hex');
  const timestamp = Math.floor(Date.now() / 1000).toString();

  const oauthParams: Record<string, string> = {
    oauth_consumer_key:     creds.apiKey,
    oauth_nonce:            nonce,
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp:        timestamp,
    oauth_token:            creds.accessToken,
    oauth_version:          '1.0',
  };

  const allParams: Record<string, string> = { ...oauthParams };
  if (extraParams) {
    Object.assign(allParams, extraParams);
  }

  // Build signature base string
  const sortedKeys  = Object.keys(allParams).sort();
  const paramString = sortedKeys.map((k) => `${pct(k)}=${pct(allParams[k])}`).join('&');
  const baseString  = [method.toUpperCase(), pct(url), pct(paramString)].join('&');

  // Sign with HMAC-SHA1
  const signingKey = `${pct(creds.apiSecret)}&${pct(creds.accessTokenSecret)}`;
  const signature  = crypto.createHmac('sha1', signingKey).update(baseString).digest('base64');

  oauthParams['oauth_signature'] = signature;

  const headerParts = Object.keys(oauthParams)
    .sort()
    .map((k) => `${pct(k)}="${pct(oauthParams[k])}"`)
    .join(', ');

  return `OAuth ${headerParts}`;
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

interface ApiResponse {
  statusCode: number;
  body: any;
  rawBody: string;
}

/** Bearer-token GET request (for search API). */
function httpsGet(url: string, bearerToken: string): Promise<ApiResponse> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);

    const options: https.RequestOptions = {
      hostname: parsed.hostname,
      port:     443,
      path:     parsed.pathname + parsed.search,
      method:   'GET',
      headers: {
        Authorization: `Bearer ${bearerToken}`,
        'User-Agent':  'x-dm-outreach/1.0',
      },
    };

    const req = https.request(options, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => {
        const rawBody = Buffer.concat(chunks).toString('utf-8');
        let body: any;
        try { body = JSON.parse(rawBody); } catch { body = rawBody; }
        resolve({ statusCode: res.statusCode || 0, body, rawBody });
      });
    });

    req.on('error', (err) => reject(err));
    req.end();
  });
}

/** Generic POST helper. Accepts body as a pre-serialised string. */
function httpsPost(
  url: string,
  headers: Record<string, string>,
  body: string
): Promise<ApiResponse> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);

    const options: https.RequestOptions = {
      hostname: parsed.hostname,
      port:     443,
      path:     parsed.pathname + parsed.search,
      method:   'POST',
      headers: {
        ...headers,
        'Content-Length': Buffer.byteLength(body).toString(),
        'User-Agent':     'x-dm-outreach/1.0',
      },
    };

    const req = https.request(options, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => {
        const rawBody = Buffer.concat(chunks).toString('utf-8');
        let parsedBody: any;
        try { parsedBody = JSON.parse(rawBody); } catch { parsedBody = rawBody; }
        resolve({ statusCode: res.statusCode || 0, body: parsedBody, rawBody });
      });
    });

    req.on('error', (err) => reject(err));
    req.write(body);
    req.end();
  });
}

// ---------------------------------------------------------------------------
// Error Handling
// ---------------------------------------------------------------------------
function assertOk(res: { status: number; body: any }, context: string): void {
  if (res.status < 200 || res.status >= 300) {
    const detail = typeof res.body === 'object'
      ? (res.body?.detail || res.body?.title || JSON.stringify(res.body).slice(0, 200))
      : String(res.body).slice(0, 200);
    throw new Error(`${context} failed (${res.status}): ${detail}`);
  }
}

// ---------------------------------------------------------------------------
// Anthropic API
// ---------------------------------------------------------------------------
async function callClaude(system: string, user: string, maxTokens = 200): Promise<string> {
  const body = JSON.stringify({
    model: 'claude-haiku-4-5',
    max_tokens: maxTokens,
    system,
    messages: [{ role: 'user', content: user }],
  });

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.anthropic.com',
      port: 443,
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
        'Content-Length': Buffer.byteLength(body).toString(),
      },
    }, res => {
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString();
        if ((res.statusCode ?? 0) < 200 || (res.statusCode ?? 0) >= 300) {
          return reject(new Error(`Anthropic API error (${res.statusCode}): ${raw.slice(0, 200)}`));
        }
        try {
          const parsed = JSON.parse(raw);
          const text = parsed.content?.[0]?.text?.trim() || '';
          resolve(text);
        } catch (e) { reject(e); }
      });
      res.on('error', reject);
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ---------------------------------------------------------------------------
// DM Personalization
// ---------------------------------------------------------------------------
async function generatePersonalizedDM(candidate: Candidate): Promise<string> {
  const system = `You write cold outreach DMs for @invoica_ai — the Financial OS for AI Agents (automated invoicing, on-chain settlement on Base, pay-per-use AI inference at 0.003 USDC/call, free beta).

Rules:
- 1-2 sentences max. Under 280 characters total.
- Start with their first name (no "Hey there!" or "Hi!")
- Reference ONE specific thing from their bio or tweet — not generic
- Describe Invoica in 1 clause: "financial OS for AI agents — automated invoicing + on-chain settlement"
- End with: "Free beta at invoica.ai — happy to walk you through it."
- No hashtags. No emoji. No filler phrases like "great work" or "love what you're building".
- Return ONLY the DM text, nothing else.`;

  const firstName = candidate.name.split(/\s+/)[0] || candidate.username;
  const userPrompt = `Target: @${candidate.username} (${firstName})
Bio: ${candidate.bio}
Their tweet: "${candidate.matchingTweet.slice(0, 200)}"

Write the DM.`;

  const text = await callClaude(system, userPrompt, 200);
  if (!text) throw new Error('Claude returned empty DM');

  // Enforce 280 char limit
  return text.length > 280 ? text.slice(0, 277) + '...' : text;
}


// ---------------------------------------------------------------------------
// DM Sending
// ---------------------------------------------------------------------------
interface SendDMResult {
  success: boolean;
  dmConversationId?: string;
  error?: string;
  permissionError?: boolean;
}

async function sendDM(userId: string, message: string, creds: XCredentials): Promise<SendDMResult> {
  const url = 'https://api.twitter.com/2/dm_conversations';
  const payload = {
    participant_ids: [userId],
    message: { text: message },
  };
  const body = JSON.stringify(payload);
  const authHeader = buildOAuthHeader('POST', url, creds);

  return new Promise((resolve, reject) => {
    // Use parsedUrl for the URL object to avoid shadowing the response body variable
    const parsedUrl = new URL(url);
    const req = https.request({
      hostname: parsedUrl.hostname,
      port: 443,
      path: parsedUrl.pathname,
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body).toString(),
        'User-Agent': 'x-dm-outreach/1.0',
      },
    }, res => {
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => {
        const rawBody = Buffer.concat(chunks).toString();
        let parsed: any;
        try { parsed = JSON.parse(rawBody); } catch { parsed = rawBody; }

        if (res.statusCode === 201) {
          resolve({
            success: true,
            dmConversationId: parsed?.data?.dm_conversation_id,
          });
        } else if (res.statusCode === 403) {
          resolve({
            success: false,
            permissionError: true,
            error: `403 Forbidden — your X app likely needs "Direct Messages" permission.\n` +
              `Go to: https://developer.twitter.com/en/portal/projects-and-apps\n` +
              `Enable: "Read and Write and Direct Messages"\n` +
              `Then regenerate access tokens and update .env`,
          });
        } else {
          resolve({
            success: false,
            error: `${res.statusCode}: ${JSON.stringify(parsed).slice(0, 200)}`,
          });
        }
      });
      res.on('error', reject);
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}
// ---------------------------------------------------------------------------
// Candidate interface
// ---------------------------------------------------------------------------
interface Candidate {
  userId:        string;
  username:      string;
  name:          string;
  bio:           string;
  followersCount: number;
  matchingTweet: string;
}

interface TwitterTweetV2 {
  author_id: string;
  text: string;
}

interface TwitterUserV2 {
  id: string;
  username: string;
  name: string;
  description?: string;
  public_metrics?: { followers_count: number };
}

// ---------------------------------------------------------------------------
// Search queries
// ---------------------------------------------------------------------------
const SEARCH_QUERIES: string[] = [
  '(x402 OR "HTTP 402" OR "agent payments" OR "AI agent invoicing") lang:en -is:retweet',
  '("Base network" OR "Base L2" OR "USDC" OR "autonomous agents") (billing OR payments OR invoicing) lang:en -is:retweet',
];

// ---------------------------------------------------------------------------
// searchTargetAccounts()
// ---------------------------------------------------------------------------
async function searchTargetAccounts(bearerToken: string): Promise<Candidate[]> {
  const seen      = new Set<string>();
  const candidates: Candidate[] = [];

  for (const query of SEARCH_QUERIES) {
    if (candidates.length >= MAX_CANDIDATES) break;

    const searchUrl = new URL('https://api.twitter.com/2/tweets/search/recent');
    searchUrl.searchParams.set('query',        query);
    searchUrl.searchParams.set('max_results',  '20');
    searchUrl.searchParams.set('tweet.fields', 'author_id,text');
    searchUrl.searchParams.set('expansions',   'author_id');
    searchUrl.searchParams.set('user.fields',  'id,username,name,description,public_metrics');

    const res = await httpsGet(searchUrl.toString(), bearerToken);

    if (res.statusCode < 200 || res.statusCode >= 300) {
      console.error(`[search] HTTP ${res.statusCode} for query: ${query.slice(0, 60)}...`);
      console.error(`[search] Response: ${res.rawBody.slice(0, 200)}`);
      continue;
    }

    const tweets: TwitterTweetV2[] = res.body?.data ?? [];
    const users: TwitterUserV2[]   = res.body?.includes?.users ?? [];

    // Build userId → user map
    const userMap = new Map<string, TwitterUserV2>(users.map(u => [u.id, u]));

    for (const tweet of tweets) {
      if (candidates.length >= MAX_CANDIDATES) break;

      const user = userMap.get(tweet.author_id);
      if (!user) continue;

      // Skip duplicates
      if (seen.has(user.id)) continue;

      // Skip @invoica_ai
      if (user.username?.toLowerCase() === 'invoica_ai') continue;

      // Filter: bio >= 10 chars
      const bio: string = user.description ?? '';
      if (bio.length < 10) continue;

      // Filter: followers >= 50
      const followersCount: number = user.public_metrics?.followers_count ?? 0;
      if (followersCount < 50) continue;

      seen.add(user.id);
      candidates.push({
        userId:        user.id,
        username:      user.username,
        name:          user.name ?? '',
        bio,
        followersCount,
        matchingTweet: tweet.text,
      });
    }
  }

  return candidates;
}

// ---------------------------------------------------------------------------
// Logging
// ---------------------------------------------------------------------------
function appendRunLog(entries: string[]): void {
  ensureDir(REPORTS_DIR);
  const date = new Date().toISOString().slice(0, 10);
  const logPath = path.join(REPORTS_DIR, `dm-outreach-${date}.md`);
  if (!fs.existsSync(logPath)) {
    fs.writeFileSync(logPath, `# DM Outreach Log — ${date}\n\n`);
  }
  fs.appendFileSync(logPath, entries.join('\n') + '\n\n');
}

// ---------------------------------------------------------------------------
// Main Run
// ---------------------------------------------------------------------------
async function run(dryRun: boolean): Promise<void> {
  console.log(`\n[x-dm-outreach] Starting ${dryRun ? 'DRY RUN' : 'LIVE RUN'}`);
  const creds = loadCredentials();
  const state = loadState();
  const date = new Date().toISOString().slice(0, 10);

  // Step 1: Discover candidates
  console.log('\n→ Discovering target accounts...');
  const allCandidates = await searchTargetAccounts(creds.bearerToken);
  console.log(`  Found ${allCandidates.length} candidates from search`);

  // Step 2: Filter already-contacted
  const newCandidates = filterNewCandidates(allCandidates, state);
  console.log(`  ${newCandidates.length} new (not yet contacted)`);

  const toContact = newCandidates.slice(0, MAX_DMS_PER_RUN);
  console.log(`  Will contact: ${toContact.length} (cap: ${MAX_DMS_PER_RUN})`);

  if (toContact.length === 0) {
    console.log('\n  No new candidates to contact. Done.');
    state.runs.push({ date, candidates: allCandidates.length, sent: 0 });
    saveState(state);
    return;
  }

  const logEntries: string[] = [
    `## Run at ${new Date().toISOString()}`,
    `**Mode:** ${dryRun ? 'dry-run' : 'live'}`,
    `**Candidates:** ${allCandidates.length} found, ${toContact.length} selected`,
    '',
  ];

  let sentCount = 0;

  // Step 3: Generate + send
  for (const candidate of toContact) {
    console.log(`\n→ @${candidate.username} (${candidate.followersCount} followers)`);
    console.log(`  Bio: ${candidate.bio.slice(0, 80)}`);
    console.log(`  Tweet: ${candidate.matchingTweet.slice(0, 80)}`);

    let dmText: string;
    try {
      console.log('  Generating personalized DM...');
      dmText = await generatePersonalizedDM(candidate);
      console.log(`  DM (${dmText.length} chars): ${dmText}`);
    } catch (e: any) {
      console.log(`  ❌ Generation failed: ${e.message}`);
      logEntries.push(`### @${candidate.username}`, `❌ DM generation failed: ${e.message}`, '');
      continue;
    }

    logEntries.push(
      `### @${candidate.username} (${candidate.userId})`,
      `**Bio:** ${candidate.bio}`,
      `**Tweet:** ${candidate.matchingTweet}`,
      `**DM:** ${dmText}`,
      '',
    );

    if (dryRun) {
      console.log('  [DRY RUN] Would send — skipping');
      logEntries.push('**Result:** DRY RUN — not sent', '');
      continue;
    }

    console.log('  Sending DM...');
    const result = await sendDM(candidate.userId, dmText, creds);

    if (result.success) {
      console.log(`  ✅ Sent! Conversation: ${result.dmConversationId}`);
      sentCount++;

      state.contacted[candidate.userId] = {
        username: candidate.username,
        sentAt: new Date().toISOString(),
        dmText,
      };
      saveState(state);

      logEntries.push(`**Result:** ✅ Sent — conversation ${result.dmConversationId}`, '');

      if (sentCount < toContact.length) {
        console.log(`  Waiting ${DM_DELAY_MS / 1000}s before next DM...`);
        await new Promise(r => setTimeout(r, DM_DELAY_MS));
      }
    } else if (result.permissionError) {
      console.log(`\n  ❌ PERMISSION ERROR — stopping run\n`);
      console.log(result.error);
      logEntries.push(`**Result:** ❌ Permission error — run stopped`, result.error ?? '', '');
      break;
    } else {
      console.log(`  ❌ Failed: ${result.error}`);
      logEntries.push(`**Result:** ❌ Failed: ${result.error}`, '');
    }
  }

  // Record run
  state.runs.push({ date, candidates: allCandidates.length, sent: sentCount });
  saveState(state);
  appendRunLog(logEntries);

  console.log(`\n[x-dm-outreach] Done. Sent: ${sentCount}/${toContact.length}`);
  console.log(`Log: reports/x-admin/dm-outreach-${date}.md`);
}


// ---------------------------------------------------------------------------
// State Management
// ---------------------------------------------------------------------------
interface ContactedEntry {
  username: string;
  sentAt: string;
  dmText: string;
}

interface RunEntry {
  date: string;
  candidates: number;
  sent: number;
}

interface OutreachState {
  contacted: Record<string, ContactedEntry>; // keyed by userId
  runs: RunEntry[];
}

function ensureDir(d: string): void {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
}

function loadState(): OutreachState {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
      return {
        contacted: parsed?.contacted && typeof parsed.contacted === 'object' ? parsed.contacted : {},
        runs:      Array.isArray(parsed?.runs) ? parsed.runs : [],
      };
    }
  } catch { /* reset on parse error */ }
  return { contacted: {}, runs: [] };
}

function saveState(state: OutreachState): void {
  ensureDir(REPORTS_DIR);
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function filterNewCandidates(candidates: Candidate[], state: OutreachState): Candidate[] {
  return candidates.filter(c => !state.contacted[c.userId]);
}

// ---------------------------------------------------------------------------
// Status Display
// ---------------------------------------------------------------------------
function printStatus(): void {
  const state = loadState();
  const contacted = Object.entries(state.contacted);
  console.log(`\n=== X DM Outreach Status ===`);
  console.log(`Total accounts contacted: ${contacted.length}`);
  if (contacted.length > 0) {
    console.log('\nContacted accounts:');
    contacted.forEach(([, entry]) => {
      console.log(`  @${entry.username} — ${entry.sentAt.slice(0, 10)}`);
      const preview = entry.dmText.length > 80 ? entry.dmText.slice(0, 80) + '...' : entry.dmText;
      console.log(`    DM: ${preview}`);
    });
  }
  console.log(`\nRun history (last 5):`);
  if (state.runs.length === 0) {
    console.log('  (no runs yet)');
  } else {
    state.runs.slice(-5).forEach(r => {
      console.log(`  ${r.date}: ${r.candidates} candidates, ${r.sent} sent`);
    });
  }
}
// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------
function printUsage(): void {
  console.log(`
x-dm-outreach.ts — X/Twitter DM Outreach for Invoica

Usage:
  ts-node scripts/x-dm-outreach.ts --run        Full cycle: discover → generate → send
  ts-node scripts/x-dm-outreach.ts --dry-run    Discover + preview DMs, no sending
  ts-node scripts/x-dm-outreach.ts --status     Show contacted accounts and run history
  ts-node scripts/x-dm-outreach.ts --help       Show this message

Environment variables:
  INVOICA_X_API_KEY, INVOICA_X_API_SECRET
  INVOICA_X_ACCESS_TOKEN, INVOICA_X_ACCESS_TOKEN_SECRET
  INVOICA_X_BEARER_TOKEN
  ANTHROPIC_API_KEY

Note: X app must have "Read and Write and Direct Messages" permission for --run.
Max ${MAX_DMS_PER_RUN} DMs per run, ${DM_DELAY_MS / 1000}s delay between sends.
`);
}

if (require.main === module) {
  const arg = process.argv[2];
  if (arg === '--run') {
    run(false).catch(e => { console.error('[x-dm-outreach] Fatal:', e.message); process.exit(1); });
  } else if (arg === '--dry-run') {
    run(true).catch(e => { console.error('[x-dm-outreach] Fatal:', e.message); process.exit(1); });
  } else if (arg === '--status') {
    printStatus();
  } else if (arg === '--help' || arg === '-h') {
    printUsage();
  } else {
    printUsage();
    if (arg) process.exit(1); // unknown arg exits with error
  }
}
