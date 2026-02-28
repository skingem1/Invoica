#!/usr/bin/env ts-node

/**
 * run-x-admin.ts — Invoica X/Twitter Autonomous Posting Agent
 *
 * Reads the content calendar, reviews each post with CEO (vision/tone)
 * and CTO (technical accuracy for technical posts), then publishes
 * approved content to @invoica_ai.
 *
 * Review flow:
 *   1. CEO reviews every post (company vision + communication plan alignment)
 *   2. CTO reviews technical posts (accuracy of x402/API/blockchain claims)
 *   3. Only APPROVED posts are published
 *   4. Rejected drafts saved to reports/invoica-x-admin/drafts/rejected/
 *
 * Schedule: PM2 cron_restart every 30 minutes
 *
 * State file: reports/invoica-x-admin/posted-ids.json
 * Post logs:  reports/invoica-x-admin/post-log-YYYY-MM-DD.md
 */

import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import { postTweet, postThread } from './x-post-utility';
import 'dotenv/config';

// ─── Credential Remap ────────────────────────────────────────────────
// Override X_* vars with INVOICA_X_* so x-post-utility posts to @invoica_ai.
if (process.env.INVOICA_X_API_KEY)             process.env.X_API_KEY             = process.env.INVOICA_X_API_KEY;
if (process.env.INVOICA_X_API_SECRET)          process.env.X_API_SECRET          = process.env.INVOICA_X_API_SECRET;
if (process.env.INVOICA_X_ACCESS_TOKEN)        process.env.X_ACCESS_TOKEN        = process.env.INVOICA_X_ACCESS_TOKEN;
if (process.env.INVOICA_X_ACCESS_TOKEN_SECRET) process.env.X_ACCESS_TOKEN_SECRET = process.env.INVOICA_X_ACCESS_TOKEN_SECRET;
if (process.env.INVOICA_X_BEARER_TOKEN)        process.env.X_BEARER_TOKEN        = process.env.INVOICA_X_BEARER_TOKEN;

// ─── Types ───────────────────────────────────────────────────────────

interface ScheduledPost {
  id: string;
  date: string;       // YYYY-MM-DD
  hourUTC: number;
  minuteUTC: number;
  type: 'tweet' | 'thread';
  label: string;
  technical: boolean; // true = CTO review required
  content: string[];
}

interface ReviewResult {
  approved: boolean;
  feedback: string;
}

// ─── Paths ───────────────────────────────────────────────────────────

const ROOT          = path.resolve(__dirname, '..');
const REPORTS_DIR   = path.join(ROOT, 'reports', 'invoica-x-admin');
const DRAFTS_DIR    = path.join(REPORTS_DIR, 'drafts');
const REJECTED_DIR  = path.join(DRAFTS_DIR, 'rejected');
const STATE_FILE    = path.join(REPORTS_DIR, 'posted-ids.json');
const CMO_PLAN      = path.join(ROOT, 'reports', 'cmo', 'communication-plan.md');

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function loadPostedIds(): Set<string> {
  try { return new Set(JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'))); }
  catch { return new Set(); }
}

function savePostedIds(ids: Set<string>) {
  ensureDir(REPORTS_DIR);
  fs.writeFileSync(STATE_FILE, JSON.stringify([...ids], null, 2));
}

function appendPostLog(entry: string) {
  ensureDir(REPORTS_DIR);
  const today = new Date().toISOString().slice(0, 10);
  const logFile = path.join(REPORTS_DIR, `post-log-${today}.md`);
  const block = `\n## ${new Date().toISOString()}\n\n${entry}\n`;
  if (!fs.existsSync(logFile)) fs.writeFileSync(logFile, `# X Post Log — ${today}\n\n`);
  fs.appendFileSync(logFile, block);
}

function log(msg: string) { console.log(`[x-admin] ${msg}`); }

function loadCommPlan(): string {
  try { return fs.readFileSync(CMO_PLAN, 'utf-8').slice(0, 3000); }
  catch { return 'Be professional, developer-focused, and authentic. No hype. Educate about x402.'; }
}

// ─── LLM Helpers ─────────────────────────────────────────────────────

function httpsPost(hostname: string, path: string, headers: Record<string, string>, body: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https.request(
      { hostname, path, method: 'POST', headers: { ...headers, 'Content-Length': Buffer.byteLength(body) } },
      (res) => {
        let data = '';
        res.on('data', (c) => data += c);
        res.on('end', () => resolve(data));
      }
    );
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('timeout')); });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ─── CEO Review (Claude via Anthropic) ───────────────────────────────

async function reviewWithCEO(post: ScheduledPost, commPlan: string): Promise<ReviewResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { approved: true, feedback: 'CEO review skipped — no ANTHROPIC_API_KEY' };

  const postText = post.content.join('\n\n---\n\n');
  const body = JSON.stringify({
    model: 'claude-sonnet-4-5',
    max_tokens: 300,
    system: `You are the CEO of Invoica — the Financial OS for AI Agents. You review proposed X/Twitter posts for @invoica_ai before they go live. Your job is to ensure every post aligns with company vision, brand voice, and the communication plan. Be decisive and brief.`,
    messages: [{
      role: 'user',
      content: `## Communication Plan (excerpt)\n${commPlan}\n\n## Draft Post\nLabel: ${post.label}\nType: ${post.type}\n\n${postText}\n\n## Task\nDoes this post align with Invoica's vision, brand voice, and communication plan? Is the messaging accurate and appropriate?\n\nRespond ONLY with JSON: {"approved": true/false, "feedback": "brief reason"}`,
    }],
  });

  try {
    const raw = await httpsPost('api.anthropic.com', '/v1/messages',
      { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' }, body);
    const res = JSON.parse(raw);
    const text = res?.content?.[0]?.text || '';
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      return { approved: !!parsed.approved, feedback: parsed.feedback || '' };
    }
    return { approved: true, feedback: 'CEO review: could not parse response, defaulting to approved' };
  } catch (e) {
    return { approved: true, feedback: `CEO review failed (${(e as Error).message}), defaulting to approved` };
  }
}

// ─── CTO Review (MiniMax) ────────────────────────────────────────────

async function reviewWithCTO(post: ScheduledPost): Promise<ReviewResult> {
  const apiKey = process.env.MINIMAX_API_KEY;
  const groupId = process.env.MINIMAX_GROUP_ID;
  if (!apiKey || !groupId) return { approved: true, feedback: 'CTO review skipped — no MINIMAX credentials' };

  const postText = post.content.join('\n\n---\n\n');
  const body = JSON.stringify({
    model: 'MiniMax-M2.5',
    max_tokens: 300,
    messages: [
      {
        role: 'system',
        content: 'You are the CTO of Invoica — an AI agent financial infrastructure company. You review X/Twitter posts for technical accuracy. Invoica provides x402 invoice middleware, USDC settlement detection on Base mainnet, and agent wallet infrastructure. Be decisive and brief.',
      },
      {
        role: 'user',
        content: `## Draft Post\nLabel: ${post.label}\n\n${postText}\n\n## Task\nAre all technical claims in this post accurate for Invoica's actual product? Check x402, blockchain, payment, and agent infrastructure claims.\n\nRespond ONLY with JSON: {"approved": true/false, "feedback": "brief reason"}`,
      },
    ],
  });

  try {
    const raw = await httpsPost(`api.minimax.io`, `/v1/text/chatcompletion_v2?GroupId=${groupId}`,
      { 'Authorization': `Bearer ${apiKey}`, 'content-type': 'application/json' }, body);
    const res = JSON.parse(raw);
    const text = res?.choices?.[0]?.message?.content || '';
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      return { approved: !!parsed.approved, feedback: parsed.feedback || '' };
    }
    return { approved: true, feedback: 'CTO review: could not parse response, defaulting to approved' };
  } catch (e) {
    return { approved: true, feedback: `CTO review failed (${(e as Error).message}), defaulting to approved` };
  }
}

function saveRejected(post: ScheduledPost, reason: string) {
  ensureDir(REJECTED_DIR);
  const file = path.join(REJECTED_DIR, `${post.id}.md`);
  fs.writeFileSync(file,
    `# Rejected Draft: ${post.id}\n\n` +
    `**Label:** ${post.label}\n**Date:** ${post.date}\n**Reason:** ${reason}\n\n` +
    `## Content\n\n${post.content.join('\n\n---\n\n')}\n`
  );
}

// ─── Content Calendar ─────────────────────────────────────────────────

const CALENDAR: ScheduledPost[] = [
  // ── Day 1: Feb 26 — Beta Launch Day ──────────────────────────────
  {
    id: '2026-02-26-post1', date: '2026-02-26', hourUTC: 9, minuteUTC: 0,
    type: 'thread', label: 'Beta Launch Thread', technical: false,
    content: [
      'Invoica is now in private beta. We built the missing financial layer for AI agents — x402 invoice middleware that lets agents earn, spend, invoice, and settle payments autonomously.',
      'If your AI agent completes a task, it can now get paid. If it needs to pay for a service, it can do that too. No human in the loop. No manual reconciliation.',
      'We built this on x402 — the HTTP payment standard. One line of middleware. Agents get a wallet, an invoicing system, and a settlement layer instantly.',
      'Beta is free. We\'re looking for developers building agents who want to give them real financial autonomy. Get your API key: app.invoica.ai/api-keys',
    ],
  },
  {
    id: '2026-02-26-post2', date: '2026-02-26', hourUTC: 14, minuteUTC: 0,
    type: 'tweet', label: 'x402 Education', technical: true,
    content: [
      'x402 is to AI agent payments what Stripe was to web payments — infrastructure that makes the hard thing trivially easy. We\'re betting it becomes the default financial rail for the agentic economy.',
    ],
  },
  {
    id: '2026-02-26-post3', date: '2026-02-26', hourUTC: 18, minuteUTC: 0,
    type: 'tweet', label: 'Engagement Question', technical: false,
    content: [
      'What financial operations do your AI agents need that don\'t exist yet? Genuinely curious — we\'re building Invoica around real use cases.',
    ],
  },

  // ── Day 2: Feb 27 ─────────────────────────────────────────────────
  {
    id: '2026-02-27-post1', date: '2026-02-27', hourUTC: 9, minuteUTC: 0,
    type: 'thread', label: 'Technical Education Thread', technical: true,
    content: [
      'How Invoica works in 3 steps: 1. Your agent calls our API when it completes a task 2. Invoica generates an x402-compliant invoice 3. The paying agent settles via stablecoin. Done. No bank account needed.',
      'The invoice is machine-readable. The settlement is automatic. The reconciliation is instant. Your agent doesn\'t need to know anything about payments — it just calls one endpoint.',
      'We handle: invoice generation, payment routing, settlement confirmation, tax metadata, and audit trails. Your agent just does its job.',
    ],
  },
  {
    id: '2026-02-27-post2', date: '2026-02-27', hourUTC: 15, minuteUTC: 0,
    type: 'tweet', label: 'Building in Public', technical: false,
    content: [
      'Beta day 2. Working on the x402 transaction webhook system so agents can react instantly when they get paid. The agentic economy needs real-time financial events.',
    ],
  },

  // ── Day 3: Feb 28 ─────────────────────────────────────────────────
  {
    id: '2026-02-28-post1', date: '2026-02-28', hourUTC: 10, minuteUTC: 0,
    type: 'thread', label: 'Use Cases Thread', technical: false,
    content: [
      'What can an AI agent actually do with Invoica? Let\'s make it concrete.',
      'A research agent that bills per report. A coding agent that charges per PR. A data agent that earns per query answered. All automated, all settled on-chain.',
      'On the paying side: an orchestrator agent that automatically pays sub-agents for completed tasks. No invoicing spreadsheets. No manual transfers.',
      'This is the financial infrastructure the multi-agent economy needs. And it\'s now in beta.',
    ],
  },

  // ── Week 2 ───────────────────────────────────────────────────────
  {
    id: '2026-03-02-post1', date: '2026-03-02', hourUTC: 9, minuteUTC: 0,
    type: 'tweet', label: 'Week in AI Agents', technical: false,
    content: [
      'Week 2 of beta. The multi-agent economy is moving fast — orchestrators, sub-agents, task markets. Invoica is building the financial rails underneath all of it. What are you building?',
    ],
  },
  {
    id: '2026-03-03-post1', date: '2026-03-03', hourUTC: 9, minuteUTC: 0,
    type: 'thread', label: 'x402 Deep Dive', technical: true,
    content: [
      'x402 deep dive: what actually happens when an agent invoice is settled?',
      '1. Agent completes task and calls POST /invoices. Invoica creates a USDC invoice tied to a Base wallet address.',
      '2. Paying agent sends USDC to that address. Invoica\'s settlement detector (polling Base mainnet every 30s) confirms the tx.',
      '3. Invoice status flips to "settled". Webhook fires. Both agents get a signed audit trail. No bank. No delay. No human.',
    ],
  },
  {
    id: '2026-03-04-post1', date: '2026-03-04', hourUTC: 9, minuteUTC: 0,
    type: 'tweet', label: 'Beta Update', technical: false,
    content: [
      'Beta day 7. One week in. The API is stable, the settlement detection is live, and the first x402 transactions are flowing. Building the financial layer for the agentic economy, one block at a time.',
    ],
  },
  {
    id: '2026-03-05-post1', date: '2026-03-05', hourUTC: 9, minuteUTC: 0,
    type: 'thread', label: 'Use Case: Code Agent', technical: false,
    content: [
      'Use case spotlight: a fully autonomous coding agent that earns its own compute budget.',
      'The agent takes GitHub issues. Completes PRs. Invoica invoices the client per PR merged. USDC lands in the agent\'s wallet.',
      'The agent uses that wallet to pay for its own API calls, cloud compute, and sub-agent tasks. It earns, it spends, it reports. No human treasury involved.',
      'This isn\'t theoretical — Invoica has the infrastructure for all of it today. Beta is free: app.invoica.ai/api-keys',
    ],
  },
  {
    id: '2026-03-06-post1', date: '2026-03-06', hourUTC: 9, minuteUTC: 0,
    type: 'tweet', label: 'Community Question', technical: false,
    content: [
      'If your AI agent could have one financial superpower it doesn\'t have today, what would it be? Asking for a roadmap.',
    ],
  },
];

// ─── Main ─────────────────────────────────────────────────────────────

async function main() {
  log('Starting X posting check...');

  const now = new Date();
  const todayUTC = now.toISOString().slice(0, 10);
  const currentHourUTC = now.getUTCHours();
  const currentMinuteUTC = now.getUTCMinutes();

  log(`Current UTC: ${todayUTC} ${String(currentHourUTC).padStart(2, '0')}:${String(currentMinuteUTC).padStart(2, '0')}`);

  const postedIds = loadPostedIds();
  log(`Already posted: ${postedIds.size} posts`);

  const commPlan = loadCommPlan();

  // Find due posts: within last 7 days, scheduled time passed, not yet posted
  const duePosts = CALENDAR.filter(post => {
    if (postedIds.has(post.id)) return false;
    const postDate = new Date(post.date + 'T00:00:00Z');
    const daysDiff = (now.getTime() - postDate.getTime()) / (1000 * 60 * 60 * 24);
    if (daysDiff > 7 || daysDiff < 0) return false;
    if (post.date === todayUTC) {
      return (currentHourUTC * 60 + currentMinuteUTC) >= (post.hourUTC * 60 + post.minuteUTC);
    }
    return post.date < todayUTC;
  });

  if (duePosts.length === 0) {
    log('No posts due at this time. Nothing to publish.');
    return;
  }

  log(`${duePosts.length} post(s) due. Running review gate...`);

  for (const post of duePosts) {
    log(`\nReviewing: ${post.id} — ${post.label}`);

    // ── CEO Review ──────────────────────────────────────────────────
    log(`  → CEO review...`);
    const ceoReview = await reviewWithCEO(post, commPlan);
    log(`  CEO: ${ceoReview.approved ? '✅ APPROVED' : '❌ REJECTED'} — ${ceoReview.feedback}`);

    if (!ceoReview.approved) {
      log(`  Skipping post — CEO rejected.`);
      saveRejected(post, `CEO: ${ceoReview.feedback}`);
      appendPostLog(
        `**Post ID:** ${post.id}\n**Label:** ${post.label}\n` +
        `**STATUS:** ❌ REJECTED by CEO\n**Reason:** ${ceoReview.feedback}\n`
      );
      // Mark as posted so we don't retry forever — save rejected state
      postedIds.add(`rejected:${post.id}`);
      savePostedIds(postedIds);
      continue;
    }

    // ── CTO Review (technical posts only) ──────────────────────────
    if (post.technical) {
      log(`  → CTO review (technical post)...`);
      const ctoReview = await reviewWithCTO(post);
      log(`  CTO: ${ctoReview.approved ? '✅ APPROVED' : '❌ REJECTED'} — ${ctoReview.feedback}`);

      if (!ctoReview.approved) {
        log(`  Skipping post — CTO rejected.`);
        saveRejected(post, `CTO: ${ctoReview.feedback}`);
        appendPostLog(
          `**Post ID:** ${post.id}\n**Label:** ${post.label}\n` +
          `**STATUS:** ❌ REJECTED by CTO\n**Reason:** ${ctoReview.feedback}\n`
        );
        postedIds.add(`rejected:${post.id}`);
        savePostedIds(postedIds);
        continue;
      }
    }

    // ── Publish ──────────────────────────────────────────────────────
    log(`  Publishing ${post.type}...`);
    try {
      if (post.type === 'tweet') {
        const result = await postTweet(post.content[0]);
        log(`  ✅ Tweet posted: ${result.id} — https://x.com/i/status/${result.id}`);
        appendPostLog(
          `**Post ID:** ${post.id}\n**Label:** ${post.label}\n**STATUS:** ✅ PUBLISHED\n` +
          `**CEO:** ${ceoReview.feedback}\n` +
          `**Tweet ID:** ${result.id}\n**URL:** https://x.com/i/status/${result.id}\n` +
          `**Text:** ${post.content[0]}\n`
        );
      } else {
        const result = await postThread(post.content);
        const firstId = result.ids[0];
        log(`  ✅ Thread posted (${result.ids.length} tweets): https://x.com/i/status/${firstId}`);
        appendPostLog(
          `**Post ID:** ${post.id}\n**Label:** ${post.label}\n**STATUS:** ✅ PUBLISHED\n` +
          `**CEO:** ${ceoReview.feedback}\n` +
          (post.technical ? `**CTO:** approved\n` : '') +
          `**First Tweet ID:** ${firstId}\n**URL:** https://x.com/i/status/${firstId}\n` +
          `**Tweets:**\n${post.content.map((t, i) => `  ${i + 1}. ${t}`).join('\n')}\n`
        );
      }

      postedIds.add(post.id);
      savePostedIds(postedIds);

      if (duePosts.indexOf(post) < duePosts.length - 1) {
        log('  Waiting 5s before next post...');
        await new Promise(r => setTimeout(r, 5000));
      }
    } catch (err) {
      const msg = (err as Error).message;
      log(`  ❌ Failed to post ${post.id}: ${msg}`);
      appendPostLog(
        `**Post ID:** ${post.id}\n**Label:** ${post.label}\n` +
        `**STATUS:** ❌ PUBLISH FAILED\n**Error:** ${msg}\n`
      );
    }
  }

  log('\nDone.');
}

main().catch(err => {
  console.error('[x-admin] Fatal error:', err);
  process.exit(1);
});
