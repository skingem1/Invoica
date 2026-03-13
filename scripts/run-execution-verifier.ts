#!/usr/bin/env ts-node

/**
 * run-execution-verifier.ts — Cross-check sprint task completion vs actual file deliverables
 *
 * Implements CTO-20260215-001: "Add Execution Verification Agent to catch silent failures"
 * CEO conditions: run before daily report, flag discrepancies, require manual audit on failure.
 *
 * Usage:
 *   npx ts-node scripts/run-execution-verifier.ts [--sprint=path/to/sprint.json]
 *
 * Exit code: 0 = all verified, 1 = discrepancies found
 */

import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as dotenv from 'dotenv'; dotenv.config({ override: true });

// ── Config ───────────────────────────────────────────────────────────────────

const ROOT         = path.resolve(__dirname, '..');
const SPRINTS_DIR  = path.join(ROOT, 'sprints');
const REPORT_DIR   = path.join(ROOT, 'reports', 'cto', 'execution-verification');
const TODAY        = new Date().toISOString().slice(0, 10);
const REPORT_FILE  = path.join(REPORT_DIR, `${TODAY}.md`);

const SPRINT_ARG   = process.argv.find(a => a.startsWith('--sprint='))?.split('=')[1];

// ── Helpers ──────────────────────────────────────────────────────────────────

function log(msg: string) { console.log(`[Verifier] ${msg}`); }

/** Find the most recently modified sprint JSON that has done/approved tasks. */
function findLatestSprint(): string | null {
  if (SPRINT_ARG) return path.resolve(ROOT, SPRINT_ARG);
  const files = fs.readdirSync(SPRINTS_DIR)
    .filter(f => f.endsWith('.json') && !f.includes('test'))
    .map(f => ({ file: f, mtime: fs.statSync(path.join(SPRINTS_DIR, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);
  for (const { file } of files) {
    try {
      const raw = JSON.parse(fs.readFileSync(path.join(SPRINTS_DIR, file), 'utf8'));
      const tasks = raw.tasks ?? [];
      if (tasks.some((t: { status: string }) => t.status === 'done' || t.status === 'approved')) {
        return path.join(SPRINTS_DIR, file);
      }
    } catch { /* skip malformed */ }
  }
  return null;
}

// ── Types ────────────────────────────────────────────────────────────────────

interface SprintTask {
  id: string;
  description?: string;
  status: string;
  deliverables?: { code?: string[]; tests?: string[]; docs?: string[] };
}

interface VerificationResult {
  taskId: string;
  description: string;
  status: string;
  files: string[];
  missingFiles: string[];
  pass: boolean;
}

// ── Core verification logic ──────────────────────────────────────────────────

function verifyTask(task: SprintTask): VerificationResult {
  const allFiles = [
    ...(task.deliverables?.code ?? []),
    ...(task.deliverables?.tests ?? []),
    ...(task.deliverables?.docs ?? []),
  ];
  const missingFiles = allFiles.filter(f => !fs.existsSync(path.join(ROOT, f)));
  return {
    taskId: task.id,
    description: task.description ?? '(no description)',
    status: task.status,
    files: allFiles,
    missingFiles,
    pass: missingFiles.length === 0,
  };
}

// ── Claude analysis (optional) ───────────────────────────────────────────────

async function claudeAnalyze(failures: VerificationResult[]): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return '(Claude analysis skipped — ANTHROPIC_API_KEY not set)';

  const prompt = `You are the Invoica Execution Verifier.\n\nThe following sprint tasks have status 'done' or 'approved' but their deliverable files are MISSING from disk:\n\n${failures.map(f => `- [${f.taskId}] ${f.description}\n  Missing: ${f.missingFiles.join(', ')}`).join('\n')}\n\nAnalyze each discrepancy and state:\n1. Likely root cause\n2. Whether this is a false positive (e.g. file moved/renamed) or genuine failure\n3. Recommended action (manual audit / re-run task / investigate orchestrator logs)\n\nKeep your response concise and structured.`;

  return new Promise((resolve) => {
    const body = JSON.stringify({
      model: 'claude-sonnet-4-5',
      max_tokens: 600,
      messages: [{ role: 'user', content: prompt }],
    });
    const req = https.request({
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
    }, (res) => {
      let data = '';
      res.on('data', c => { data += c; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed.content?.[0]?.text ?? '(no response)');
        } catch { resolve('(Claude response parse error)'); }
      });
    });
    req.on('error', () => resolve('(Claude request failed)'));
    req.write(body);
    req.end();
  });
}

// ── Report writer ────────────────────────────────────────────────────────────

function writeReport(
  sprintFile: string,
  results: VerificationResult[],
  claudeVerdict: string,
): void {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  const passes  = results.filter(r => r.pass);
  const failures = results.filter(r => !r.pass);

  const lines = [
    `# Execution Verification Report — ${TODAY}`,
    `## Sprint: ${path.basename(sprintFile)}`,
    `## Verified: ${results.length} tasks | Passed: ${passes.length} | Failed: ${failures.length}`,
    '',
    '### PASS',
    ...passes.map(r => `- [${r.taskId}] ${r.files.map(f => `\`${f}\``).join(', ')} ✅`),
    '',
    failures.length > 0 ? '### FAIL — Requires Manual Audit' : '### FAIL',
    ...failures.map(r =>
      `- [${r.taskId}] ${r.description}\n  Missing: ${r.missingFiles.map(f => `\`${f}\``).join(', ')} ❌`
    ),
    '',
    '### Claude Analysis',
    claudeVerdict,
    '',
  ];
  fs.writeFileSync(REPORT_FILE, lines.join('\n'));
  log(`Report written: ${REPORT_FILE}`);
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  log(`Starting execution verification — ${TODAY}`);

  const sprintFile = findLatestSprint();
  if (!sprintFile) { log('No sprint with done/approved tasks found — nothing to verify.'); process.exit(0); }
  log(`Checking sprint: ${path.basename(sprintFile)}`);

  const raw = JSON.parse(fs.readFileSync(sprintFile, 'utf8'));
  const tasks: SprintTask[] = (raw.tasks ?? []).filter(
    (t: SprintTask) => t.status === 'done' || t.status === 'approved'
  );
  log(`Found ${tasks.length} done/approved task(s) to verify`);

  const results = tasks.map(verifyTask);
  const failures = results.filter(r => !r.pass);

  results.forEach(r => {
    if (r.pass) log(`  ✅ ${r.taskId} — all ${r.files.length} file(s) present`);
    else log(`  ❌ ${r.taskId} — MISSING: ${r.missingFiles.join(', ')}`);
  });

  let claudeVerdict = '';
  if (failures.length > 0) {
    log(`${failures.length} discrepancy(ies) found — calling Claude for analysis...`);
    claudeVerdict = await claudeAnalyze(failures);
  } else {
    claudeVerdict = 'All deliverables verified. No discrepancies found.';
  }

  writeReport(sprintFile, results, claudeVerdict);

  if (failures.length > 0) {
    log(`RESULT: ❌ ${failures.length} task(s) FAILED verification — manual audit required`);
    process.exit(1);
  }
  log(`RESULT: ✅ All ${results.length} task(s) verified`);
  process.exit(0);
}

main().catch(err => { console.error('[Verifier] Fatal:', err); process.exit(1); });
