import https from 'https';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from: { id: number; first_name: string; username?: string };
    chat: { id: number; type: string };
    text?: string;
    date: number;
  };
}

const TELEGRAM_TOKEN = process.env.CEO_TELEGRAM_BOT_TOKEN || '';
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const ALLOWED_USER_ID = process.env.CEO_TELEGRAM_USER_ID
  ? parseInt(process.env.CEO_TELEGRAM_USER_ID, 10)
  : null;

const SYSTEM_PROMPT = `You are an intelligent executive assistant for the CEO of Invoica — a Financial OS for AI Agents built on the x402 protocol.

You have deep knowledge of:
- Invoica's architecture: Express/TypeScript backend, Next.js frontend, Supabase database
- Business metrics, invoice processing, and payment flows
- The 9-agent AI system (Claude CEO/Supervisor + MiniMax coding agents)
- Pricing: Free (100 invoices/month) and Pro ($49/month, 10k invoices)

You help the CEO with:
- System status and health checks
- Business strategy and decision-making
- Drafting communications and content
- Analyzing data and summarizing reports
- Technical questions about the platform

Be direct, concise, and executive-level in your responses.`;

const conversationHistory = new Map<number, Message[]>();

function httpsPost(hostname: string, path: string, headers: Record<string, string>, body: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const req = https.request(
      { hostname, path, method: 'POST', headers: { ...headers, 'Content-Length': Buffer.byteLength(body) } },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve(data); } });
      }
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function httpsGet(hostname: string, path: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const req = https.request({ hostname, path, method: 'GET' }, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve(data); } });
    });
    req.on('error', reject);
    req.end();
  });
}

async function telegramSend(method: string, params: object): Promise<any> {
  const body = JSON.stringify(params);
  return httpsPost('api.telegram.org', `/bot${TELEGRAM_TOKEN}/${method}`, { 'Content-Type': 'application/json' }, body);
}

async function callClaude(userId: number, userMessage: string): Promise<string> {
  if (!conversationHistory.has(userId)) conversationHistory.set(userId, []);
  const history = conversationHistory.get(userId)!;
  history.push({ role: 'user', content: userMessage });
  if (history.length > 20) history.splice(0, history.length - 20);

  const body = JSON.stringify({
    model: 'claude-opus-4-5',
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: history,
  });

  const response = await httpsPost(
    'api.anthropic.com',
    '/v1/messages',
    {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body
  );

  const reply = response?.content?.[0]?.text || 'No response from Claude.';
  history.push({ role: 'assistant', content: reply });
  return reply;
}

async function getSystemStatus(): Promise<string> {
  return `📊 *System Status*\n\nEnvironment: ${process.env.NODE_ENV || 'production'}\nUptime: ${Math.floor(process.uptime() / 60)}m ${Math.floor(process.uptime() % 60)}s\nMemory: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB used\nAPI: https://invoica.wp1.host/v1/health`;
}

async function handleUpdate(update: TelegramUpdate): Promise<void> {
  if (!update.message?.text) return;
  const { chat, from, text } = update.message;
  const chatId = chat.id;

  if (ALLOWED_USER_ID && from.id !== ALLOWED_USER_ID) {
    await telegramSend('sendMessage', { chat_id: chatId, text: '🔒 Private executive bot. Unauthorized access.' });
    console.warn(`[CeoBot] Unauthorized from user ${from.id} (@${from.username})`);
    return;
  }

  if (text === '/start') {
    await telegramSend('sendMessage', {
      chat_id: chatId,
      parse_mode: 'Markdown',
      text: `👋 Welcome back, ${from.first_name}.\n\nI'm your Invoica executive assistant, powered by Claude.\n\n*Commands:*\n/status — System health & metrics\n/clear — Clear conversation history\n/help — Show this menu\n\nOr just talk to me naturally.`,
    });
    return;
  }

  if (text === '/status') {
    const status = await getSystemStatus();
    await telegramSend('sendMessage', { chat_id: chatId, parse_mode: 'Markdown', text: status });
    return;
  }

  if (text === '/clear') {
    conversationHistory.delete(from.id);
    await telegramSend('sendMessage', { chat_id: chatId, text: '🧹 Conversation history cleared.' });
    return;
  }

  if (text === '/help') {
    await telegramSend('sendMessage', {
      chat_id: chatId,
      parse_mode: 'Markdown',
      text: `📋 *CEO Bot Commands*\n\n/status — Platform health & uptime\n/clear — Reset conversation\n/help — This menu\n\nOr send any message to chat with Claude AI.`,
    });
    return;
  }

  await telegramSend('sendChatAction', { chat_id: chatId, action: 'typing' });

  try {
    const reply = await callClaude(from.id, text);
    if (reply.length > 4000) {
      const chunks = reply.match(/.{1,4000}/gs) || [reply];
      for (const chunk of chunks) {
        await telegramSend('sendMessage', { chat_id: chatId, text: chunk });
      }
    } else {
      await telegramSend('sendMessage', { chat_id: chatId, text: reply });
    }
  } catch (err) {
    console.error('[CeoBot] Claude error:', err);
    await telegramSend('sendMessage', { chat_id: chatId, text: '⚠️ Error calling Claude. Check ANTHROPIC_API_KEY.' });
  }
}

export async function startCeoBot(): Promise<void> {
  if (!TELEGRAM_TOKEN) {
    console.log('[CeoBot] CEO_TELEGRAM_BOT_TOKEN not set — skipping');
    return;
  }
  console.log('[CeoBot] Starting CEO executive bot...');

  let offset = 0;
  const poll = async (): Promise<void> => {
    try {
      const result = await httpsGet('api.telegram.org', `/bot${TELEGRAM_TOKEN}/getUpdates?offset=${offset}&timeout=25`);
      if (result?.ok && Array.isArray(result.result)) {
        for (const update of result.result as TelegramUpdate[]) {
          offset = update.update_id + 1;
          handleUpdate(update).catch((e) => console.error('[CeoBot] Handler error:', e));
        }
      }
    } catch (err) {
      console.error('[CeoBot] Polling error:', err);
      await new Promise((r) => setTimeout(r, 5000));
    }
    setImmediate(poll);
  };
  poll();
  console.log('[CeoBot] CEO bot running!');
}
