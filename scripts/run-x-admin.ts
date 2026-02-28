#!/usr/bin/env ts-node

/**
 * run-x-admin.ts — Invoica X/Twitter Autonomous Posting Agent
 *
 * Reads the content calendar, checks which posts are due, and publishes
 * any that haven't been posted yet. Designed to run every 30 minutes via
 * PM2 cron so no scheduled post is ever missed by more than 30 minutes.
 *
 * All times in the calendar are CET (UTC+1 in winter, UTC+2 in summer).
 * This script converts to UTC automatically.
 *
 * State file: reports/invoica-x-admin/posted-ids.json
 * Post logs:  reports/invoica-x-admin/post-log-YYYY-MM-DD.md
 *
 * Schedule: PM2 cron_restart every 30 minutes
 */

import * as fs from 'fs';
import * as path from 'path';
import { postTweet, postThread } from './x-post-utility';
import 'dotenv/config';

// ─── Credential Remap ────────────────────────────────────────────────
// Override X_* vars with INVOICA_X_* so x-post-utility posts to @invoica_ai.
// loadCredentials() in x-post-utility is called lazily (inside postTweet/postThread),
// so setting process.env here before any API call is sufficient.
if (process.env.INVOICA_X_API_KEY)            process.env.X_API_KEY            = process.env.INVOICA_X_API_KEY;
if (process.env.INVOICA_X_API_SECRET)         process.env.X_API_SECRET         = process.env.INVOICA_X_API_SECRET;
if (process.env.INVOICA_X_ACCESS_TOKEN)       process.env.X_ACCESS_TOKEN       = process.env.INVOICA_X_ACCESS_TOKEN;
if (process.env.INVOICA_X_ACCESS_TOKEN_SECRET) process.env.X_ACCESS_TOKEN_SECRET = process.env.INVOICA_X_ACCESS_TOKEN_SECRET;
if (process.env.INVOICA_X_BEARER_TOKEN)       process.env.X_BEARER_TOKEN       = process.env.INVOICA_X_BEARER_TOKEN;

// ─── Types ───────────────────────────────────────────────────────────

interface ScheduledPost {
  id: string;         // unique slug, e.g. "2026-02-28-post1"
  date: string;       // YYYY-MM-DD
  hourUTC: number;    // UTC hour to post at (0–23)
  minuteUTC: number;  // UTC minute (usually 0)
  type: 'tweet' | 'thread';
  label: string;      // human-readable description for logs
  content: string[];  // single tweet → [text], thread → [tweet1, tweet2, ...]
}

// ─── Helpers ─────────────────────────────────────────────────────────

const ROOT = path.resolve(__dirname, '..');
const REPORTS_DIR = path.join(ROOT, 'reports', 'invoica-x-admin');
const STATE_FILE = path.join(REPORTS_DIR, 'posted-ids.json');

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function loadPostedIds(): Set<string> {
  try {
    return new Set(JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8')));
  } catch {
    return new Set();
  }
}

function savePostedIds(ids: Set<string>) {
  ensureDir(REPORTS_DIR);
  fs.writeFileSync(STATE_FILE, JSON.stringify([...ids], null, 2));
}

function appendPostLog(entry: string) {
  ensureDir(REPORTS_DIR);
  const today = new Date().toISOString().slice(0, 10);
  const logFile = path.join(REPORTS_DIR, `post-log-${today}.md`);
  const timestamp = new Date().toISOString();
  const block = `\n## ${timestamp}\n\n${entry}\n`;
  if (!fs.existsSync(logFile)) {
    fs.writeFileSync(logFile, `# X Post Log — ${today}\n\n`);
  }
  fs.appendFileSync(logFile, block);
}

function log(msg: string) {
  console.log(`[x-admin] ${msg}`);
}

// ─── Content Calendar ────────────────────────────────────────────────
// All times are UTC (CET = UTC+1 in winter, so subtract 1 hour).
// Posts are only published if their scheduled time has passed AND they
// haven't been posted before.

const CALENDAR: ScheduledPost[] = [
  // ── Day 1: Feb 26 — Beta Launch Day ──────────────────────────────
  {
    id: '2026-02-26-post1',
    date: '2026-02-26',
    hourUTC: 9, minuteUTC: 0,  // 10:00 CET
    type: 'thread',
    label: 'Beta Launch Thread',
    content: [
      'Invoica is now in private beta. We built the missing financial layer for AI agents — x402 invoice middleware that lets agents earn, spend, invoice, and settle payments autonomously.',
      'If your AI agent completes a task, it can now get paid. If it needs to pay for a service, it can do that too. No human in the loop. No manual reconciliation.',
      'We built this on x402 — the HTTP payment standard. One line of middleware. Agents get a wallet, an invoicing system, and a settlement layer instantly.',
      'Beta is free. We\'re looking for developers building agents who want to give them real financial autonomy. Get your API key: app.invoica.ai/api-keys',
    ],
  },
  {
    id: '2026-02-26-post2',
    date: '2026-02-26',
    hourUTC: 14, minuteUTC: 0,  // 15:00 CET
    type: 'tweet',
    label: 'x402 Education',
    content: [
      'x402 is to AI agent payments what Stripe was to web payments — infrastructure that makes the hard thing trivially easy. We\'re betting it becomes the default financial rail for the agentic economy.',
    ],
  },
  {
    id: '2026-02-26-post3',
    date: '2026-02-26',
    hourUTC: 18, minuteUTC: 0,  // 19:00 CET
    type: 'tweet',
    label: 'Engagement Question',
    content: [
      'What financial operations do your AI agents need that don\'t exist yet? Genuinely curious — we\'re building Invoica around real use cases.',
    ],
  },

  // ── Day 2: Feb 27 — How It Works ─────────────────────────────────
  {
    id: '2026-02-27-post1',
    date: '2026-02-27',
    hourUTC: 9, minuteUTC: 0,  // 10:00 CET
    type: 'thread',
    label: 'Technical Education Thread',
    content: [
      'How Invoica works in 3 steps: 1. Your agent calls our API when it completes a task 2. Invoica generates an x402-compliant invoice 3. The paying agent settles via stablecoin. Done. No bank account needed.',
      'The invoice is machine-readable. The settlement is automatic. The reconciliation is instant. Your agent doesn\'t need to know anything about payments — it just calls one endpoint.',
      'We handle: invoice generation, payment routing, settlement confirmation, tax metadata, and audit trails. Your agent just does its job.',
    ],
  },
  {
    id: '2026-02-27-post2',
    date: '2026-02-27',
    hourUTC: 15, minuteUTC: 0,  // 16:00 CET
    type: 'tweet',
    label: 'Building in Public',
    content: [
      'Beta day 2. Working on the x402 transaction webhook system so agents can react instantly when they get paid. The agentic economy needs real-time financial events.',
    ],
  },

  // ── Day 3: Feb 28 — Use Cases ────────────────────────────────────
  {
    id: '2026-02-28-post1',
    date: '2026-02-28',
    hourUTC: 10, minuteUTC: 0,  // 11:00 CET
    type: 'thread',
    label: 'Use Cases Thread',
    content: [
      'What can an AI agent actually do with Invoica? Let\'s make it concrete.',
      'A research agent that bills per report. A coding agent that charges per PR. A data agent that earns per query answered. All automated, all settled on-chain.',
      'On the paying side: an orchestrator agent that automatically pays sub-agents for completed tasks. No invoicing spreadsheets. No manual transfers.',
      'This is the financial infrastructure the multi-agent economy needs. And it\'s now in beta.',
    ],
  },

  // ── Week 2 onward: Monday Mar 2 ───────────────────────────────────
  {
    id: '2026-03-02-post1',
    date: '2026-03-02',
    hourUTC: 9, minuteUTC: 0,  // 10:00 CET — Monday: Week in AI agents
    type: 'tweet',
    label: 'Week in AI Agents',
    content: [
      'Week 2 of beta. The multi-agent economy is moving fast — orchestrators, sub-agents, task markets. Invoica is building the financial rails underneath all of it. What are you building?',
    ],
  },
  {
    id: '2026-03-03-post1',
    date: '2026-03-03',
    hourUTC: 9, minuteUTC: 0,  // 10:00 CET — Tuesday: x402 deep dive
    type: 'thread',
    label: 'x402 Deep Dive',
    content: [
      'x402 deep dive: what actually happens when an agent invoice is settled?',
      '1. Agent completes task and calls POST /invoices. Invoica creates a USDC invoice tied to a Base wallet address.',
      '2. Paying agent sends USDC to that address. Invoica\'s settlement detector (polling Base mainnet every 30s) confirms the tx.',
      '3. Invoice status flips to "settled". Webhook fires. Both agents get a signed audit trail. No bank. No delay. No human.',
    ],
  },
  {
    id: '2026-03-04-post1',
    date: '2026-03-04',
    hourUTC: 9, minuteUTC: 0,  // 10:00 CET — Wednesday: building in public
    type: 'tweet',
    label: 'Beta Update',
    content: [
      'Beta day 7. One week in. The API is stable, the settlement detection is live, and the first x402 transactions are flowing. Building the financial layer for the agentic economy, one block at a time.',
    ],
  },
  {
    id: '2026-03-05-post1',
    date: '2026-03-05',
    hourUTC: 9, minuteUTC: 0,  // 10:00 CET — Thursday: use case spotlight
    type: 'thread',
    label: 'Use Case: Code Agent',
    content: [
      'Use case spotlight: a fully autonomous coding agent that earns its own compute budget.',
      'The agent takes GitHub issues. Completes PRs. Invoica invoices the client per PR merged. USDC lands in the agent\'s wallet.',
      'The agent uses that wallet to pay for its own API calls, cloud compute, and sub-agent tasks. It earns, it spends, it reports. No human treasury involved.',
      'This isn\'t theoretical — Invoica has the infrastructure for all of it today. Beta is free: app.invoica.ai/api-keys',
    ],
  },
  {
    id: '2026-03-06-post1',
    date: '2026-03-06',
    hourUTC: 9, minuteUTC: 0,  // 10:00 CET — Friday: community engagement
    type: 'tweet',
    label: 'Community Question',
    content: [
      'If your AI agent could have one financial superpower it doesn\'t have today, what would it be? Asking for a roadmap.',
    ],
  },
];

// ─── Main ────────────────────────────────────────────────────────────

async function main() {
  log('Starting X posting check...');

  const now = new Date();
  const todayUTC = now.toISOString().slice(0, 10); // YYYY-MM-DD
  const currentHourUTC = now.getUTCHours();
  const currentMinuteUTC = now.getUTCMinutes();

  log(`Current UTC: ${todayUTC} ${String(currentHourUTC).padStart(2, '0')}:${String(currentMinuteUTC).padStart(2, '0')}`);

  const postedIds = loadPostedIds();
  log(`Already posted: ${postedIds.size} posts`);

  // Find all posts that are due: date <= today AND time has passed AND not yet posted
  const duePosts = CALENDAR.filter(post => {
    if (post.id && postedIds.has(post.id)) return false; // already posted

    // Allow catch-up: post anything from the last 7 days that was missed
    const postDate = new Date(post.date + 'T00:00:00Z');
    const daysDiff = (now.getTime() - postDate.getTime()) / (1000 * 60 * 60 * 24);
    if (daysDiff > 7 || daysDiff < 0) return false; // too old or future

    // If it's today, check the hour:minute
    if (post.date === todayUTC) {
      const postMinuteTotal = post.hourUTC * 60 + post.minuteUTC;
      const nowMinuteTotal = currentHourUTC * 60 + currentMinuteUTC;
      return nowMinuteTotal >= postMinuteTotal;
    }

    // Past days — catch up unconditionally
    return post.date < todayUTC;
  });

  if (duePosts.length === 0) {
    log('No posts due at this time. Nothing to publish.');
    return;
  }

  log(`${duePosts.length} post(s) to publish.`);

  for (const post of duePosts) {
    log(`Publishing: ${post.id} — ${post.label}`);
    try {
      if (post.type === 'tweet') {
        const result = await postTweet(post.content[0]);
        log(`✅ Tweet posted: ${result.id} — https://x.com/i/status/${result.id}`);
        appendPostLog(
          `**Post ID:** ${post.id}\n` +
          `**Label:** ${post.label}\n` +
          `**Type:** tweet\n` +
          `**Tweet ID:** ${result.id}\n` +
          `**URL:** https://x.com/i/status/${result.id}\n` +
          `**Text:** ${post.content[0]}\n`
        );
      } else {
        const result = await postThread(post.content);
        const firstId = result.ids[0];
        log(`✅ Thread posted (${result.ids.length} tweets): ${firstId} — https://x.com/i/status/${firstId}`);
        appendPostLog(
          `**Post ID:** ${post.id}\n` +
          `**Label:** ${post.label}\n` +
          `**Type:** thread (${result.ids.length} tweets)\n` +
          `**First Tweet ID:** ${firstId}\n` +
          `**URL:** https://x.com/i/status/${firstId}\n` +
          `**Tweets:**\n${post.content.map((t, i) => `  ${i + 1}. ${t}`).join('\n')}\n`
        );
      }

      postedIds.add(post.id);
      savePostedIds(postedIds);

      // Pause between posts to avoid rate limits
      if (duePosts.indexOf(post) < duePosts.length - 1) {
        log('Waiting 5s before next post...');
        await new Promise(r => setTimeout(r, 5000));
      }
    } catch (err) {
      const msg = (err as Error).message;
      log(`❌ Failed to post ${post.id}: ${msg}`);
      appendPostLog(
        `**Post ID:** ${post.id}\n` +
        `**Label:** ${post.label}\n` +
        `**FAILED:** ${msg}\n`
      );
      // Continue to next post — don't mark as posted so it retries next run
    }
  }

  log('Done.');
}

main().catch(err => {
  console.error('[x-admin] Fatal error:', err);
  process.exit(1);
});
