#!/usr/bin/env ts-node
/**
 * pm2-process-watchdog.ts
 *
 * Runs every 5 minutes (PM2 cron). Checks critical processes are online.
 * Sends a Telegram alert if any critical process is stopped or errored.
 * Alert throttling: max 1 alert per process per 30 minutes (state in watchdog-last-alert.json).
 *
 * Critical processes: backend, ceo-ai-bot, openclaw-gateway
 * Cron-based processes (x-admin-post, cmo-weekly etc.) are NOT checked
 * because they stop between scheduled runs.
 */

import { execSync } from 'child_process';
import * as https from 'https';
import * as fs from 'fs';
import * as path from 'path';
import 'dotenv/config';

const CRITICAL_PROCESSES = ['backend', 'ceo-ai-bot', 'openclaw-gateway'];
// Note: sprint-runner intentionally excluded -- stops after each sprint run

const ALERT_THROTTLE_MS = 30 * 60 * 1000; // 30 minutes
const ALERT_STATE_FILE  = path.join('/home/invoica/apps/Invoica/logs', 'watchdog-last-alert.json');

interface Pm2Process {
  name: string;
  pm2_env: {
    status: string;
    unstable_restarts: number;
    restart_time: number;
  };
}

// Returns true if this process alert should be suppressed (sent within last 30 min).
function isThrottled(processName: string): boolean {
  try {
    if (!fs.existsSync(ALERT_STATE_FILE)) return false;
    const state: Record<string, number> = JSON.parse(fs.readFileSync(ALERT_STATE_FILE, 'utf-8'));
    const last = state[processName];
    if (!last) return false;
    return Date.now() - last < ALERT_THROTTLE_MS;
  } catch {
    return false;
  }
}

// Records the current timestamp for a set of process names (those alerted this run).
function recordAlerts(processNames: string[]): void {
  try {
    let state: Record<string, number> = {};
    if (fs.existsSync(ALERT_STATE_FILE)) {
      try { state = JSON.parse(fs.readFileSync(ALERT_STATE_FILE, 'utf-8')); } catch { /* ignore */ }
    }
    const now = Date.now();
    for (const name of processNames) {
      state[name] = now;
    }
    fs.mkdirSync(path.dirname(ALERT_STATE_FILE), { recursive: true });
    fs.writeFileSync(ALERT_STATE_FILE, JSON.stringify(state, null, 2));
  } catch (e: any) {
    console.warn(`[watchdog] Could not write alert state: ${e.message}`);
  }
}

function sendTelegram(message: string): Promise<void> {
  const botToken = process.env.CEO_TELEGRAM_BOT_TOKEN;
  const chatId   = process.env.OWNER_TELEGRAM_CHAT_ID || process.env.CEO_TELEGRAM_CHAT_ID;
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
    // PM2 sometimes prepends warning lines before the JSON array
    const jsonStart = raw.indexOf('[');
    if (jsonStart === -1) throw new Error('No JSON array found in pm2 jlist output');
    pm2List = JSON.parse(raw.slice(jsonStart));
  } catch (e: any) {
    console.error(`[watchdog] Could not read PM2 process list: ${e.message}`);
    process.exit(1);  // treat as watchdog failure, not success
  }

  const processMap = new Map(pm2List.map(p => [p.name, p]));
  const issues: string[] = [];
  const issueProcesses: string[] = [];

  for (const name of CRITICAL_PROCESSES) {
    const proc = processMap.get(name);
    if (!proc) {
      issues.push(`- ${name}: NOT FOUND in PM2 list`);
      issueProcesses.push(name);
      continue;
    }
    const status   = proc.pm2_env?.status ?? 'unknown';
    const restarts = proc.pm2_env?.restart_time ?? 0;
    // Skip transient states — 'launching' and 'stopping' resolve in seconds
    // and alerting on them causes false-positive Telegram spam
    const TRANSIENT_STATES = new Set(['launching', 'stopping', 'waiting restart']);
    if (status !== 'online' && !TRANSIENT_STATES.has(status)) {
      issues.push(`- ${name}: status=${status}, restarts=${restarts}`);
      issueProcesses.push(name);
    }
  }

  if (issues.length === 0) {
    console.log(`[watchdog] All ${CRITICAL_PROCESSES.length} critical processes online`);
    process.exit(0);
  }

  // Filter out processes whose alerts were already sent within the throttle window.
  const throttledProcesses  = issueProcesses.filter(n => isThrottled(n));
  const unthrottledProcesses = issueProcesses.filter(n => !isThrottled(n));
  const unthrottledIssues   = issues.filter((_, i) => !isThrottled(issueProcesses[i]));

  console.log(`[watchdog] ALERT -- ${issues.length} process(es) down:`);
  issues.forEach(i => console.log(i));

  if (throttledProcesses.length > 0) {
    console.log(`[watchdog] Throttled (alert already sent <30 min ago): ${throttledProcesses.join(', ')}`);
  }

  if (unthrottledIssues.length === 0) {
    console.log('[watchdog] All alerts throttled -- skipping Telegram send');
    process.exit(1);
  }

  const alert = [
    'Invoica Process Watchdog Alert',
    '',
    `${unthrottledIssues.length} critical process(es) are DOWN:`,
    ...unthrottledIssues,
    '',
    'Run: pm2 list        -- to investigate',
    'Run: pm2 restart <name> -- to recover',
  ].join('\n');

  await sendTelegram(alert);
  recordAlerts(unthrottledProcesses);
  process.exit(1);
}

main().catch(e => { console.error('[watchdog] Fatal:', e); process.exit(1); });
