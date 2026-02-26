/**
 * CTO Email Support Monitor — support@invoica.ai
 *
 * Polls IMAP inbox for new emails, uses Claude to draft responses,
 * and sends replies via SMTP. Runs every 5 minutes via PM2 cron.
 *
 * Logs: logs/email-support/YYYY-MM-DD.log
 * Escalations: reports/cto/email-escalations/YYYY-MM-DD.md
 */

import 'dotenv/config';
import { ImapFlow } from 'imapflow';
import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';
import https from 'https';

// ── Config ─────────────────────────────────────────────────────────────────
const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || 'support@invoica.ai';
const EMAIL_PASSWORD = process.env.SUPPORT_EMAIL_PASSWORD || '';
const IMAP_HOST = process.env.SUPPORT_EMAIL_IMAP_HOST || 'imap.ionos.com';
const IMAP_PORT = parseInt(process.env.SUPPORT_EMAIL_IMAP_PORT || '993');
const SMTP_HOST = process.env.SUPPORT_EMAIL_SMTP_HOST || 'smtp.ionos.com';
const SMTP_PORT = parseInt(process.env.SUPPORT_EMAIL_SMTP_PORT || '465');
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';

const LOG_DIR = path.join(__dirname, '../logs/email-support');
const ESCALATION_DIR = path.join(__dirname, '../reports/cto/email-escalations');
const PROCESSED_FILE = path.join(LOG_DIR, 'processed-ids.json');

// ── Ensure dirs exist ────────────────────────────────────────────────────
[LOG_DIR, ESCALATION_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const today = new Date().toISOString().split('T')[0];
const logFile = path.join(LOG_DIR, `${today}.log`);

function log(msg: string) {
  const ts = new Date().toISOString();
  const line = `[${ts}] ${msg}`;
  console.log(line);
  fs.appendFileSync(logFile, line + '\n');
}

function loadProcessedIds(): Set<string> {
  if (!fs.existsSync(PROCESSED_FILE)) return new Set();
  try {
    const data = JSON.parse(fs.readFileSync(PROCESSED_FILE, 'utf-8'));
    return new Set(data);
  } catch { return new Set(); }
}

function saveProcessedIds(ids: Set<string>) {
  // Keep last 500 IDs to avoid unbounded growth
  const arr = [...ids].slice(-500);
  fs.writeFileSync(PROCESSED_FILE, JSON.stringify(arr, null, 2));
}

// ── LLM: Draft reply via Claude ──────────────────────────────────────────
async function draftReply(from: string, subject: string, body: string): Promise<{
  reply: string;
  shouldEscalate: boolean;
  category: string;
}> {
  return new Promise((resolve, reject) => {
    const systemPrompt = `You are the CTO of Invoica — the world's first Financial OS for AI Agents.
You manage the support@invoica.ai inbox and respond to user inquiries professionally and helpfully.

Invoica Context:
- AI-powered invoicing platform using x402 payment protocol
- Currently in BETA — free for all users during beta
- Dashboard: https://app.invoica.ai
- Documentation: https://docs.invoica.ai
- Telegram bot: https://t.me/invoicaBot

Your response guidelines:
1. Be concise, helpful, and professional
2. Sign off as "Tarek & the Invoica Team"
3. For technical API questions → link to docs.invoica.ai
4. For billing issues → explain it's free during beta
5. For bugs → thank them, ask for reproduction steps, promise to fix within 24hrs
6. For feature requests → thank them warmly, note it for the roadmap
7. ESCALATE (set shouldEscalate: true) if: legal threats, serious security issues, abuse reports, angry refund demands
8. NEVER reveal internal architecture, API keys, server details, or agent names

Respond ONLY with a JSON object:
{
  "reply": "the email body to send (plain text, no HTML)",
  "shouldEscalate": false,
  "category": "one of: general_inquiry | technical_support | billing | bug_report | feature_request | escalation"
}`;

    const payload = JSON.stringify({
      model: 'claude-sonnet-4-5',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{
        role: 'user',
        content: `New support email:\n\nFrom: ${from}\nSubject: ${subject}\n\nBody:\n${body.substring(0, 3000)}`
      }]
    });

    const options = {
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          const content = parsed.content?.[0]?.text || '{}';
          // Extract JSON from response (handle markdown code blocks)
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (!jsonMatch) throw new Error('No JSON in response');
          resolve(JSON.parse(jsonMatch[0]));
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

// ── Save escalation ──────────────────────────────────────────────────────
function saveEscalation(from: string, subject: string, body: string, category: string) {
  const file = path.join(ESCALATION_DIR, `${today}.md`);
  const entry = `
## Escalation — ${new Date().toISOString()}
**From:** ${from}
**Subject:** ${subject}
**Category:** ${category}

**Body:**
\`\`\`
${body.substring(0, 2000)}
\`\`\`

---
`;
  fs.appendFileSync(file, entry);
  log(`⚠️  ESCALATION saved: ${from} — ${subject}`);
}

// ── Main ─────────────────────────────────────────────────────────────────
async function main() {
  if (!EMAIL_PASSWORD || EMAIL_PASSWORD === 'REPLACE_WITH_IONOS_MAILBOX_PASSWORD') {
    log('❌ SUPPORT_EMAIL_PASSWORD not configured — set it in .env');
    process.exit(1);
  }

  if (!ANTHROPIC_API_KEY) {
    log('❌ ANTHROPIC_API_KEY not configured');
    process.exit(1);
  }

  log('📬 Starting email support check...');

  const processedIds = loadProcessedIds();

  // Connect to IMAP
  const client = new ImapFlow({
    host: IMAP_HOST,
    port: IMAP_PORT,
    secure: true,
    auth: {
      user: SUPPORT_EMAIL,
      pass: EMAIL_PASSWORD
    },
    logger: false
  });

  // SMTP transporter
  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: true, // SSL
    auth: {
      user: SUPPORT_EMAIL,
      pass: EMAIL_PASSWORD
    }
  });

  try {
    await client.connect();
    log('✅ Connected to IMAP');

    const lock = await client.getMailboxLock('INBOX');
    let processed = 0;

    try {
      // Fetch unseen messages
      for await (const message of client.fetch({ unseen: true }, {
        uid: true,
        envelope: true,
        bodyParts: ['TEXT'],
        flags: true
      })) {
        const uid = String(message.uid);

        // Skip already processed
        if (processedIds.has(uid)) continue;

        const from = message.envelope?.from?.[0]?.address || 'unknown';
        const fromName = message.envelope?.from?.[0]?.name || from;
        const subject = message.envelope?.subject || '(no subject)';
        const bodyPart = message.bodyParts?.get('TEXT');
        const body = bodyPart ? bodyPart.toString() : '(empty body)';

        // Skip our own emails (prevent loops)
        if (from.includes('invoica.ai')) {
          processedIds.add(uid);
          continue;
        }

        log(`📧 Processing: [${uid}] from ${from} — "${subject}"`);

        try {
          // Draft reply with Claude
          const { reply, shouldEscalate, category } = await draftReply(from, subject, body);
          log(`   Category: ${category} | Escalate: ${shouldEscalate}`);

          if (shouldEscalate) {
            saveEscalation(from, subject, body, category);
            // Still send a holding reply for escalations
          }

          // Send reply
          await transporter.sendMail({
            from: `"Invoica Support" <${SUPPORT_EMAIL}>`,
            to: from,
            replyTo: SUPPORT_EMAIL,
            subject: subject.startsWith('Re:') ? subject : `Re: ${subject}`,
            text: reply,
            inReplyTo: message.envelope?.messageId,
            references: message.envelope?.messageId
          });

          log(`   ✅ Reply sent to ${from}`);

          // Mark as read
          await client.messageFlagsAdd({ uid }, ['\\Seen']);

          processedIds.add(uid);
          processed++;

          // Save progress after each email
          saveEscalation.toString(); // type check no-op
        } catch (err) {
          log(`   ❌ Error processing email ${uid}: ${err}`);
        }

        // Rate limit: don't hammer the API
        await new Promise(r => setTimeout(r, 1000));
      }
    } finally {
      lock.release();
    }

    await client.logout();
    saveProcessedIds(processedIds);

    if (processed === 0) {
      log('📭 No new emails to process');
    } else {
      log(`✅ Processed ${processed} email(s)`);
    }

  } catch (err) {
    log(`❌ Fatal error: ${err}`);
    try { await client.logout(); } catch {}
    process.exit(1);
  }
}

main().catch(err => {
  log(`❌ Unhandled error: ${err}`);
  process.exit(1);
});
