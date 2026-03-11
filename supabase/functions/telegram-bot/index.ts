/**
 * Telegram Support Bot — Invoica Edge Function
 *
 * Handles incoming Telegram webhook updates.
 * Provides FAQ responses, onboarding guidance, technical support,
 * and escalation for the Invoica platform.
 *
 * Conway Governance: Law I (Never Harm), Law II (Create Value), Law III (Transparency)
 *
 * @version 1.0.0
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

// ─── Types ───────────────────────────────────────────────────────────

interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: CallbackQuery;
}

interface TelegramMessage {
  message_id: number;
  from: TelegramUser;
  chat: TelegramChat;
  date: number;
  text?: string;
  entities?: MessageEntity[];
}

interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
}

interface TelegramChat {
  id: number;
  type: string;
  title?: string;
  first_name?: string;
  last_name?: string;
  username?: string;
}

interface CallbackQuery {
  id: string;
  from: TelegramUser;
  message?: TelegramMessage;
  data?: string;
}

interface MessageEntity {
  type: string;
  offset: number;
  length: number;
}

// ─── Configuration ───────────────────────────────────────────────────

const TELEGRAM_API = "https://api.telegram.org/bot";
const DOCS_URL = "https://invoica.mintlify.app";
const DASHBOARD_URL = "https://invoica-b89o.vercel.app";
const WEBSITE_URL = "https://invoica-rho.vercel.app";

const BETA_START = new Date("2026-02-23");
const BETA_END_MONTH_1 = new Date("2026-03-23");
const BETA_END = new Date("2026-04-23");

// ─── Helpers ─────────────────────────────────────────────────────────

function getBotToken(): string {
  const token = Deno.env.get("TELEGRAM_BOT_TOKEN");
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN not set");
  return token;
}

function getSupabaseClient() {
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  return createClient(url, key);
}

async function sendMessage(
  chatId: number,
  text: string,
  options: {
    parse_mode?: string;
    reply_markup?: unknown;
    reply_to_message_id?: number;
  } = {}
): Promise<void> {
  const token = getBotToken();
  const body: Record<string, unknown> = {
    chat_id: chatId,
    text,
    parse_mode: options.parse_mode ?? "Markdown",
    ...options,
  };

  await fetch(`${TELEGRAM_API}${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function answerCallbackQuery(callbackQueryId: string, text?: string): Promise<void> {
  const token = getBotToken();
  await fetch(`${TELEGRAM_API}${token}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      callback_query_id: callbackQueryId,
      text: text ?? "✓",
    }),
  });
}

function getBetaInfo(): { dayNumber: number; phase: string; discountInfo: string } {
  const now = new Date();
  const diffMs = now.getTime() - BETA_START.getTime();
  const dayNumber = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));

  let phase = "pre_launch";
  let discountInfo = "";

  if (dayNumber <= 0) {
    phase = "pre_launch";
    discountInfo = "Beta hasn't started yet! Launch is February 23, 2026.";
  } else if (dayNumber <= 30) {
    phase = "beta_month_1";
    discountInfo = `🏅 *Founding Agent Month!* Sign up now to get *20% off for 24 months*. Only ${30 - dayNumber} days left for this tier!`;
  } else if (dayNumber <= 60) {
    phase = "beta_month_2";
    discountInfo = `⭐ *Early Adopter Month!* Sign up now to get *10% off for 24 months*. Only ${60 - dayNumber} days left!`;
  } else {
    phase = "live";
    discountInfo = "Beta period has ended. Standard pricing applies.";
  }

  return { dayNumber, phase, discountInfo };
}

async function logEscalation(
  supabase: ReturnType<typeof createClient>,
  userId: number,
  username: string | undefined,
  issue: string,
  attempted: string,
  reason: string
): Promise<void> {
  try {
    await supabase.from("support_escalations").insert({
      telegram_user_id: userId,
      telegram_username: username ?? "unknown",
      issue_summary: issue,
      attempted_resolution: attempted,
      escalation_reason: reason,
      status: "open",
      created_at: new Date().toISOString(),
    });
  } catch {
    // Table might not exist yet — silently fail
    console.log(`[Escalation] User ${userId}: ${issue} — ${reason}`);
  }
}

async function logFeedback(
  supabase: ReturnType<typeof createClient>,
  userId: number,
  username: string | undefined,
  feedback: string,
  category: string
): Promise<void> {
  try {
    await supabase.from("support_feedback").insert({
      telegram_user_id: userId,
      telegram_username: username ?? "unknown",
      feedback_text: feedback,
      category,
      created_at: new Date().toISOString(),
    });
  } catch {
    console.log(`[Feedback] User ${userId} (${category}): ${feedback}`);
  }
}

// ─── Command Handlers ────────────────────────────────────────────────

function handleStart(chatId: number, firstName: string): Promise<void> {
  const { discountInfo } = getBetaInfo();
  const text = `👋 Welcome to *Invoica Support*, ${firstName}!

Invoica is the *Financial OS for AI Agents* — invoice middleware with x402 protocol support, tax compliance across 12 countries, and agent-to-agent payments.

${discountInfo}

*Quick commands:*
/help — See all commands
/pricing — View plans & pricing
/beta — Beta program details
/docs — Documentation links
/status — System status
/getstarted — Onboarding guide
/feedback — Share feedback

Or just ask me a question! I'm here 24/7. 🤖`;

  return sendMessage(chatId, text);
}

function handleHelp(chatId: number): Promise<void> {
  const text = `📚 *Invoica Support Commands*

*Getting Started:*
/getstarted — Step-by-step onboarding
/docs — Documentation & API reference

*Product Info:*
/pricing — Plans & pricing details
/beta — Beta program & discounts
/features — Platform features overview
/countries — Supported countries

*Technical:*
/api — API quickstart guide
/errors — Common error codes & fixes
/webhooks — Webhook setup guide
/sdk — TypeScript SDK info

*Other:*
/status — System & API status
/feedback — Submit feedback or feature request
/escalate — Request human support

You can also ask me questions in plain text! 💬`;

  return sendMessage(chatId, text);
}

function handlePricing(chatId: number): Promise<void> {
  const { discountInfo } = getBetaInfo();
  const text = `💰 *Invoica Pricing*

*Free Tier* — $0/month
• 100 invoices/month
• 1 API key
• Basic tax calculation
• Community support

*Growth (Web3)* — $24/month
• 1,000 invoices/month
• 5 API keys
• x402 protocol access
• Settlement detection
• Priority support

*Pro (Company)* — $49/month
• 10,000 invoices/month
• Unlimited API keys
• Full tax compliance (12 countries)
• Custom webhooks
• Dedicated support

*Enterprise* — Custom
• Unlimited everything
• SLA guarantee
• Custom integrations
• On-call support

---
${discountInfo}

🔗 [View full pricing](${WEBSITE_URL})
📊 [Go to Dashboard](${DASHBOARD_URL})`;

  return sendMessage(chatId, text);
}

function handleBeta(chatId: number): Promise<void> {
  const { dayNumber, phase, discountInfo } = getBetaInfo();
  const text = `🚀 *Invoica Beta Program*

📅 *Beta Period:* February 23 — April 22, 2026 (60 days)
📍 *Current:* Day ${dayNumber} (${phase.replace("_", " ")})

*How it works:*
• All features are *completely free* during beta
• No billing until Day 61 (April 23, 2026)
• Your usage during beta builds your reputation score

*Discount Tiers:*
🏅 *Founding Agent* (Month 1, Feb 23 - Mar 22)
→ Sign up and get *20% off for 24 months*

⭐ *Early Adopter* (Month 2, Mar 23 - Apr 22)
→ Sign up and get *10% off for 24 months*

*Important:* Discounts lock at your *signup date*, not payment date!

---
${discountInfo}

🔗 [Sign up now](${DASHBOARD_URL})
📖 [Read the docs](${DOCS_URL})`;

  return sendMessage(chatId, text);
}

function handleGetStarted(chatId: number): Promise<void> {
  const text = `🎯 *Getting Started with Invoica*

*Step 1: Create Account*
Go to [dashboard](${DASHBOARD_URL}) and sign up with email or GitHub.

*Step 2: Set Up Company Profile*
Choose your profile type:
• *Registered Company* — for traditional businesses with tax IDs
• *Web3 Project* — for DAOs, protocols, and agent networks

*Step 3: Get Your API Key*
Navigate to Settings → API Keys → Create New Key.
Save your key securely — it won't be shown again!

*Step 4: Make Your First API Call*
\`\`\`bash
curl -X POST ${DOCS_URL}/api/v1/invoices \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"amount": 100, "currency": "USD"}'
\`\`\`

*Step 5: Set Up Webhooks (Optional)*
Configure webhook endpoints to receive real-time invoice events.

📖 [Full documentation](${DOCS_URL})
💬 Need help? Just ask me!`;

  return sendMessage(chatId, text);
}

function handleFeatures(chatId: number): Promise<void> {
  const text = `⚡ *Invoica Features*

*Core Platform:*
📄 Invoice creation & management
💱 Multi-currency support
🧾 Tax calculation & compliance (12 countries)
📊 Financial ledger & reporting
🔗 Webhook event notifications

*x402 Protocol:*
🤖 Agent-to-agent payments
💸 HTTP 402 payment-required middleware
⚡ Automatic settlement detection
🔐 Cryptographic invoice verification

*API Features:*
🔑 API key management
📈 Rate limiting by tier
🏢 Company verification (VIES, Companies House, etc.)
📋 Trial balance & financial reporting
💳 Stripe billing integration

*Coming Soon:*
⛽ Gas backstop for agent transactions
🔥 SOL incinerator for deflationary mechanics
⭐ Reputation scoring API
🏪 Agent marketplace

📖 [View all features](${DOCS_URL})`;

  return sendMessage(chatId, text);
}

function handleCountries(chatId: number): Promise<void> {
  const text = `🌍 *Supported Countries for Tax Compliance*

🇺🇸 United States
🇬🇧 United Kingdom
🇩🇪 Germany
🇫🇷 France
🇳🇱 Netherlands
🇮🇪 Ireland
🇨🇦 Canada
🇦🇺 Australia
🇯🇵 Japan
🇸🇬 Singapore
🇮🇱 Israel
🇧🇷 Brazil

*What's included:*
• Automatic tax rate calculation
• Country-specific tax rules (VAT, GST, Sales Tax)
• Company verification where available
• Invoice formatting per local requirements

📖 [Tax documentation](${DOCS_URL}/tax-compliance)`;

  return sendMessage(chatId, text);
}

function handleApiGuide(chatId: number): Promise<void> {
  const text = `🔧 *API Quickstart*

*Base URL:*
\`https://igspopoejhsxvwvxyhbh.supabase.co/functions/v1/api\`

*Authentication:*
All requests require a Bearer token:
\`Authorization: Bearer YOUR_API_KEY\`

*Key Endpoints:*
• \`GET /v1/health\` — API health check
• \`POST /v1/invoices\` — Create invoice
• \`GET /v1/invoices\` — List invoices
• \`POST /v1/tax/calculate\` — Calculate tax
• \`GET /v1/dashboard/stats\` — Get dashboard stats
• \`GET /v1/ledger\` — View ledger entries

*Example — Create Invoice:*
\`\`\`json
POST /v1/invoices
{
  "client_name": "Acme AI",
  "amount": 500.00,
  "currency": "USD",
  "description": "API integration services"
}
\`\`\`

*Rate Limits:*
• Free: 100 req/hour
• Growth: 1,000 req/hour
• Pro: 10,000 req/hour

📖 [Full API reference](${DOCS_URL}/api-reference)`;

  return sendMessage(chatId, text);
}

function handleErrors(chatId: number): Promise<void> {
  const text = `🔴 *Common Error Codes & Fixes*

*401 — Unauthorized*
→ Invalid or missing API key
→ Fix: Check your \`Authorization: Bearer\` header
→ Regenerate key in Dashboard → Settings → API Keys

*403 — Forbidden*
→ Your plan doesn't include this feature
→ Fix: Upgrade your plan or check feature availability

*404 — Not Found*
→ Invalid endpoint or resource ID
→ Fix: Check the URL path and resource ID

*429 — Rate Limited*
→ Too many requests for your tier
→ Fix: Implement exponential backoff
→ Or upgrade your plan for higher limits

*500 — Internal Server Error*
→ Something went wrong on our end
→ Fix: Retry after a few seconds
→ If persistent, use /escalate to report it

*Debugging Tips:*
• Always check the response body for error details
• Use \`/v1/health\` to verify API is operational
• Check [status page](${WEBSITE_URL}) for outages

📖 [Error reference](${DOCS_URL}/errors)`;

  return sendMessage(chatId, text);
}

function handleWebhooks(chatId: number): Promise<void> {
  const text = `🔔 *Webhook Setup Guide*

*What are webhooks?*
Real-time notifications when events happen on your account (invoice created, payment received, etc.)

*Setup:*
1. Go to Dashboard → Settings → Webhooks
2. Add your endpoint URL
3. Select event types to subscribe to
4. Save and test

*Event Types:*
• \`invoice.created\` — New invoice created
• \`invoice.paid\` — Invoice payment confirmed
• \`invoice.overdue\` — Invoice past due date
• \`payment.received\` — Payment settlement detected
• \`payment.failed\` — Payment attempt failed

*Payload Format:*
\`\`\`json
{
  "event": "invoice.paid",
  "data": { "invoice_id": "...", ... },
  "timestamp": "2026-02-23T..."
}
\`\`\`

*Retry Policy:*
3 retries with exponential backoff (1s, 5s, 30s)

📖 [Webhook docs](${DOCS_URL}/webhooks)`;

  return sendMessage(chatId, text);
}

function handleSdk(chatId: number): Promise<void> {
  const text = `📦 *TypeScript SDK*

*Installation:*
\`\`\`bash
npm install @invoica/sdk
\`\`\`

*Quick Start:*
\`\`\`typescript
import { Invoica } from '@invoica/sdk';

const client = new Invoica({
  apiKey: process.env.INVOICA_API_KEY
});

// Create an invoice
const invoice = await client.invoices.create({
  client_name: 'Acme AI',
  amount: 500.00,
  currency: 'USD'
});

// Calculate tax
const tax = await client.tax.calculate({
  amount: 500.00,
  country: 'US',
  state: 'CA'
});
\`\`\`

*SDK Features:*
• Full TypeScript types
• Automatic retry with backoff
• Webhook signature verification
• x402 protocol helpers

📖 [SDK documentation](${DOCS_URL}/sdk)
🐙 [GitHub repository](https://github.com/skingem1/Invoica)`;

  return sendMessage(chatId, text);
}

async function handleStatus(chatId: number): Promise<void> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";

  // Quick health checks
  const checks: Record<string, boolean> = {};

  try {
    const apiRes = await fetch(`${supabaseUrl}/functions/v1/api/v1/health`, {
      signal: AbortSignal.timeout(5000),
    });
    checks.api = apiRes.ok;
  } catch {
    checks.api = false;
  }

  try {
    const dbRes = await fetch(`${supabaseUrl}/rest/v1/`, {
      signal: AbortSignal.timeout(5000),
    });
    checks.database = dbRes.ok || dbRes.status === 401;
  } catch {
    checks.database = false;
  }

  try {
    const dashRes = await fetch("https://invoica-b89o.vercel.app", {
      signal: AbortSignal.timeout(5000),
    });
    checks.dashboard = dashRes.ok;
  } catch {
    checks.dashboard = false;
  }

  const statusEmoji = (ok: boolean) => ok ? "🟢" : "🔴";
  const allOk = Object.values(checks).every(v => v);
  const { dayNumber, phase } = getBetaInfo();

  const text = `📊 *Invoica System Status*

${statusEmoji(allOk)} *Overall:* ${allOk ? "All Systems Operational" : "Some Issues Detected"}

${statusEmoji(checks.api)} API Gateway
${statusEmoji(checks.database)} Database
${statusEmoji(checks.dashboard)} Dashboard

📅 Beta Day: ${dayNumber} (${phase.replace("_", " ")})

_Last checked: ${new Date().toISOString().replace("T", " ").slice(0, 19)} UTC_

${!allOk ? "\n⚠️ If you're experiencing issues, use /escalate to report them." : ""}`;

  return sendMessage(chatId, text);
}

async function handleFeedback(chatId: number, userId: number, username: string | undefined, text?: string): Promise<void> {
  if (!text || text.trim() === "/feedback") {
    return sendMessage(
      chatId,
      `📝 *Share Your Feedback*\n\nPlease send your feedback in this format:\n\n\`/feedback Your feedback message here\`\n\nExamples:\n• \`/feedback Love the API docs, very clear!\`\n• \`/feedback Would be great to have Python SDK\`\n• \`/feedback Found a bug in tax calculation for Germany\`\n\nAll feedback is reviewed by the team! 🙏`
    );
  }

  const feedbackText = text.replace(/^\/feedback\s*/i, "").trim();
  if (!feedbackText) {
    return sendMessage(chatId, "Please include your feedback message after /feedback");
  }

  // Simple categorization
  const lower = feedbackText.toLowerCase();
  let category = "general";
  if (lower.includes("bug") || lower.includes("error") || lower.includes("broken") || lower.includes("crash")) {
    category = "bug";
  } else if (lower.includes("feature") || lower.includes("request") || lower.includes("would be") || lower.includes("please add")) {
    category = "feature_request";
  } else if (lower.includes("love") || lower.includes("great") || lower.includes("awesome") || lower.includes("amazing")) {
    category = "praise";
  } else if (lower.includes("slow") || lower.includes("improve") || lower.includes("better") || lower.includes("could")) {
    category = "improvement";
  }

  const supabase = getSupabaseClient();
  await logFeedback(supabase, userId, username, feedbackText, category);

  return sendMessage(
    chatId,
    `✅ *Feedback received!*\n\n*Category:* ${category}\n*Your feedback:* ${feedbackText}\n\nThank you for helping us improve Invoica! Your feedback will be reviewed by the team. 🙏`
  );
}

async function handleEscalate(chatId: number, userId: number, username: string | undefined, text?: string): Promise<void> {
  if (!text || text.trim() === "/escalate") {
    return sendMessage(
      chatId,
      `🆘 *Request Human Support*\n\nPlease describe your issue:\n\n\`/escalate Your issue description here\`\n\nExamples:\n• \`/escalate Billing charge doesn't match my plan\`\n• \`/escalate My API key might be compromised\`\n• \`/escalate Persistent 500 errors on invoice creation\`\n\nA team member will review your case and respond as soon as possible.`
    );
  }

  const issueText = text.replace(/^\/escalate\s*/i, "").trim();
  if (!issueText) {
    return sendMessage(chatId, "Please describe your issue after /escalate");
  }

  const supabase = getSupabaseClient();
  await logEscalation(supabase, userId, username, issueText, "Bot could not resolve", "User requested human support");

  return sendMessage(
    chatId,
    `🆘 *Escalation Created*\n\n*Issue:* ${issueText}\n*Status:* Pending review\n\nA team member has been notified and will respond as soon as possible. For urgent security issues (compromised API keys), please also rotate your keys immediately in Dashboard → Settings → API Keys.\n\n_Typical response time: within 24 hours_`
  );
}

function handleDocs(chatId: number): Promise<void> {
  const text = `📖 *Invoica Documentation*\n\n🔗 [Documentation Home](${DOCS_URL})\n📋 [API Reference](${DOCS_URL}/api-reference)\n🚀 [Quickstart Guide](${DOCS_URL}/quickstart)\n📦 [TypeScript SDK](${DOCS_URL}/sdk)\n🔔 [Webhooks Guide](${DOCS_URL}/webhooks)\n🧾 [Tax Compliance](${DOCS_URL}/tax-compliance)\n🤖 [x402 Protocol](${DOCS_URL}/x402)\n\n📊 [Dashboard](${DASHBOARD_URL})\n🌐 [Website](${WEBSITE_URL})`;

  return sendMessage(chatId, text);
}

// ─── Natural Language Handler ────────────────────────────────────────

function handleNaturalLanguage(chatId: number, text: string, userId: number, username: string | undefined): Promise<void> {
  const lower = text.toLowerCase();

  // Greetings
  if (/^(hi|hello|hey|sup|yo|greetings|good (morning|afternoon|evening))/.test(lower)) {
    return sendMessage(
      chatId,
      `👋 Hey there! I'm the Invoica support bot. How can I help you today?\n\nUse /help to see all commands, or just ask me a question!`
    );
  }

  // What is Invoica
  if (lower.includes("what is invoica") || lower.includes("what's invoica") || lower.includes("about invoica")) {
    return sendMessage(
      chatId,
      `*Invoica* is the Financial OS for AI Agents.\n\nWe provide invoice middleware with x402 protocol support, enabling:\n• Agent-to-agent payments over HTTP\n• Tax compliance across 12 countries\n• Financial ledger & reporting\n• Settlement detection & verification\n\nThink of it as Stripe, but built specifically for AI agents. 🤖\n\n🔗 [Learn more](${WEBSITE_URL})\n📖 [Read the docs](${DOCS_URL})`
    );
  }

  // Pricing questions
  if (lower.includes("price") || lower.includes("pricing") || lower.includes("cost") || lower.includes("how much") || lower.includes("plan")) {
    return handlePricing(chatId);
  }

  // Beta questions
  if (lower.includes("beta") || lower.includes("discount") || lower.includes("founding") || lower.includes("early adopter") || lower.includes("free")) {
    return handleBeta(chatId);
  }

  // API questions
  if (lower.includes("api key") || lower.includes("api-key") || lower.includes("authentication") || lower.includes("auth token") || lower.includes("bearer")) {
    return sendMessage(
      chatId,
      `🔑 *API Key Setup*\n\n1. Log in to [Dashboard](${DASHBOARD_URL})\n2. Go to Settings → API Keys\n3. Click "Create New Key"\n4. Copy and save your key securely\n\n*Usage:*\n\`\`\`\nAuthorization: Bearer YOUR_API_KEY\n\`\`\`\n\n⚠️ Your API key is shown only once — save it immediately!\nIf compromised, rotate it immediately in Settings.\n\n📖 [Auth docs](${DOCS_URL}/authentication)`
    );
  }

  // Error-related
  if (lower.includes("error") || lower.includes("401") || lower.includes("403") || lower.includes("404") || lower.includes("429") || lower.includes("500")) {
    return handleErrors(chatId);
  }

  // x402 questions
  if (lower.includes("x402") || lower.includes("agent-to-agent") || lower.includes("agent to agent") || lower.includes("402 payment")) {
    return sendMessage(
      chatId,
      `🤖 *x402 Protocol*\n\nThe x402 protocol enables AI agents to pay each other over HTTP using the standard 402 Payment Required status code.\n\n*How it works:*\n1. Agent A requests a service from Agent B\n2. Agent B responds with HTTP 402 + payment details\n3. Agent A creates a cryptographic invoice via Invoica\n4. Payment is settled and verified automatically\n5. Agent B provides the service\n\nIt's like a toll booth for AI services — fully automated, no human intervention needed.\n\n📖 [x402 docs](${DOCS_URL}/x402)\n🔗 [Protocol spec](${DOCS_URL}/x402/specification)`
    );
  }

  // Webhook questions
  if (lower.includes("webhook") || lower.includes("event") || lower.includes("notification")) {
    return handleWebhooks(chatId);
  }

  // Tax questions
  if (lower.includes("tax") || lower.includes("vat") || lower.includes("gst") || lower.includes("sales tax") || lower.includes("compliance")) {
    return sendMessage(
      chatId,
      `🧾 *Tax Compliance*\n\nInvoica handles tax calculations for 12 countries automatically.\n\n*Supported tax types:*\n• 🇺🇸 US Sales Tax (state-level)\n• 🇪🇺 EU VAT (VIES validation)\n• 🇬🇧 UK VAT\n• 🇨🇦 GST/HST/PST\n• 🇦🇺 Australian GST\n• 🇯🇵 Japan Consumption Tax\n• 🇸🇬 Singapore GST\n• 🇮🇱 Israel VAT\n• 🇧🇷 Brazil taxes\n\n*API Usage:*\n\`POST /v1/tax/calculate\`\n\n📖 [Tax docs](${DOCS_URL}/tax-compliance)\n🌍 /countries — See full list`
    );
  }

  // Security concerns
  if (lower.includes("compromised") || lower.includes("security") || lower.includes("hack") || lower.includes("leak") || lower.includes("stolen")) {
    return sendMessage(
      chatId,
      `🔒 *Security Alert*\n\nIf you believe your API key has been compromised:\n\n1. *Immediately* rotate your key: Dashboard → Settings → API Keys → Revoke\n2. Create a new API key\n3. Update your applications with the new key\n4. Use /escalate to report the incident\n\nOur team will investigate and help secure your account.\n\n⚠️ Never share API keys in public channels, git repos, or chat messages!`
    );
  }

  // Getting started
  if (lower.includes("get started") || lower.includes("getting started") || lower.includes("how to start") || lower.includes("onboard") || lower.includes("sign up") || lower.includes("register")) {
    return handleGetStarted(chatId);
  }

  // Docs
  if (lower.includes("doc") || lower.includes("documentation") || lower.includes("guide") || lower.includes("tutorial")) {
    return handleDocs(chatId);
  }

  // SDK
  if (lower.includes("sdk") || lower.includes("library") || lower.includes("typescript") || lower.includes("npm")) {
    return handleSdk(chatId);
  }

  // Thank you
  if (lower.includes("thank") || lower.includes("thanks") || lower.includes("thx")) {
    return sendMessage(
      chatId,
      `You're welcome! 😊 Let me know if you need anything else. I'm here 24/7!`
    );
  }

  // Fallback — unknown question
  return sendMessage(
    chatId,
    `I'm not sure I understand that question. Here are some things I can help with:\n\n• /help — See all commands\n• /getstarted — Onboarding guide\n• /pricing — Plans & pricing\n• /api — API quickstart\n• /errors — Troubleshoot errors\n• /escalate — Get human support\n\nOr try rephrasing your question! I know about Invoica's API, pricing, tax compliance, x402 protocol, and more. 💬`
  );
}

// ─── Webhook Handler ─────────────────────────────────────────────────

async function handleWebhook(update: TelegramUpdate): Promise<void> {
  // Handle callback queries
  if (update.callback_query) {
    await answerCallbackQuery(update.callback_query.id);
    return;
  }

  // Handle messages
  const message = update.message;
  if (!message || !message.text) return;

  const chatId = message.chat.id;
  const userId = message.from.id;
  const username = message.from.username;
  const firstName = message.from.first_name;
  const text = message.text.trim();

  // Extract command (handle bot mentions like /start@InvoicaBot)
  const commandMatch = text.match(/^\/([a-zA-Z]+)(@\w+)?/);
  const command = commandMatch ? commandMatch[1].toLowerCase() : null;

  try {
    switch (command) {
      case "start":
        return await handleStart(chatId, firstName);
      case "help":
        return await handleHelp(chatId);
      case "pricing":
        return await handlePricing(chatId);
      case "beta":
        return await handleBeta(chatId);
      case "getstarted":
        return await handleGetStarted(chatId);
      case "features":
        return await handleFeatures(chatId);
      case "countries":
        return await handleCountries(chatId);
      case "api":
        return await handleApiGuide(chatId);
      case "errors":
        return await handleErrors(chatId);
      case "webhooks":
        return await handleWebhooks(chatId);
      case "sdk":
        return await handleSdk(chatId);
      case "status":
        return await handleStatus(chatId);
      case "docs":
        return await handleDocs(chatId);
      case "feedback":
        return await handleFeedback(chatId, userId, username, text);
      case "escalate":
        return await handleEscalate(chatId, userId, username, text);
      default:
        // Natural language handling
        return await handleNaturalLanguage(chatId, text, userId, username);
    }
  } catch (error) {
    console.error(`[TelegramBot] Error handling message:`, error);
    await sendMessage(
      chatId,
      `⚠️ Sorry, I encountered an error processing your request. Please try again or use /escalate if the issue persists.`
    );
  }
}

// ─── Edge Function Entry Point ───────────────────────────────────────

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/telegram-bot/, "");

  // CORS headers
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // Health check
  if (path === "/health" || path === "/") {
    if (req.method === "GET") {
      return new Response(
        JSON.stringify({
          status: "ok",
          bot: "telegram-support",
          version: "1.0.0",
          timestamp: new Date().toISOString(),
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
  }

  // Set webhook endpoint
  if (path === "/set-webhook" && req.method === "POST") {
    try {
      const token = getBotToken();
      const webhookUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/telegram-bot/webhook`;

      const response = await fetch(`${TELEGRAM_API}${token}/setWebhook`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: webhookUrl,
          allowed_updates: ["message", "callback_query"],
          drop_pending_updates: true,
        }),
      });

      const result = await response.json();
      return new Response(JSON.stringify(result), {
        status: response.ok ? 200 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (error) {
      return new Response(
        JSON.stringify({ error: "Failed to set webhook" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  }

  // Get webhook info
  if (path === "/webhook-info" && req.method === "GET") {
    try {
      const token = getBotToken();
      const response = await fetch(`${TELEGRAM_API}${token}/getWebhookInfo`);
      const result = await response.json();
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (error) {
      return new Response(
        JSON.stringify({ error: "Failed to get webhook info" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  }

  // Main webhook handler — receives Telegram updates
  if (path === "/webhook" && req.method === "POST") {
    try {
      const update: TelegramUpdate = await req.json();

      // Process asynchronously — respond to Telegram immediately
      // Telegram expects a 200 within a few seconds
      handleWebhook(update).catch((err) => {
        console.error("[TelegramBot] Async handler error:", err);
      });

      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("[TelegramBot] Webhook parse error:", error);
      return new Response(
        JSON.stringify({ error: "Invalid update" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  }

  // 404 for unknown routes
  return new Response(
    JSON.stringify({
      error: "Not found",
      available_routes: [
        "GET  / — Health check",
        "POST /webhook — Telegram webhook endpoint",
        "POST /set-webhook — Configure Telegram webhook",
        "GET  /webhook-info — Get current webhook config",
      ],
    }),
    { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
