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


async function getLiveUsdcBalance(address: string): Promise<number> {
  const padded = address.slice(2).padStart(64, '0');
  const res = await fetch('https://mainnet.base.org', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0', id: 1, method: 'eth_call',
      params: [{ to: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', data: '0x70a08231' + padded }, 'latest']
    })
  });
  const json = await res.json() as { result: string };
  return Number(BigInt(json.result || '0x0')) / 1_000_000;
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
    // Store owner chat ID for wallet alerts
    if (from.id === ALLOWED_USER_ID) {
      process.env.OWNER_TELEGRAM_CHAT_ID = chatId.toString();
    }
    await telegramSend('sendMessage', {
      chat_id: chatId,
      parse_mode: 'Markdown',
      text: `👋 Welcome back, ${from.first_name}.\n\nI'm your Invoica executive assistant, powered by Claude.\n\n*Commands:*\n/status — System health & metrics\n/wallets — Agent wallet balances\n/approve_topup <id> — Approve & execute a USDC top-up\n/reject_topup <id> — Reject a top-up request\n/clear — Clear conversation history\n/help — Show this menu\n\nOr just talk to me naturally.`,
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
      text: `📋 *CEO Bot Commands*\n\n/status — Platform health & uptime\n/wallets — Agent wallet balances\n/approve_topup <id> — Approve & execute a USDC top-up\n/reject_topup <id> — Reject a top-up request\n/clear — Reset conversation\n/help — This menu\n\nOr send any message to chat with Claude AI.`,
    });
    return;
  }

  if (text === '/wallets') {
    await telegramSend('sendMessage', { chat_id: chatId, text: '🔄 Fetching live on-chain balances...' });
    try {
      const { getAgentWallets, updateBalance } = await import('../../../scripts/wallet-service');
      const wallets = await getAgentWallets();
      const lines = ['💳 *Agent Wallet Balances (Live)*\n'];
      for (const w of wallets!) {
        const liveBalance = await getLiveUsdcBalance(w.address);
        await updateBalance(w.agent_name, liveBalance);
        const icon = liveBalance < Number(w.low_balance_threshold) ? '🔴' : '🟢';
        const treasury = w.is_treasury ? ' (treasury)' : '';
        lines.push(`${icon} \`${w.agent_name}\`${treasury}: $${liveBalance.toFixed(2)} USDC`);
      }
      lines.push('\n_Live from Base mainnet RPC_');
      await telegramSend('sendMessage', { chat_id: chatId, parse_mode: 'Markdown', text: lines.join('\n') });
    } catch (err: any) {
      await telegramSend('sendMessage', { chat_id: chatId, text: `⚠️ Could not fetch wallets: ${err.message}` });
    }
    return;
  }

  if (text?.startsWith('/approve_topup ')) {
    const requestId = text.replace('/approve_topup ', '').trim();
    try {
      const { approveTopupRequest } = await import('../../../scripts/wallet-service');
      const { executeTopup } = await import('../../../scripts/wallet-topup');
      await approveTopupRequest(requestId);
      await telegramSend('sendMessage', { chat_id: chatId, text: `✅ Top-up approved. Executing transfer...` });
      const txHash = await executeTopup(requestId);
      await telegramSend('sendMessage', {
        chat_id: chatId,
        parse_mode: 'Markdown',
        text: `✅ *Top-up complete!*\n\nTX: \`${txHash}\`\n[View on BaseScan](https://basescan.org/tx/${txHash})`
      });
    } catch (err: any) {
      await telegramSend('sendMessage', { chat_id: chatId, text: `❌ Top-up failed: ${err.message}` });
    }
    return;
  }

  if (text?.startsWith('/reject_topup ')) {
    const requestId = text.replace('/reject_topup ', '').trim();
    try {
      const supabase = (await import('@supabase/supabase-js')).createClient(
        process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!
      );
      await supabase.from('agent_topup_requests').update({ status: 'rejected' }).eq('id', requestId);
      await telegramSend('sendMessage', { chat_id: chatId, text: `🚫 Top-up request ${requestId.slice(0,8)}... rejected.` });
    } catch (err: any) {
      await telegramSend('sendMessage', { chat_id: chatId, text: `❌ Error: ${err.message}` });
    }
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

async function startWalletMonitor(): Promise<void> {
  const POLL_INTERVAL_MS = 60_000; // check every 60 seconds

  const checkWallets = async () => {
    try {
      const ownerChatId = process.env.OWNER_TELEGRAM_CHAT_ID;
      if (!ownerChatId) return; // no owner chat registered yet

      const { getAgentWallets } = await import('../../../scripts/wallet-service');
      const wallets = await getAgentWallets();
      if (!wallets) return;

      for (const w of wallets) {
        if (Number(w.usdc_balance) < Number(w.low_balance_threshold)) {
          const msg =
            `🔴 *Low Wallet Alert*\n\n` +
            `Agent: \`${w.agent_name}\`\n` +
            `Balance: $${Number(w.usdc_balance).toFixed(2)} USDC\n` +
            `Threshold: $${Number(w.low_balance_threshold).toFixed(2)} USDC\n\n` +
            `Use /approve_topup <request_id> to fund this wallet.`;
          await telegramSend('sendMessage', {
            chat_id: ownerChatId,
            parse_mode: 'Markdown',
            text: msg,
          });
        }
      }
    } catch (err) {
      console.error('[CeoBot] Wallet monitor error:', err);
    }
  };

  // Delay first check by 30 seconds to let the process warm up
  setTimeout(() => {
    checkWallets();
    setInterval(checkWallets, POLL_INTERVAL_MS);
  }, 30_000);

  console.log('[CeoBot] Wallet monitor background task started (60s interval).');
}

export async function startCeoBot(): Promise<void> {
  if (!TELEGRAM_TOKEN) {
    console.log('[CeoBot] CEO_TELEGRAM_BOT_TOKEN not set — skipping');
    return;
  }
  console.log('[CeoBot] Starting CEO executive bot...');

  // Start wallet monitoring background task
  startWalletMonitor();

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
