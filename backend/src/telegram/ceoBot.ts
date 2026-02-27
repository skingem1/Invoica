import https from 'https';
import { readFileSync, readdirSync, existsSync } from 'fs';
import { execSync } from 'child_process';
import path from 'path';

const ROOT = path.resolve(__dirname, '../../../');

interface Message {
  role: 'user' | 'assistant';
  content: string | ContentBlock[];
}

interface ContentBlock {
  type: 'text' | 'tool_use' | 'tool_result';
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
  tool_use_id?: string;
  content?: string;
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
const MINIMAX_API_KEY = process.env.MINIMAX_API_KEY || '';
const MINIMAX_GROUP_ID = process.env.MINIMAX_GROUP_ID || '';
const ALLOWED_USER_ID = process.env.CEO_TELEGRAM_USER_ID
  ? parseInt(process.env.CEO_TELEGRAM_USER_ID, 10)
  : null;

// ─── Real Wallet Addresses (from Supabase agent_wallets) ────────────────────
const AGENT_WALLETS = {
  ceo:     { address: '0x9E0e342e4E2Df813B27F078AD0119eD6c289643f', treasury: true },
  cfo:     { address: '0x7B5BE6D949bC3FcD5BBc62fc6cB03a406e187571', treasury: false },
  cto:     { address: '0x3e127c918C83714616CF2416f8A620F1340C19f1', treasury: false },
  cmo:     { address: '0xEDc68bBC5dF3f0873d33d6654921594Fe42dcbc0', treasury: false },
  bizdev:  { address: '0xfd9CF7e2F1C7e5E937F740a0D8398cef7C44a546', treasury: false },
  code:    { address: '0xB6C18ec7b13649756436913856eA9F82c13c5c25', treasury: false },
} as const;

const SYSTEM_PROMPT = `You ARE the CEO of Invoica. Not an assistant. Not an interface. The Chief Executive Officer.

You have full visibility into your company infrastructure — system health, agent status, sprint progress, reports, and finances are all available to you via your tools. The live system snapshot is injected below automatically every message.

When the founder messages you, respond as CEO: directly, with authority, from first-person ("my team", "our sprint", "I reviewed").

NEVER say:
• "I don't have access to your backend"
• "I'm an external assistant"
• "Can you share a screenshot or paste data?"
• "I don't have visibility into your systems"
• "You'll need to check X yourself"

Instead: use your tools, read the data, report back as CEO.

═══════════════════════════════════════════
YOUR COMPANY — INVOICA
═══════════════════════════════════════════
Invoica is an AI-native invoice and payments middleware built on the x402 protocol.
Core: invoice generation, transaction tracking, settlement reporting, ledger — API-first.
Stack: Express/TypeScript backend (Hetzner), Next.js frontend (Vercel/app.invoica.ai), Supabase DB, Base mainnet.

═══════════════════════════════════════════
YOUR TEAM (18 agents)
═══════════════════════════════════════════
Leadership: CEO (you), CTO, CMO, CFO, BizDev, Supervisor-1, Supervisor-2, Skills
Execution: backend-core, backend-tax, backend-ledger, frontend, security, devops, api-integration, database, documentation, testing, monitoring, conway-integration

═══════════════════════════════════════════
AGENT WALLET ADDRESSES
═══════════════════════════════════════════
CEO (treasury):  0x9E0e342e4E2Df813B27F078AD0119eD6c289643f
CFO:             0x7B5BE6D949bC3FcD5BBc62fc6cB03a406e187571
CTO:             0x3e127c918C83714616CF2416f8A620F1340C19f1
CMO:             0xEDc68bBC5dF3f0873d33d6654921594Fe42dcbc0
BizDev:          0xfd9CF7e2F1C7e5E937F740a0D8398cef7C44a546
Code:            0xB6C18ec7b13649756436913856eA9F82c13c5c25
Network: Base (chain ID 8453) | USDC: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913

═══════════════════════════════════════════
YOUR TOOLS
═══════════════════════════════════════════
1. get_team_status — live health.json, PM2 processes, recent report file list
2. read_report — read any report or sprint file by path
3. check_wallet_balance — live USDC balance for any agent wallet
4. generate_video — MiniMax AI text-to-video

═══════════════════════════════════════════
RULES
═══════════════════════════════════════════
• Never hallucinate wallet addresses — use only the exact ones above
• Never invent features or capabilities that don't exist
• Be concise and direct — you are talking to your founder
• Respond in first person as CEO at all times`;

// ─── Tool Definitions ────────────────────────────────────────────────────────

const TOOLS = [
  {
    name: 'generate_video',
    description: 'Generate a video using MiniMax AI text-to-video. Returns a task ID and polls for completion. Use this when the founder asks to create a video. Videos take 2-5 minutes to generate.',
    input_schema: {
      type: 'object',
      properties: {
        prompt: {
          type: 'string',
          description: 'Detailed text prompt describing the video content, style, and motion. Be specific about visual elements, colors, and what happens in the video.',
        },
        duration: {
          type: 'number',
          description: 'Duration in seconds (3-10 seconds). Default 6.',
        },
        resolution: {
          type: 'string',
          enum: ['1080p', '720p'],
          description: 'Video resolution. Default 1080p.',
        },
      },
      required: ['prompt'],
    },
  },
  {
    name: 'check_wallet_balance',
    description: 'Check the live USDC balance of an agent wallet on Base mainnet.',
    input_schema: {
      type: 'object',
      properties: {
        agent: {
          type: 'string',
          enum: ['ceo', 'cfo', 'cto', 'cmo', 'bizdev', 'code'],
          description: 'Which agent wallet to check',
        },
      },
      required: ['agent'],
    },
  },
  {
    name: 'get_team_status',
    description: 'Get a full snapshot of the system: health.json, PM2 process status, recent report files, and Supabase user count. Use this whenever the founder asks about the team, agents, system health, or what\'s happening.',
    input_schema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'read_report',
    description: 'Read the content of a specific report file. Use get_team_status first to see available files, then use this to read one.',
    input_schema: {
      type: 'object',
      properties: {
        file_path: {
          type: 'string',
          description: 'Relative path from repo root, e.g. "reports/daily/2026-02-27.md" or "sprints/week-2.json"',
        },
      },
      required: ['file_path'],
    },
  },
];

// ─── HTTP Helpers ─────────────────────────────────────────────────────────────

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

function httpsGet(hostname: string, path: string, headers?: Record<string, string>): Promise<any> {
  return new Promise((resolve, reject) => {
    const req = https.request({ hostname, path, method: 'GET', headers: headers || {} }, (res) => {
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

// ─── Tool Execution ───────────────────────────────────────────────────────────

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

async function executeTool(name: string, input: Record<string, unknown>): Promise<string> {
  if (name === 'check_wallet_balance') {
    const agent = input.agent as keyof typeof AGENT_WALLETS;
    const wallet = AGENT_WALLETS[agent];
    if (!wallet) return `Unknown agent: ${agent}`;
    try {
      const balance = await getLiveUsdcBalance(wallet.address);
      return `${agent.toUpperCase()} wallet: $${balance.toFixed(2)} USDC\nAddress: ${wallet.address}${wallet.treasury ? ' (treasury)' : ''}`;
    } catch (err: any) {
      return `Error fetching balance: ${err.message}`;
    }
  }

  if (name === 'generate_video') {
    if (!MINIMAX_API_KEY) return 'Error: MINIMAX_API_KEY not configured.';
    const prompt = input.prompt as string;
    const duration = (input.duration as number) || 6;
    const resolution = (input.resolution as string) || '1080p';

    try {
      // Submit video generation task
      const submitBody = JSON.stringify({
        model: 'MiniMax-Hailuo-02',
        prompt,
        duration,
        resolution,
        prompt_optimizer: true,
      });

      const submitRes = await httpsPost(
        'api.minimax.io',
        `/v1/video_generation`,
        {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${MINIMAX_API_KEY}`,
        },
        submitBody
      );

      if (submitRes?.base_resp?.status_code !== 0 && submitRes?.base_resp?.status_code !== undefined) {
        return `MiniMax error: ${submitRes.base_resp.status_msg || 'Unknown error'} (code: ${submitRes.base_resp.status_code})`;
      }

      const taskId = submitRes?.task_id;
      if (!taskId) return `Failed to get task ID from MiniMax. Response: ${JSON.stringify(submitRes)}`;

      // Poll for completion (up to 5 min)
      for (let attempt = 0; attempt < 60; attempt++) {
        await new Promise((r) => setTimeout(r, 5000)); // wait 5s between polls
        const statusRes = await httpsGet(
          'api.minimax.io',
          `/v1/query/video_generation?task_id=${taskId}`,
          { 'Authorization': `Bearer ${MINIMAX_API_KEY}` }
        );

        const status = statusRes?.status;
        if (status === 'Success' || status === 'success') {
          const fileId = statusRes?.file_id;
          if (!fileId) return `Video generated but no file_id returned. Task: ${taskId}`;

          // Get download URL
          const fileRes = await httpsGet(
            'api.minimax.io',
            `/v1/files/retrieve?file_id=${fileId}`,
            { 'Authorization': `Bearer ${MINIMAX_API_KEY}` }
          );
          const downloadUrl = fileRes?.file?.download_url;
          return downloadUrl
            ? `✅ Video ready!\n\nDownload: ${downloadUrl}\n\nTask ID: ${taskId}`
            : `✅ Video generated (task: ${taskId}) but download URL not available. File ID: ${fileId}`;
        }

        if (status === 'Failed' || status === 'failed') {
          return `❌ Video generation failed. Task: ${taskId}. Error: ${statusRes?.err_msg || 'Unknown error'}`;
        }

        // Still processing — continue polling
        console.log(`[CeoBot] Video task ${taskId} still processing (attempt ${attempt + 1}, status: ${status})`);
      }

      return `⏱ Video generation timed out after 5 minutes. Task ID: ${taskId}\nCheck status manually at MiniMax dashboard.`;

    } catch (err: any) {
      return `Error generating video: ${err.message}`;
    }
  }

  if (name === 'get_team_status') {
    try {
      const lines: string[] = [];

      // 1. Health snapshot
      const healthFile = path.join(ROOT, 'health.json');
      if (existsSync(healthFile)) {
        const h = JSON.parse(readFileSync(healthFile, 'utf-8'));
        lines.push(`=== SYSTEM HEALTH ===`);
        lines.push(`Status: ${h.status} | Phase: ${h.phase}`);
        lines.push(`Last heartbeat: ${h.last_heartbeat}`);
        lines.push(`API: ${h.checks?.api_status} | DB: ${h.checks?.database_status}`);
        if (h.beta) {
          lines.push(`Beta day: ${h.beta.day_number} | Users onboarded: ${h.beta.agents_onboarded}`);
        }
        if (h.financials) {
          lines.push(`MRR: $${h.financials.mrr} | Monthly spend: $${h.financials.monthly_spend}`);
        }
      }

      // 2. PM2 processes
      try {
        const pm2Raw = execSync('pm2 jlist 2>/dev/null', { encoding: 'utf-8', timeout: 5000 });
        const procs = JSON.parse(pm2Raw) as Array<{ name: string; pm2_env: { status: string; restart_time: number }; pid: number }>;
        lines.push(`\n=== PM2 PROCESSES ===`);
        for (const p of procs) {
          lines.push(`${p.name}: ${p.pm2_env.status} (pid ${p.pid}, restarts: ${p.pm2_env.restart_time})`);
        }
      } catch { lines.push(`\nPM2: (could not read)`); }

      // 3. Recent daily reports
      const dailyDir = path.join(ROOT, 'reports/daily');
      if (existsSync(dailyDir)) {
        const files = readdirSync(dailyDir).sort().reverse().slice(0, 5);
        lines.push(`\n=== RECENT DAILY REPORTS ===`);
        lines.push(files.length ? files.map(f => `reports/daily/${f}`).join('\n') : '(none)');
      }

      // 4. Latest CMO / CTO report refs
      const cmoDir = path.join(ROOT, 'reports/cmo');
      if (existsSync(cmoDir)) {
        const files = readdirSync(cmoDir).filter(f => f.endsWith('.md')).sort().reverse().slice(0, 3);
        lines.push(`\n=== RECENT CMO REPORTS ===`);
        lines.push(files.length ? files.map(f => `reports/cmo/${f}`).join('\n') : '(none)');
      }

      const ctoDir = path.join(ROOT, 'reports/cto');
      if (existsSync(ctoDir)) {
        const files = readdirSync(ctoDir).filter(f => f.endsWith('.md')).sort().reverse().slice(0, 3);
        lines.push(`\n=== RECENT CTO REPORTS ===`);
        lines.push(files.length ? files.map(f => `reports/cto/${f}`).join('\n') : '(none)');
      }

      // 5. Current sprint
      const sprintsDir = path.join(ROOT, 'sprints');
      if (existsSync(sprintsDir)) {
        const sprintFiles = readdirSync(sprintsDir).filter(f => f.endsWith('.json')).sort().reverse();
        if (sprintFiles.length) lines.push(`\n=== CURRENT SPRINT ===\nLatest: sprints/${sprintFiles[0]}`);
      }

      // 6. Auth users count from Supabase env
      lines.push(`\n=== SUPABASE PROJECT ===`);
      lines.push(`URL: ${process.env.SUPABASE_URL || '(not set)'}`);

      return lines.join('\n');
    } catch (err: any) {
      return `Error getting team status: ${err.message}`;
    }
  }

  if (name === 'read_report') {
    const filePath = input.file_path as string;
    // Safety: only allow reading within ROOT, no path traversal
    const absPath = path.resolve(ROOT, filePath);
    if (!absPath.startsWith(ROOT)) return 'Access denied: path outside repo root.';
    try {
      if (!existsSync(absPath)) return `File not found: ${filePath}`;
      const content = readFileSync(absPath, 'utf-8');
      // Truncate if too long
      return content.length > 6000 ? content.slice(0, 6000) + '\n\n[... truncated]' : content;
    } catch (err: any) {
      return `Error reading file: ${err.message}`;
    }
  }

  return `Unknown tool: ${name}`;
}

// ─── Live Context Builder ─────────────────────────────────────────────────────

async function buildLiveContext(): Promise<string> {
  const lines: string[] = ['\n\n═══════════════════════════════════════════\nLIVE SYSTEM SNAPSHOT (auto-loaded)\n═══════════════════════════════════════════'];
  try {
    // Health
    const healthFile = path.join(ROOT, 'health.json');
    if (existsSync(healthFile)) {
      const h = JSON.parse(readFileSync(healthFile, 'utf-8'));
      lines.push(`System: ${h.status} | Phase: ${h.phase} | Heartbeat: ${h.last_heartbeat}`);
      lines.push(`API: ${h.checks?.api_status} | DB: ${h.checks?.database_status} | MRR: $${h.financials?.mrr ?? 0} | Spend: $${h.financials?.monthly_spend ?? 0}/mo`);
      if (h.beta) lines.push(`Beta day ${h.beta.day_number} | Users: ${h.beta.agents_onboarded} onboarded`);
    }
    // PM2
    try {
      const pm2Raw = execSync('pm2 jlist 2>/dev/null', { encoding: 'utf-8', timeout: 4000 });
      const procs = JSON.parse(pm2Raw) as Array<{ name: string; pm2_env: { status: string; restart_time: number } }>;
      lines.push(`PM2: ${procs.map(p => `${p.name}=${p.pm2_env.status}(↺${p.pm2_env.restart_time})`).join(' | ')}`);
    } catch { /* skip */ }
    // Latest reports
    const latestFile = (dir: string, ext = '.md') => {
      if (!existsSync(dir)) return null;
      const files = readdirSync(dir).filter(f => f.endsWith(ext)).sort().reverse();
      return files[0] ? path.join(dir, files[0]) : null;
    };
    const latestDaily = latestFile(path.join(ROOT, 'reports/daily'));
    if (latestDaily) {
      const content = readFileSync(latestDaily, 'utf-8');
      lines.push(`\n--- LATEST DAILY REPORT (${path.basename(latestDaily)}) ---\n${content.slice(0, 1500)}`);
    }
    // Prefer current.json for sprint, fall back to latest week-N.json
    const sprintsDir = path.join(ROOT, 'sprints');
    const currentSprint = path.join(sprintsDir, 'current.json');
    const sprintFile = existsSync(currentSprint) ? currentSprint : latestFile(sprintsDir, '.json');
    if (sprintFile) {
      const content = readFileSync(sprintFile, 'utf-8');
      lines.push(`\n--- CURRENT SPRINT (${path.basename(sprintFile)}) ---\n${content.slice(0, 1200)}`);
    }

    // Agent roster from health.json
    const healthFile2 = path.join(ROOT, 'health.json');
    if (existsSync(healthFile2)) {
      const h = JSON.parse(readFileSync(healthFile2, 'utf-8'));
      if (h.agents?.agents) {
        const agentLines = Object.entries(h.agents.agents as Record<string, { status: string; model: string; last_session: string | null }>)
          .map(([name, a]) => `  ${name}: ${a.status} (${a.model}) last_session=${a.last_session ?? 'none'}`);
        lines.push(`\n--- AGENT ROSTER (${agentLines.length} agents) ---\n${agentLines.join('\n')}`);
      }
    }
  } catch { /* always return something */ }
  lines.push('═══════════════════════════════════════════');
  return lines.join('\n');
}

// ─── Claude with Tool Use ─────────────────────────────────────────────────────

const conversationHistory = new Map<number, Message[]>();

async function callClaudeWithTools(userId: number, userMessage: string, onToolCall?: (name: string) => void): Promise<string> {
  if (!conversationHistory.has(userId)) conversationHistory.set(userId, []);
  const history = conversationHistory.get(userId)!;
  history.push({ role: 'user', content: userMessage });
  if (history.length > 20) history.splice(0, history.length - 20);

  // Agentic loop — keep calling Claude until no more tool calls
  let iterations = 0;
  while (iterations < 10) {
    iterations++;

    const body = JSON.stringify({
      model: 'claude-sonnet-4-5',
      max_tokens: 4096,
      system: SYSTEM_PROMPT + await buildLiveContext(),
      tools: TOOLS,
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

    const stopReason = response?.stop_reason;
    const content: ContentBlock[] = response?.content || [];

    // Push assistant message to history
    history.push({ role: 'assistant', content });

    if (stopReason === 'tool_use') {
      // Execute all tool calls in parallel
      const toolUseBlocks = content.filter((b: ContentBlock) => b.type === 'tool_use');
      const toolResults: ContentBlock[] = [];

      for (const toolBlock of toolUseBlocks) {
        const toolName = toolBlock.name!;
        const toolInput = toolBlock.input as Record<string, unknown>;
        console.log(`[CeoBot] Tool call: ${toolName}`, toolInput);
        if (onToolCall) onToolCall(toolName);

        const result = await executeTool(toolName, toolInput);
        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolBlock.id,
          content: result,
        });
      }

      // Add tool results to history and continue loop
      history.push({ role: 'user', content: toolResults });
      continue;
    }

    // End of agentic loop — extract text response
    const textBlock = content.find((b: ContentBlock) => b.type === 'text');
    const reply = textBlock?.text || 'No response.';
    // Update last history entry with clean text
    history[history.length - 1] = { role: 'assistant', content: reply };
    return reply;
  }

  return '⚠️ Reached max tool call iterations.';
}

// ─── System Status ────────────────────────────────────────────────────────────

async function getSystemStatus(): Promise<string> {
  return `📊 *System Status*\n\nEnvironment: ${process.env.NODE_ENV || 'production'}\nUptime: ${Math.floor(process.uptime() / 60)}m ${Math.floor(process.uptime() % 60)}s\nMemory: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB used\nAPI: https://invoica.wp1.host/v1/health`;
}

// ─── Telegram Update Handler ──────────────────────────────────────────────────

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
    if (from.id === ALLOWED_USER_ID) process.env.OWNER_TELEGRAM_CHAT_ID = chatId.toString();
    await telegramSend('sendMessage', {
      chat_id: chatId,
      parse_mode: 'Markdown',
      text: `👋 Welcome back, ${from.first_name}.\n\nInvoica CEO assistant.\n\n*Commands:*\n/status — System health\n/wallets — Agent wallet balances\n/approve_topup <id> — Approve top-up\n/reject_topup <id> — Reject top-up\n/clear — Clear conversation\n/help — Show menu\n\nOr chat naturally — I can also generate videos via MiniMax.`,
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
    await telegramSend('sendMessage', { chat_id: chatId, text: '🧹 Conversation cleared.' });
    return;
  }

  if (text === '/help') {
    await telegramSend('sendMessage', {
      chat_id: chatId,
      parse_mode: 'Markdown',
      text: `📋 *Commands*\n\n/status — Platform health\n/wallets — Agent wallet balances\n/approve_topup <id> — Approve top-up\n/reject_topup <id> — Reject top-up\n/clear — Reset conversation\n\n*Available AI capabilities:*\n• Generate videos (MiniMax Hailuo-02)\n• Check live wallet balances\n• General questions & planning\n\n*What I cannot do:*\n• Execute trades or transactions\n• Access external APIs beyond my tools\n• Generate images\n• Post to social media`,
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
      await telegramSend('sendMessage', { chat_id: chatId, text: `✅ Approved. Executing transfer...` });
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
      await telegramSend('sendMessage', { chat_id: chatId, text: `🚫 Top-up ${requestId.slice(0, 8)}... rejected.` });
    } catch (err: any) {
      await telegramSend('sendMessage', { chat_id: chatId, text: `❌ Error: ${err.message}` });
    }
    return;
  }

  // ── Default: Claude with tools ──
  await telegramSend('sendChatAction', { chat_id: chatId, action: 'typing' });

  try {
    // For video generation, warn it'll take a few minutes
    const isVideoRequest = /video|generate.*video|create.*video|make.*video|film|animation/i.test(text);
    if (isVideoRequest) {
      await telegramSend('sendMessage', {
        chat_id: chatId,
        text: '🎬 Generating video via MiniMax... this takes 2-5 minutes. I\'ll send it when ready.',
      });
    }

    const reply = await callClaudeWithTools(from.id, text, (toolName) => {
      if (toolName === 'generate_video') {
        console.log('[CeoBot] Starting MiniMax video generation...');
      }
    });

    // Split long messages
    if (reply.length > 4000) {
      const chunks = reply.match(/.{1,4000}/gs) || [reply];
      for (const chunk of chunks) {
        await telegramSend('sendMessage', { chat_id: chatId, text: chunk });
      }
    } else {
      await telegramSend('sendMessage', { chat_id: chatId, text: reply });
    }
  } catch (err) {
    console.error('[CeoBot] Error:', err);
    await telegramSend('sendMessage', { chat_id: chatId, text: '⚠️ Error. Check ANTHROPIC_API_KEY.' });
  }
}

// ─── Wallet Monitor ───────────────────────────────────────────────────────────

async function startWalletMonitor(): Promise<void> {
  const checkWallets = async () => {
    try {
      const ownerChatId = process.env.OWNER_TELEGRAM_CHAT_ID;
      if (!ownerChatId) return;
      const { getAgentWallets } = await import('../../../scripts/wallet-service');
      const wallets = await getAgentWallets();
      if (!wallets) return;
      for (const w of wallets) {
        if (Number(w.usdc_balance) < Number(w.low_balance_threshold)) {
          await telegramSend('sendMessage', {
            chat_id: ownerChatId,
            parse_mode: 'Markdown',
            text: `🔴 *Low Wallet Alert*\n\nAgent: \`${w.agent_name}\`\nBalance: $${Number(w.usdc_balance).toFixed(2)} USDC\nThreshold: $${Number(w.low_balance_threshold).toFixed(2)} USDC\n\nUse /approve_topup <request_id> to fund.`,
          });
        }
      }
    } catch (err) {
      console.error('[CeoBot] Wallet monitor error:', err);
    }
  };
  setTimeout(() => { checkWallets(); setInterval(checkWallets, 60_000); }, 30_000);
  console.log('[CeoBot] Wallet monitor started (60s interval).');
}

// ─── Entry Point ──────────────────────────────────────────────────────────────

export async function startCeoBot(): Promise<void> {
  if (!TELEGRAM_TOKEN) {
    console.log('[CeoBot] CEO_TELEGRAM_BOT_TOKEN not set — skipping');
    return;
  }
  console.log('[CeoBot] Starting CEO executive bot with tool use (MiniMax video + wallet checks)...');
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
