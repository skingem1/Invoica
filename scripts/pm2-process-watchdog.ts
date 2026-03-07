#!/usr/bin/env ts-node
/**
 * pm2-process-watchdog.ts
 *
 * Runs every 5 minutes (PM2 cron). Checks critical processes are online.
 * Sends a Telegram alert if any critical process is stopped or errored.
 *
 * Critical processes: backend, ceo-ai-bot, openclaw-gateway
 * Cron-based processes (x-admin-post, cmo-weekly etc.) are NOT checked
 * because they stop between scheduled runs.
 */

import { execSync } from 'child_process';
import * as https from 'https';
import 'dotenv/config';

const CRITICAL_PROCESSES = ['backend', 'ceo-ai-bot', 'openclaw-gateway'];
// Note: sprint-runner intentionally excluded -- stops after each sprint run

interface Pm2Process {
  name: string;
  pm2_env: {
    status: string;
    unstable_restarts: number;
    restart_time: number;
  };
}

function sendTelegram(message: string): Promise<void> {
  const botToken = process.env.CEO_TELEGRAM_BOT_TOKEN;
  const chatId   = process.env.OWNER_TELEGRAM_CHAT_ID;
  if (!botToken || !chatId) {
    console.log('[watchdog] Telegram not configured -- skipping alert');
    return Promise.resolve();
  }
  return new Promise(resolve => {
    const body = JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'Markdown' });
    const req = https.request(
      {
        hostname: 'api.telegram.org',
        path: `/bot${botToken}/sendMessage`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      res => { res.resume(); res.on('end', resolve); }
    );
    req.on('error', () => resolve());
    req.write(body);
    req.end();
  });
}

async function main() {
  let pm2List: Pm2Process[];
  try {
    const raw = execSync('pm2 jlist', { encoding: 'utf-8', timeout: 10000 });
    pm2List = JSON.parse(raw);
  } catch (e: any) {
    console.log(`[watchdog] Could not read PM2 process list: ${e.message}`);
    process.exit(0);
  }

  const processMap = new Map(pm2List.map(p => [p.name, p]));
  const issues: string[] = [];

  for (const name of CRITICAL_PROCESSES) {
    const proc = processMap.get(name);
    if (!proc) {
      issues.push(`- ${name}: NOT FOUND in PM2 list`);
      continue;
    }
    const status   = proc.pm2_env?.status ?? 'unknown';
    const restarts = proc.pm2_env?.restart_time ?? 0;
    if (status !== 'online') {
      issues.push(`- ${name}: status=${status}, restarts=${restarts}`);
    }
  }

  if (issues.length === 0) {
    console.log(`[watchdog] All ${CRITICAL_PROCESSES.length} critical processes online`);
    process.exit(0);
  }

  const alert = [
    'Invoica Process Watchdog Alert',
    '',
    `${issues.length} critical process(es) are DOWN:`,
    ...issues,
    '',
    'Run: pm2 list        -- to investigate',
    'Run: pm2 restart <name> -- to recover',
  ].join('\n');

  console.log(`[watchdog] ALERT -- ${issues.length} process(es) down:`);
  issues.forEach(i => console.log(i));
  await sendTelegram(alert);
  process.exit(1);
}

main().catch(e => { console.error('[watchdog] Fatal:', e); process.exit(1); });
