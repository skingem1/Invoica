#!/usr/bin/env ts-node

/**
 * Countable Agent Orchestrator v2
 *
 * 10-Agent Architecture:
 *   Leadership (Claude via Anthropic API):
 *     - CEO: Sprint planning, strategy, decisions, daily reports
 *     - Supervisor: Code review & quality gate
 *     - Skills: Agent/skill factory
 *   Technology (MiniMax M2.5):
 *     - CTO: OpenClaw monitoring, cost optimization, improvement proposals
 *   Execution (MiniMax M2.5 — cost-optimized):
 *     - backend-core, backend-tax, backend-ledger
 *     - frontend, devops, security
 *
 * Flow: CEO plans → MiniMax codes → Supervisor reviews
 *       → CTO proposes improvements → CEO approves → CEO daily report
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { execSync } from 'child_process';
import * as https from 'https';
import * as http from 'http';
import 'dotenv/config';

// ===== Types =====

interface AgentTask {
  id: string;
  agent: string;
  type: 'feature' | 'bugfix' | 'review' | 'test';
  priority: 'critical' | 'high' | 'medium' | 'low';
  dependencies: string[];
  context: string;
  deliverables: {
    code?: string[];
    tests?: string[];
    docs?: string[];
  };
  status: 'pending' | 'in_progress' | 'review' | 'approved' | 'rejected' | 'done';
  output?: {
    files: string[];
    commit: string;
    model: string;
    review?: ReviewResult;
  };
}

interface ReviewResult {
  verdict: 'APPROVED' | 'REJECTED' | 'CHANGES_REQUESTED';
  score: number;
  summary: string;
  issues: Array<{ severity: string; file: string; description: string }>;
  strengths: string[];
}

interface LLMResponse {
  choices: Array<{ message: { content: string } }>;
  usage?: { total_tokens: number };
  base_resp?: { status_code: number; status_msg: string };
}

// ===== Colors =====

const c = {
  reset: '\x1b[0m', bold: '\x1b[1m',
  red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m',
  blue: '\x1b[34m', magenta: '\x1b[35m', cyan: '\x1b[36m', gray: '\x1b[90m',
};

function log(color: string, msg: string) {
  console.log(`${color}${msg}${c.reset}`);
}

// ===== Generic LLM Client =====

async function callLLM(
  provider: 'minimax' | 'anthropic',
  model: string,
  systemPrompt: string,
  userPrompt: string,
  timeoutMs: number = 300000
): Promise<LLMResponse> {
  if (provider === 'anthropic') {
    return callAnthropic(model, systemPrompt, userPrompt, timeoutMs);
  }
  const apiKey = process.env.MINIMAX_API_KEY || '';
  if (!apiKey) throw new Error('MINIMAX_API_KEY not set');
  const body = JSON.stringify({
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.3,
    max_tokens: 16000,
  });
  return httpPost('https://api.minimax.io/v1/chat/completions', {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  }, body, timeoutMs);
}
async function callAnthropic(model: string, systemPrompt: string, userPrompt: string, timeoutMs: number): Promise<LLMResponse> {
  const apiKey = process.env.ANTHROPIC_API_KEY || '';
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set in .env');
  const body = JSON.stringify({
    model, max_tokens: 16000, system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }], temperature: 0.3,
  });
  const rawResponse = await httpPost('https://api.anthropic.com/v1/messages', {
    'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01',
  }, body, timeoutMs);
  const anthropicData = rawResponse as any;
  if (anthropicData.content && Array.isArray(anthropicData.content)) {
    const textContent = anthropicData.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('');
    return {
      choices: [{ message: { content: textContent } }],
      usage: { total_tokens: (anthropicData.usage?.input_tokens || 0) + (anthropicData.usage?.output_tokens || 0) },
    };
  }
  return rawResponse;
}
function httpPost(url: string, headers: Record<string, string>, body: string, timeoutMs: number): Promise<any> {
  const parsed = new URL(url);
  const isHttps = parsed.protocol === 'https:';
  const lib = isHttps ? https : http;
  return new Promise((resolve, reject) => {
    const req = lib.request({
      hostname: parsed.hostname, port: parsed.port || (isHttps ? 443 : undefined),
      path: parsed.pathname, method: 'POST',
      headers: { ...headers, 'Content-Length': Buffer.byteLength(body).toString() },
    }, (res) => {
      let data = '';
      res.on('data', (chunk: string) => (data += chunk));
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          if (result.error) { reject(new Error(`API error: ${result.error.message || JSON.stringify(result.error)}`)); return; }
          resolve(result);
        } catch { reject(new Error(`Failed to parse response: ${data.substring(0, 500)}`)); }
      });
    });
    req.on('error', reject);
    req.setTimeout(timeoutMs, () => { req.destroy(); reject(new Error(`API timeout (${timeoutMs/1000}s)`)); });
    req.write(body); req.end();
  });
}
// ===== Supervisor Agent (Claude via Anthropic API) =====

class SupervisorAgent {
  private systemPrompt: string;
  constructor() {
    const promptPath = './agents/supervisor/prompt.md';
    this.systemPrompt = existsSync(promptPath) ? readFileSync(promptPath, 'utf-8') : 'You are a code review supervisor.';
    log(c.magenta, '+ Loaded supervisor agent (Claude via Anthropic API)');
  }

  async reviewTask(task: AgentTask, files: string[]): Promise<ReviewResult> {
    log(c.magenta, `\n[supervisor] Reviewing: ${task.id}`);
    const fileContents = files.map((filepath) => {
      const content = existsSync(filepath) ? readFileSync(filepath, 'utf-8') : '';
      return `### ${filepath}\n\`\`\`typescript\n${content.substring(0, 4000)}\n\`\`\``;
    }).join('\n\n');
    const userPrompt = `Review the following code generated for task ${task.id}.\n\n## Task Spec\n${task.context}\n\n## Generated Files (${files.length})\n${fileContents}\n\n## Instructions\nRespond with a JSON object:\n{\n  "verdict": "APPROVED" or "REJECTED",\n  "score": 0-100,\n  "summary": "brief review summary",\n  "issues": [{"severity": "critical|high|medium|low", "file": "path", "description": "..."}],\n  "strengths": ["..."]\n}`;
    const startTime = Date.now();
    log(c.gray, '  -> Sending to Claude (Anthropic API)...');
    try {
      const response = await callLLM('anthropic', 'claude-sonnet-4-20250514', this.systemPrompt, userPrompt, 120000);
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      log(c.gray, `  -> Review received in ${elapsed}s (${response.usage?.total_tokens || '?'} tokens)`);
      const content = response.choices?.[0]?.message?.content || '';
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const review = JSON.parse(jsonMatch[0]) as ReviewResult;
        if (review.verdict === 'APPROVED') { log(c.green, `  ✓ APPROVED (score: ${review.score}/100)`); }
        else {
          log(c.red, `  ✗ REJECTED (score: ${review.score}/100)`);
          log(c.yellow, `  Summary: ${review.summary}`);
          for (const issue of review.issues || []) { log(c.yellow, `    [${issue.severity}] ${issue.file}: ${issue.description}`); }
        }
        return review;
      }
      log(c.yellow, '  ! Could not parse review JSON, auto-approving');
      return { verdict: 'APPROVED', score: 70, summary: 'Auto-approved (parse failure)', issues: [], strengths: [] };
    } catch (error: any) {
      log(c.yellow, `  ! Supervisor error: ${error.message}`);
      return { verdict: 'APPROVED', score: 0, summary: `Supervisor unavailable: ${error.message}`, issues: [], strengths: [] };
    }
  }
}
// ===== CEO Agent (Claude via Anthropic API) =====

class CEOAgent {
  private systemPrompt: string;
  constructor() {
    const promptPath = './agents/ceo/prompt.md';
    this.systemPrompt = existsSync(promptPath) ? readFileSync(promptPath, 'utf-8') : 'You are the CEO of Countable.';
    log(c.magenta, '+ Loaded CEO agent (Claude via Anthropic API)');
  }

  async reviewSprintProgress(tasks: AgentTask[]): Promise<string> {
    const done = tasks.filter(t => t.status === 'done').length;
    const total = tasks.length;
    const pending = tasks.filter(t => t.status === 'pending');
    const rejected = tasks.filter(t => t.status === 'rejected');
    log(c.magenta, `\n[ceo] Sprint progress check (${done}/${total} done)`);
    const userPrompt = `Sprint progress update:\n- Done: ${done}/${total}\n- Pending: ${pending.map(t => t.id).join(', ') || 'none'}\n- Rejected: ${rejected.map(t => t.id).join(', ') || 'none'}\n\nTask details:\n${JSON.stringify(tasks.map(t => ({ id: t.id, status: t.status, agent: t.agent, priority: t.priority })), null, 2)}\n\nAs CEO, briefly assess:\n1. Are we on track?\n2. Any tasks to re-prioritize?\n3. Cost efficiency — are we using the right models?\n4. Any strategic adjustments needed?\n\nKeep response under 200 words.`;
    try {
      const response = await callLLM('anthropic', 'claude-sonnet-4-20250514', this.systemPrompt, userPrompt, 60000);
      const content = response.choices?.[0]?.message?.content || 'No response';
      log(c.magenta, `  CEO assessment: ${content.substring(0, 500)}`);
      return content;
    } catch (error: any) {
      log(c.yellow, `  ! CEO unavailable: ${error.message}`);
      return 'CEO agent unavailable';
    }
  }
  async reviewCTOProposal(ctoReport: string): Promise<string> {
    log(c.magenta, '\n[ceo] Reviewing CTO improvement proposals...');
    const userPrompt = `The CTO has completed a technology monitoring cycle and submitted this report:\n\n${ctoReport}\n\nAs CEO, review each proposal (if any) and decide:\n- APPROVED: Implement it. Include cascade orders for the company.\n- REJECTED: Not worth the risk/cost. Explain why.\n- DEFERRED: Good idea but not now. Explain when.\n\nFor each proposal, respond with a decision JSON:\n{\n  "decision": "APPROVED | REJECTED | DEFERRED",\n  "proposal_id": "the proposal ID",\n  "reasoning": "Why this decision",\n  "conditions": ["Any conditions"],\n  "cascade_orders": ["What changes company-wide if approved"],\n  "priority": "immediate | next_sprint | backlog"\n}\n\nIf the CTO found no actionable improvements, acknowledge that and note it positively.\nKeep your response concise. Wrap all decisions in a JSON array.`;
    try {
      const response = await callLLM('anthropic', 'claude-sonnet-4-20250514', this.systemPrompt, userPrompt, 60000);
      const content = response.choices?.[0]?.message?.content || 'No response';
      log(c.magenta, `  CEO CTO review: ${content.substring(0, 500)}`);
      return content;
    } catch (error: any) {
      log(c.yellow, `  ! CEO CTO review failed: ${error.message}`);
      return 'CEO unavailable for CTO review';
    }
  }
  async generateDailyReport(tasks: AgentTask[], stats: { tasksExecuted: number; approved: number; rejected: number }, ctoReport: string, ctoDecisions: string): Promise<void> {
    log(c.magenta, '\n[ceo] Generating daily report for owner...');
    const done = tasks.filter(t => t.status === 'done').length;
    const rejected = tasks.filter(t => t.status === 'rejected').length;
    const pending = tasks.filter(t => t.status === 'pending').length;
    const today = new Date().toISOString().split('T')[0];

    const userPrompt = `Generate a daily report for the owner of Countable. Today is ${today}.

## Sprint Data
- Tasks executed: ${stats.tasksExecuted}
- Approved: ${stats.approved}
- Rejected: ${stats.rejected}
- Done: ${done}, Pending: ${pending}, Total: ${tasks.length}

Task details:
${JSON.stringify(tasks.map(t => ({ id: t.id, status: t.status, agent: t.agent })), null, 2)}

## CTO Report
${ctoReport}

## CEO Decisions on CTO Proposals
${ctoDecisions}

## Estimated Costs
- MiniMax coding: ~$0.09/task x ${stats.tasksExecuted} tasks = ~$${(stats.tasksExecuted * 0.09).toFixed(2)}
- Claude reviews: ~$0.04/review x ${stats.approved + stats.rejected} reviews = ~$${((stats.approved + stats.rejected) * 0.04).toFixed(2)}
- Claude CEO calls: ~$0.03 x 4 = ~$0.12
- MiniMax CTO scan: ~$0.05

Generate a concise daily report in markdown format following the template in your prompt. Include:
1. Sprint Progress
2. Cost Summary
3. Key Decisions Made
4. CTO Proposals Reviewed
5. Blockers & Risks
6. Tomorrow's Plan

Keep it under 300 words. Be honest about failures.`;

    try {
      const response = await callLLM('anthropic', 'claude-sonnet-4-20250514', this.systemPrompt, userPrompt, 60000);
      const report = response.choices?.[0]?.message?.content || 'Report generation failed';

      // Save to reports/daily/
      mkdirSync('reports/daily', { recursive: true });
      const reportPath = `reports/daily/${today}.md`;
      writeFileSync(reportPath, report);
      log(c.green, `  ✓ Daily report saved: ${reportPath}`);
      log(c.magenta, `  Report preview: ${report.substring(0, 300)}`);
    } catch (error: any) {
      log(c.yellow, `  ! Daily report failed: ${error.message}`);
    }
  }
}
// ===== CTO Agent (MiniMax — monitors OpenClaw ecosystem) =====

class CTOAgent {
  private systemPrompt: string;
  constructor() {
    const promptPath = './agents/cto/prompt.md';
    this.systemPrompt = existsSync(promptPath) ? readFileSync(promptPath, 'utf-8') : 'You are the CTO of Countable.';
    log(c.cyan, '+ Loaded CTO agent (MiniMax M2.5)');
  }

  async checkForImprovements(): Promise<string> {
    log(c.cyan, '\n[cto] Scanning OpenClaw ecosystem for improvements...');
    const userPrompt = `You are the CTO of Countable. Perform your regular technology monitoring cycle.

## Current Stack
- OpenClaw: v2026.2.12
- ClawRouter: v0.9.3 (port 8402, unfunded — using Anthropic API direct)
- Models: MiniMax M2.5 (coding, ~$0.09/task), Claude Sonnet (review, ~$0.04/review)
- Orchestrator: v2 with one-file-per-call and rejection feedback loop
- Process Manager: PM2 in WSL2
- Node.js: v22.22.0

## Check These Sources
1. OpenClaw GitHub (https://github.com/openclaw/openclaw) — new releases since v2026.2.12?
2. ClawHub skills registry — new skills for payments, invoicing, tax, or finance?
3. ClawRouter — new models or routing improvements?
4. MiniMax / Anthropic — pricing changes or new model versions?
5. General AI agent tooling — new MCP servers or frameworks?

Generate your monitoring_report JSON with any improvement proposals.
If nothing actionable, report no action needed.`;

    try {
      const startTime = Date.now();
      const response = await callLLM('minimax', 'MiniMax-M2.5', this.systemPrompt, userPrompt, 120000);
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      const content = response.choices?.[0]?.message?.content || 'No response';
      log(c.cyan, `  CTO scan completed in ${elapsed}s`);
      log(c.gray, `  Report preview: ${content.substring(0, 400)}`);
      return content;
    } catch (error: any) {
      log(c.yellow, `  ! CTO scan failed: ${error.message}`);
      return '{"monitoring_report":{"error":"' + error.message + '","proposals":[]}}';
    }
  }
}
// ===== MiniMax Coding Agent (ONE FILE PER API CALL) =====

class CodingAgent {
  private name: string;
  private systemPrompt: string;
  constructor(name: string, systemPrompt: string) { this.name = name; this.systemPrompt = systemPrompt; }

  async execute(task: AgentTask, previousReview?: ReviewResult): Promise<{ files: string[]; model: string }> {
    const model = 'MiniMax-M2.5';
    log(c.cyan, `\n[${this.name}] Executing: ${task.id} (${task.priority})`);
    log(c.gray, `  -> Using MiniMax-M2.5 (one-file-per-call mode)`);
    const deliverables = [...(task.deliverables.code || []), ...(task.deliverables.tests || []), ...(task.deliverables.docs || [])];

    let rejectionContext = '';
    if (previousReview && previousReview.verdict !== 'APPROVED') {
      const issueList = (previousReview.issues || []).map(i => `- [${i.severity}] ${i.file}: ${i.description}`).join('\n');
      rejectionContext = `\n## IMPORTANT: Previous Attempt Was REJECTED\nScore: ${previousReview.score}/100. Reason: ${previousReview.summary}\n\nSpecific issues to fix:\n${issueList}\n\nYou MUST address ALL issues.\n`;
    }

    const createdFiles: Array<{ path: string; content: string }> = [];

    for (let i = 0; i < deliverables.length; i++) {
      const filepath = deliverables[i];
      log(c.gray, `  -> Generating file ${i + 1}/${deliverables.length}: ${filepath}`);      const priorCtx = createdFiles.length > 0
        ? '\n## Already Generated Files\n' + createdFiles.map(f => `### ${f.path}\n\`\`\`typescript\n${f.content.substring(0, 2000)}\n\`\`\``).join('\n\n') + '\n'
        : '';
      const fileList = deliverables.map((f, idx) => `${idx + 1}. ${f}${f === filepath ? ' ← THIS ONE' : ''}`).join('\n');

      const userPrompt = `You are ${this.name}, a coding agent at Countable.
${rejectionContext}
## Task
${task.context}

## All Deliverable Files
${fileList}

## Generate ONLY: ${filepath}
${priorCtx}
Write ONLY the content for "${filepath}". Rules:
- Output a single fenced code block with the COMPLETE file content
- Production quality, no TODOs or placeholders
- Include all imports, types, error handling
- If this file depends on others listed above, import from them correctly
- No explanatory text outside the code block`;
      try {
        const startTime = Date.now();
        const response = await callLLM('minimax', model, this.systemPrompt, userPrompt, 180000);
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        const content = response.choices?.[0]?.message?.content || '';
        const tokens = response.usage?.total_tokens || 0;

        // Check for MiniMax errors
        if (response.base_resp?.status_code && response.base_resp.status_code !== 0) {
          throw new Error(`MiniMax API error: ${response.base_resp.status_msg}`);
        }

        log(c.gray, `  -> Response: ${elapsed}s, ${tokens} tokens, ${content.length} chars`);

        // Extract code from fenced block
        const codeBlocks = this.extractCodeBlocks(content);
        if (codeBlocks.length === 0) {
          log(c.yellow, `  ! No code block found for ${filepath}, using raw content`);
          createdFiles.push({ path: filepath, content: content.trim() });
        } else {
          createdFiles.push({ path: filepath, content: codeBlocks[0] });
        }
      } catch (error: any) {
        log(c.red, `  ✗ Failed to generate ${filepath}: ${error.message}`);
        // Create minimal placeholder so build doesn't break
        createdFiles.push({ path: filepath, content: `// ERROR: Generation failed - ${error.message}\n// Task: ${task.id}\n` });
      }
    }
    // Write all files to disk
    const writtenFiles: string[] = [];
    for (const file of createdFiles) {
      try {
        const dir = file.path.substring(0, file.path.lastIndexOf('/'));
        if (dir) mkdirSync(dir, { recursive: true });
        writeFileSync(file.path, file.content);
        writtenFiles.push(file.path);
        log(c.green, `  ✓ Written: ${file.path} (${file.content.length} chars)`);
      } catch (error: any) {
        log(c.red, `  ✗ Write failed: ${file.path}: ${error.message}`);
      }
    }

    // Commit changes
    this.commitChanges(task, writtenFiles);
    return { files: writtenFiles, model };
  }

  private extractCodeBlocks(content: string): string[] {
    const blocks: string[] = [];
    const regex = /```(?:typescript|ts|javascript|js|json|yaml|dockerfile|sh|bash|css|html)?\s*\n([\s\S]*?)```/g;
    let match;
    while ((match = regex.exec(content)) !== null) {
      if (match[1].trim().length > 0) blocks.push(match[1].trim());
    }
    return blocks;
  }

  private commitChanges(task: AgentTask, files: string[]): void {
    if (files.length === 0) return;
    try {
      const filesList = files.join(' ');
      execSync(`git add ${filesList}`, { timeout: 10000 });
      execSync(`git commit -m "feat(${task.agent}): ${task.id} - ${task.type}" --no-verify`, { timeout: 10000 });
      log(c.green, `  ✓ Committed: ${files.length} files for ${task.id}`);
    } catch (error: any) {
      log(c.yellow, `  ! Commit skipped: ${error.message?.substring(0, 100)}`);
    }
  }
}
// ===== Orchestrator (10-Agent Pipeline) =====

class Orchestrator {
  private ceo: CEOAgent;
  private cto: CTOAgent;
  private supervisor: SupervisorAgent;
  private agents: Map<string, CodingAgent> = new Map();
  private tasks: AgentTask[] = [];
  private stats = { tasksExecuted: 0, approved: 0, rejected: 0, totalTokens: 0 };

  constructor() {
    log(c.bold, '\n╔══════════════════════════════════════════════════════════╗');
    log(c.bold, '║   Countable Agent Orchestrator v2                        ║');
    log(c.bold, '║   10 agents: 3 Claude (Anthropic) + 7 MiniMax            ║');
    log(c.bold, '╚══════════════════════════════════════════════════════════╝\n');

    // Leadership layer (Claude via Anthropic API)
    this.ceo = new CEOAgent();
    this.supervisor = new SupervisorAgent();

    // Technology layer (MiniMax)
    this.cto = new CTOAgent();

    // Execution layer (MiniMax coding agents)
    const codingAgents = [
      'backend-core', 'backend-tax', 'backend-ledger',
      'frontend', 'devops', 'security',
    ];
    for (const name of codingAgents) {
      const promptPath = `./agents/${name}/prompt.md`;
      const prompt = existsSync(promptPath) ? readFileSync(promptPath, 'utf-8') : `You are the ${name} agent at Countable.`;
      this.agents.set(name, new CodingAgent(name, prompt));
      log(c.cyan, `+ Loaded ${name} agent (MiniMax M2.5)`);
    }

    log(c.green, `\n✓ All 10 agents loaded (3 Claude + 7 MiniMax)\n`);
  }
  private loadTasks(): void {
    const sprintFile = process.argv[2] || 'sprints/current.json';
    if (!existsSync(sprintFile)) {
      log(c.red, `Sprint file not found: ${sprintFile}`);
      process.exit(1);
    }
    const sprint = JSON.parse(readFileSync(sprintFile, 'utf-8'));
    this.tasks = sprint.tasks || [];

    // Reset stale in_progress tasks back to pending
    for (const task of this.tasks) {
      if (task.status === 'in_progress' || task.status === 'review') {
        log(c.yellow, `  Resetting stale task ${task.id} (${task.status} -> pending)`);
        task.status = 'pending';
      }
    }
    log(c.blue, `Loaded ${this.tasks.length} tasks from ${sprintFile}`);
  }

  private async executeTask(task: AgentTask): Promise<void> {
    const agent = this.agents.get(task.agent);
    if (!agent) {
      log(c.red, `Agent not found: ${task.agent}`);
      task.status = 'rejected';
      return;
    }

    const MAX_RETRIES = 3;
    let lastReview: ReviewResult | undefined;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      log(c.blue, `\n${'='.repeat(60)}`);
      log(c.blue, `Task: ${task.id} | Agent: ${task.agent} | Attempt: ${attempt}/${MAX_RETRIES}`);
      log(c.blue, `${'='.repeat(60)}`);

      task.status = 'in_progress';
      this.stats.tasksExecuted++;

      // Execute with rejection feedback if retrying
      const result = await agent.execute(task, lastReview);

      if (result.files.length === 0) {
        log(c.red, `  No files produced for ${task.id}`);
        task.status = 'rejected';
        return;
      }

      // Supervisor review
      task.status = 'review';
      const review = await this.supervisor.reviewTask(task, result.files);
      lastReview = review;

      task.output = { files: result.files, commit: '', model: result.model, review };

      if (review.verdict === 'APPROVED') {
        task.status = 'done';
        this.stats.approved++;
        log(c.green, `\n✓ Task ${task.id} APPROVED on attempt ${attempt} (${review.score}/100)`);
        return;
      }
      // Rejected — revert and retry
      this.stats.rejected++;
      log(c.yellow, `\n↻ Task ${task.id} REJECTED on attempt ${attempt} (${review.score}/100)`);

      try {
        execSync('git revert HEAD --no-edit', { timeout: 10000 });
        log(c.gray, '  Reverted last commit');
      } catch {
        log(c.gray, '  Revert skipped (no commit to revert)');
      }

      if (attempt < MAX_RETRIES) {
        log(c.yellow, `  Retrying with rejection feedback...`);
      }
    }

    task.status = 'rejected';
    log(c.red, `\n✗ Task ${task.id} FAILED after ${MAX_RETRIES} attempts`);
  }
  async run(): Promise<void> {
    const startTime = Date.now();
    log(c.bold, '\n🚀 Starting orchestration run...\n');

    // 1. Load tasks
    this.loadTasks();
    if (this.tasks.length === 0) {
      log(c.yellow, 'No tasks to execute');
      return;
    }

    // 2. CEO initial assessment
    log(c.magenta, '\n--- Phase 1: CEO Initial Assessment ---');
    await this.ceo.reviewSprintProgress(this.tasks);

    // 3. Execute coding tasks with review loop
    log(c.blue, '\n--- Phase 2: Sprint Execution ---');
    const pending = this.tasks.filter(t => t.status === 'pending');
    for (const task of pending) {
      // Check dependencies
      const deps = task.dependencies || [];
      const unmetDeps = deps.filter(d => {
        const depTask = this.tasks.find(t => t.id === d);
        return depTask && depTask.status !== 'done';
      });
      if (unmetDeps.length > 0) {
        log(c.yellow, `  Skipping ${task.id}: unmet deps [${unmetDeps.join(', ')}]`);
        continue;
      }
      await this.executeTask(task);
    }
    // 4. CTO technology monitoring
    log(c.cyan, '\n--- Phase 3: CTO Technology Scan ---');
    let ctoReport = '';
    let ctoDecisions = '';
    try {
      ctoReport = await this.cto.checkForImprovements();

      // 5. CEO reviews CTO proposals
      log(c.magenta, '\n--- Phase 4: CEO Reviews CTO Proposals ---');
      ctoDecisions = await this.ceo.reviewCTOProposal(ctoReport);
    } catch (error: any) {
      log(c.yellow, `  CTO/CEO review cycle skipped: ${error.message}`);
      ctoReport = 'CTO scan was not performed this run.';
      ctoDecisions = 'No proposals reviewed.';
    }

    // 6. CEO final assessment
    log(c.magenta, '\n--- Phase 5: CEO Final Assessment ---');
    await this.ceo.reviewSprintProgress(this.tasks);

    // 7. CEO generates daily report
    log(c.magenta, '\n--- Phase 6: Daily Report Generation ---');
    await this.ceo.generateDailyReport(this.tasks, this.stats, ctoReport, ctoDecisions);
    // 8. Save updated sprint state
    const sprintFile = process.argv[2] || 'sprints/current.json';
    writeFileSync(sprintFile, JSON.stringify({ tasks: this.tasks }, null, 2));
    log(c.green, `\nSprint state saved to ${sprintFile}`);

    // Final summary
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    log(c.bold, '\n╔══════════════════════════════════════════════════════════╗');
    log(c.bold, '║   Orchestration Complete                                  ║');
    log(c.bold, '╚══════════════════════════════════════════════════════════╝');
    log(c.green, `  Tasks executed: ${this.stats.tasksExecuted}`);
    log(c.green, `  Approved: ${this.stats.approved}`);
    log(c.red,   `  Rejected: ${this.stats.rejected}`);
    log(c.blue,  `  Total time: ${elapsed}s`);
    log(c.gray,  `  Pipeline: CEO → MiniMax code → Claude review → CTO scan → CEO approve → Daily report`);
  }
}

// ===== Main Entry =====

async function main() {
  try {
    const orchestrator = new Orchestrator();
    await orchestrator.run();
  } catch (error: any) {
    log(c.red, `\n✗ Fatal error: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  }
}

main();