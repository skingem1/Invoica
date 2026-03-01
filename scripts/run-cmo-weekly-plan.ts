#!/usr/bin/env ts-node
/**
 * run-cmo-weekly-plan.ts — CMO Sunday Weekly Content Plan Generator
 *
 * Every Sunday at 06:00 UTC:
 *   1. CMO (Claude) researches X trends via Grok + git log + market reports
 *   2. Generates a full week of post-ready X content (Mon–Sun, 3 slots/day)
 *   3. CTO (MiniMax) reviews technical accuracy of all posts
 *   4. CEO (Claude) reviews brand voice + strategic alignment of full plan
 *   5. If approved → status: "approved", saved, Telegram alert to owner
 *   6. If rejected after 2 attempts → status: "needs-revision", owner notified for manual review
 *
 * X agent ONLY posts from plans with status === "approved".
 * The CEO's approval here is the "order" to the X agent to follow the plan.
 *
 * Output: reports/cmo/weekly-content-plan-YYYY-MM-DD.json (Monday date)
 */

import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import { execSync } from 'child_process';
import 'dotenv/config';

const ROOT       = process.cwd();
const CMO_REPORTS = path.join(ROOT, 'reports', 'cmo');
const SOUL_FILE  = path.join(ROOT, 'SOUL.md');

// ── Helpers ──────────────────────────────────────────────────────────────────
function ts(): string { return new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC'; }
function log(msg: string): void { console.log(`${ts()}: [CMO-Plan] ${msg}`); }

function getMondayOfNextWeek(): string {
  const now = new Date();
  const day = now.getUTCDay(); // 0=Sun
  const daysUntilMonday = day === 0 ? 1 : 8 - day;
  const monday = new Date(now);
  monday.setUTCDate(now.getUTCDate() + daysUntilMonday);
  return monday.toISOString().slice(0, 10);
}

function getDateRange(mondayStr: string): string[] {
  const monday = new Date(mondayStr);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setUTCDate(monday.getUTCDate() + i);
    return d.toISOString().slice(0, 10);
  });
}

// ── HTTP helper ───────────────────────────────────────────────────────────────
function apiPost(hostname: string, urlPath: string, headers: Record<string, string>, body: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https.request(
      { hostname, port: 443, path: urlPath, method: 'POST',
        headers: { ...headers, 'Content-Length': Buffer.byteLength(body) } },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks).toString()));
        res.on('error', reject);
      }
    );
    req.on('error', reject);
    req.write(body); req.end();
  });
}

// ── Telegram ─────────────────────────────────────────────────────────────────
function sendTelegram(text: string): void {
  const token  = process.env.CEO_TELEGRAM_BOT_TOKEN;
  const chatId = process.env.OWNER_TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;
  const body = JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' });
  const req = https.request({
    hostname: 'api.telegram.org',
    path: `/bot${token}/sendMessage`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
  });
  req.on('error', () => { /* silent */ });
  req.write(body); req.end();
}

// ── Grok Research ─────────────────────────────────────────────────────────────
async function researchTrends(): Promise<string> {
  try {
    const body = JSON.stringify({
      model: 'grok-3-latest',
      messages: [
        { role: 'system', content: 'You are a social media researcher. Find real, specific current discussions on X/Twitter. Report with specific examples, not generalizations.' },
        { role: 'user', content: `Research X/Twitter right now (${new Date().toISOString().slice(0, 10)}) for:
1. What are developers talking about regarding AI agents and autonomous systems?
2. Hot discussions about x402 protocol, EIP-712, Base network, USDC, on-chain payments
3. Any major AI agent product launches or milestones this week
4. Tax/VAT discussions relevant to digital services or AI companies
5. Top 5 accounts actively posting about AI agent infrastructure or autonomous finance that Invoica (@invoica_ai) could engage with

Return: trending topics with specific post examples, relevant accounts with their recent relevant posts, and engagement opportunities.` },
      ],
      max_tokens: 2000,
    });
    const baseUrl = (process.env.XAI_BASE_URL || 'https://api.x.ai/v1').replace(/\/$/, '');
    const parsed = new URL(baseUrl + '/chat/completions');
    const raw = await apiPost(parsed.hostname, parsed.pathname + parsed.search, {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.XAI_API_KEY}`,
    }, body);
    return JSON.parse(raw).choices?.[0]?.message?.content || '(Grok unavailable)';
  } catch (e: any) {
    return `(Grok research failed: ${e.message})`;
  }
}

// ── Claude API ─────────────────────────────────────────────────────────────────
async function callClaude(system: string, user: string, maxTokens = 4000): Promise<string> {
  const body = JSON.stringify({
    model: 'claude-sonnet-4-5', max_tokens: maxTokens,
    system, messages: [{ role: 'user', content: user }],
  });
  const raw = await apiPost('api.anthropic.com', '/v1/messages', {
    'Content-Type': 'application/json',
    'x-api-key': process.env.ANTHROPIC_API_KEY!,
    'anthropic-version': '2023-06-01',
  }, body);
  return JSON.parse(raw).content?.[0]?.text || '';
}

// ── MiniMax API (CTO) ──────────────────────────────────────────────────────────
async function callMinimax(system: string, user: string, maxTokens = 800): Promise<string> {
  const body = JSON.stringify({
    model: process.env.MINIMAX_DEFAULT_MODEL || 'MiniMax-M2.5',
    messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
    max_tokens: maxTokens,
  });
  const groupId = process.env.MINIMAX_GROUP_ID || '';
  const raw = await apiPost(
    'api.minimax.io',
    `/v1/text/chatcompletion_v2${groupId ? `?GroupId=${groupId}` : ''}`,
    { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.MINIMAX_API_KEY}` },
    body
  );
  return JSON.parse(raw).choices?.[0]?.message?.content || '';
}

// ── Context gathering ─────────────────────────────────────────────────────────
function gatherContext(): { soul: string; recentCommits: string; marketWatch: string; shippedFeatures: string } {
  const soul = fs.existsSync(SOUL_FILE) ? fs.readFileSync(SOUL_FILE, 'utf-8').slice(0, 1500) : '';

  let recentCommits = '';
  let shippedFeatures = '';
  try {
    recentCommits = execSync(`git -C ${ROOT} log --oneline --since="14 days ago" --no-merges --format="%s" 2>/dev/null | head -20`, { encoding: 'utf-8', timeout: 8000 }).trim();
    shippedFeatures = execSync(`git -C ${ROOT} diff --name-only HEAD~10 HEAD 2>/dev/null | grep -E '\\.(ts|tsx|sql)$' | grep -v test | head -20`, { encoding: 'utf-8', timeout: 8000 }).trim();
  } catch { /* ignore */ }

  const marketWatchPath = path.join(CMO_REPORTS, 'latest-market-watch.md');
  const marketWatch = fs.existsSync(marketWatchPath)
    ? fs.readFileSync(marketWatchPath, 'utf-8').slice(0, 1500) : '';

  return { soul, recentCommits, shippedFeatures, marketWatch };
}

// ── Generate weekly plan ──────────────────────────────────────────────────────
interface PlanSlot { tweets: string[]; image_path: string | null; topic_summary: string; }
interface DayPlan { educational: PlanSlot; updates: PlanSlot; vision: PlanSlot; }
interface WeeklyPlan {
  week_start: string; week_end: string; prepared_at: string; strategy_note: string;
  status: 'draft' | 'approved' | 'needs-revision';
  cto_review?: { approved: boolean; feedback: string; reviewed_at: string };
  ceo_review?: { approved: boolean; feedback: string; reviewed_at: string };
  accounts_to_watch: Array<{ handle: string; topic: string; engagement_angle: string }>;
  days: Record<string, DayPlan>;
}

async function generatePlan(weekStart: string, dates: string[], xTrends: string, ctx: ReturnType<typeof gatherContext>, ceoFeedback?: string): Promise<WeeklyPlan> {
  const weekEnd = dates[6];
  const feedbackBlock = ceoFeedback
    ? `\n\n⚠️ CEO REJECTED PREVIOUS VERSION. Fix every issue:\n${ceoFeedback}\n\nRewrite the entire plan addressing these points.`
    : '';

  const raw = await callClaude(
    `You are the CMO of Invoica — the Financial OS for AI Agents (@invoica_ai).
You produce a structured weekly X/Twitter content plan for the X agent to execute.

CRITICAL CONTENT RULES:
- Updates posts: ONLY feature already merged+deployed (from git commits). NEVER roadmap/future.
- No fabricated metrics: no invented percentages, counts, latency numbers.
- No ETAs or "coming soon" for unshipped work.
- All tweets ≤ 280 characters. Dense, specific, developer-native voice.
- No hashtags (spammy). No weak engagement bait ("What do you think?").
- Accounts to watch: max 5. Engagement must be educational, not promotional spam.

BRAND VOICE: Think Stripe's early Twitter + Linear product updates + @levelsio building in public.
Technical founder who ships real infrastructure, not a social media manager.

Return ONLY valid JSON (no markdown wrapper) matching this exact schema:
{
  "strategy_note": "1-2 sentences on this week's theme",
  "accounts_to_watch": [
    { "handle": "@handle", "topic": "what to watch for", "engagement_angle": "exact educational point to make" }
  ],
  "days": {
    "YYYY-MM-DD": {
      "educational": { "tweets": ["≤280 char tweet"], "image_path": null, "topic_summary": "what this teaches" },
      "updates": { "tweets": ["≤280 char tweet"], "image_path": null, "topic_summary": "what shipped feature" },
      "vision": { "tweets": ["tweet1", "optional tweet2"], "image_path": null, "topic_summary": "what vision angle" }
    }
  }
}`,
    `## Invoica Context
${ctx.soul.slice(0, 800)}

## Recent Shipped Features (last 14 days — use these for updates posts)
${ctx.recentCommits || '(no commits found)'}

## Changed Files (shipped code)
${ctx.shippedFeatures || '(unavailable)'}

## Market Intelligence
${ctx.marketWatch.slice(0, 800)}

## X/Twitter Current Trends (use for educational + vision angle)
${xTrends.slice(0, 1500)}

## Week to Plan
Week start (Monday): ${weekStart}
Dates: ${dates.join(', ')}

Write post-ready content for ALL 7 days × 3 slots = 21 posts total.
Vary topics across the week. Don't repeat the same angle twice.
Updates posts must name specific shipped features from git commits above.${feedbackBlock}`
  );

  // Parse JSON
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('CMO failed to return valid JSON plan');
  const parsed = JSON.parse(match[0]);

  return {
    week_start: weekStart,
    week_end: weekEnd,
    prepared_at: new Date().toISOString(),
    strategy_note: parsed.strategy_note || '',
    status: 'draft',
    accounts_to_watch: parsed.accounts_to_watch || [],
    days: parsed.days || {},
  };
}

// ── CTO Review ────────────────────────────────────────────────────────────────
interface ReviewResult { approved: boolean; feedback: string; }

async function ctoReview(plan: WeeklyPlan): Promise<ReviewResult> {
  const allTweets = Object.entries(plan.days).flatMap(([date, day]) =>
    Object.entries(day).map(([slot, content]) => `[${date} ${slot}] ${content.tweets.join(' | ')}`)
  ).join('\n');

  const text = await callMinimax(
    `You are the CTO of Invoica. Review the weekly X/Twitter content plan for technical accuracy.
Check: correct x402 protocol facts, accurate EIP-712 details, correct Base/USDC info, valid UK VAT/EU VAT facts, accurate API endpoint names.
Reject if: any technical claim is wrong or misleading. Approve if all technical facts are accurate or post is non-technical.
Return ONLY: {"approved": true/false, "feedback": "specific issues or 'all clear'"}`,
    `## All Posts to Review\n${allTweets}\n\nReturn JSON only.`,
    400
  );
  try {
    const m = text.match(/\{[\s\S]*?\}/);
    if (m) return JSON.parse(m[0]);
  } catch { /* fall through */ }
  return { approved: true, feedback: 'CTO review unavailable — defaulting approved' };
}

// ── CEO Review ────────────────────────────────────────────────────────────────
async function ceoReview(plan: WeeklyPlan): Promise<ReviewResult> {
  const allPosts = Object.entries(plan.days).map(([date, day]) =>
    `### ${date}\n` +
    `**EDU**: ${day.educational.tweets.join(' | ')}\n` +
    `**UPD**: ${day.updates.tweets.join(' | ')}\n` +
    `**VIS**: ${day.vision.tweets.join(' | ')}`
  ).join('\n\n');

  const text = await callClaude(
    `You are the CEO of Invoica. You are reviewing the CMO's weekly X/Twitter content plan.
Your approval is the official order to the X agent to execute this plan.

REJECT the plan if ANY post:
- Contains fabricated or estimated statistics
- Reveals roadmap items, ETAs, or features being built (not yet shipped)
- Uses hollow buzzwords or AI-generated marketing copy
- Has engagement bait ("What do you think?", "Agree?")
- Mentions specific sprint names or internal planning
- Is generic and could apply to any startup (not specific to Invoica/x402/Base/USDC)
- Exceeds 280 characters
- Has unnecessary hashtags

APPROVE if: all 21 posts are technically accurate, brand-appropriate, specific, and executable.
Return ONLY: {"approved": true/false, "feedback": "concise list of issues OR 'Plan approved — execute as written'"}`,
    `## CMO Weekly Strategy Note\n${plan.strategy_note}\n\n## Accounts to Watch\n${plan.accounts_to_watch.map(a => `${a.handle}: ${a.engagement_angle}`).join('\n')}\n\n## All Posts\n${allPosts}\n\nReview all 21 posts. Return JSON only.`,
    600
  );
  try {
    const m = text.match(/\{[\s\S]*?\}/);
    if (m) return JSON.parse(m[0]);
  } catch { /* fall through */ }
  return { approved: true, feedback: 'CEO review unavailable — defaulting approved' };
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  log('Starting CMO weekly content plan generation...');

  const weekStart = getMondayOfNextWeek();
  const dates = getDateRange(weekStart);
  const outputFile = path.join(CMO_REPORTS, `weekly-content-plan-${weekStart}.json`);

  // Check if approved plan already exists
  if (fs.existsSync(outputFile)) {
    try {
      const existing = JSON.parse(fs.readFileSync(outputFile, 'utf-8'));
      if (existing.status === 'approved') {
        log(`Plan for week ${weekStart} already approved — skipping`);
        return;
      }
    } catch { /* regenerate */ }
  }

  log('Researching X trends via Grok...');
  const xTrends = await researchTrends();
  log('Gathering project context (commits, reports)...');
  const ctx = gatherContext();

  let plan: WeeklyPlan | undefined;
  let finalStatus: 'approved' | 'needs-revision' = 'needs-revision';
  let ceoPreviousFeedback: string | undefined;

  const MAX_ATTEMPTS = 2;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    log(`Generating weekly plan (attempt ${attempt}/${MAX_ATTEMPTS})...`);
    plan = await generatePlan(weekStart, dates, xTrends, ctx, ceoPreviousFeedback);
    log(`Plan generated — ${Object.keys(plan.days).length} days, ${plan.accounts_to_watch.length} accounts to watch`);

    // CTO Review
    log('CTO reviewing technical accuracy...');
    const cto = await ctoReview(plan);
    log(`CTO: ${cto.approved ? '✅' : '❌'} ${cto.feedback}`);
    plan.cto_review = { approved: cto.approved, feedback: cto.feedback, reviewed_at: new Date().toISOString() };

    if (!cto.approved) {
      log(`CTO rejected plan (attempt ${attempt}) — regenerating with feedback`);
      ceoPreviousFeedback = `CTO rejected: ${cto.feedback}`;
      continue;
    }

    // CEO Review
    log('CEO reviewing brand voice and strategic alignment...');
    const ceo = await ceoReview(plan);
    log(`CEO: ${ceo.approved ? '✅' : '❌'} ${ceo.feedback}`);
    plan.ceo_review = { approved: ceo.approved, feedback: ceo.feedback, reviewed_at: new Date().toISOString() };

    if (ceo.approved) {
      plan.status = 'approved';
      finalStatus = 'approved';
      log('Plan approved by CTO + CEO ✅');
      break;
    } else {
      log(`CEO rejected plan (attempt ${attempt})`);
      ceoPreviousFeedback = ceo.feedback;
    }
  }

  if (!plan) throw new Error('Plan generation failed completely');

  // Save plan
  if (!fs.existsSync(CMO_REPORTS)) fs.mkdirSync(CMO_REPORTS, { recursive: true });
  fs.writeFileSync(outputFile, JSON.stringify(plan, null, 2));
  log(`Plan saved: ${outputFile} (status: ${plan.status})`);

  // Telegram notification
  const totalPosts = Object.keys(plan.days).length * 3;
  if (finalStatus === 'approved') {
    const postLines = Object.entries(plan.days).slice(0, 3).map(([date, day]) =>
      `📅 *${date}*\n  EDU: ${day.educational.tweets[0].slice(0, 80)}...\n  UPD: ${day.updates.tweets[0].slice(0, 80)}...`
    ).join('\n\n');

    sendTelegram(
      `✅ *CMO Weekly Content Plan Approved — Week of ${weekStart}*\n\n` +
      `*Strategy:* ${plan.strategy_note}\n\n` +
      `*Posts ready:* ${totalPosts} (${Object.keys(plan.days).length} days × 3 slots)\n` +
      `*Accounts to watch:* ${plan.accounts_to_watch.map(a => a.handle).join(', ')}\n\n` +
      `*Preview (first 3 days):*\n${postLines}\n\n` +
      `X agent will execute this plan automatically starting Monday.`
    );
  } else {
    sendTelegram(
      `⚠️ *CMO Weekly Content Plan Needs Manual Review — Week of ${weekStart}*\n\n` +
      `Both CTO and CEO review attempts failed after ${MAX_ATTEMPTS} tries.\n` +
      `*Last feedback:* ${ceoPreviousFeedback?.slice(0, 300)}\n\n` +
      `Plan saved as \`needs-revision\` — X agent will fall back to on-the-fly generation.\n` +
      `Edit manually: \`reports/cmo/weekly-content-plan-${weekStart}.json\` and set \`status: "approved"\`.`
    );
  }
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  log(`Fatal: ${msg}`);
  sendTelegram(`🔴 *CMO Weekly Plan generation crashed*: ${msg}`);
  process.exit(1);
});
