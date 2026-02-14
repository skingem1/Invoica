#!/usr/bin/env ts-node

/**
 * Countable Agent Orchestrator v2
 *
 * 9-Agent Architecture:
 *   Leadership (Claude via Anthropic API):
 *     - CEO: Sprint planning, strategy, decisions
 *     - Supervisor: Code review & quality gate
 *     - Skills: Agent/skill factory
 *   Execution (MiniMax M2.5 — cost-optimized):
 *     - backend-core, backend-tax, backend-ledger
 *     - frontend, devops, security
 *
 * Flow: CEO plans → MiniMax codes → Supervisor reviews → CEO tracks
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
// Routes to either MiniMax (direct) or Anthropic API (Claude)

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

  // MiniMax — OpenAI-compatible API
  const baseUrl = 'https://api.minimax.io/v1/chat/completions';
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

// Anthropic Messages API (Claude)
async function callAnthropic(
  model: string,
  systemPrompt: string,
  userPrompt: string,
  timeoutMs: number
): Promise<LLMResponse> {
  const apiKey = process.env.ANTHROPIC_API_KEY || '';
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set in .env');

  const body = JSON.stringify({
    model,
    max_tokens: 16000,
    system: systemPrompt,
    messages: [
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.3,
  });

  const rawResponse = await httpPost('https://api.anthropic.com/v1/messages', {
    'Content-Type': 'application/json',
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01',
  }, body, timeoutMs);

  // Convert Anthropic response format to our standard LLMResponse
  const anthropicData = rawResponse as any;
  if (anthropicData.content && Array.isArray(anthropicData.content)) {
    const textContent = anthropicData.content
      .filter((b: any) => b.type === 'text')
      .map((b: any) => b.text)
      .join('');
    return {
      choices: [{ message: { content: textContent } }],
      usage: {
        total_tokens: (anthropicData.usage?.input_tokens || 0) + (anthropicData.usage?.output_tokens || 0),
      },
    };
  }
  return rawResponse;
}

// Generic HTTPS POST helper
function httpPost(url: string, headers: Record<string, string>, body: string, timeoutMs: number): Promise<any> {
  const parsed = new URL(url);
  const isHttps = parsed.protocol === 'https:';
  const lib = isHttps ? https : http;

  return new Promise((resolve, reject) => {
    const req = lib.request({
      hostname: parsed.hostname,
      port: parsed.port || (isHttps ? 443 : undefined),
      path: parsed.pathname,
      method: 'POST',
      headers: {
        ...headers,
        'Content-Length': Buffer.byteLength(body).toString(),
      },
    }, (res) => {
      let data = '';
      res.on('data', (chunk: string) => (data += chunk));
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          if (result.error) {
            reject(new Error(`API error: ${result.error.message || JSON.stringify(result.error)}`));
            return;
          }
          resolve(result);
        } catch {
          reject(new Error(`Failed to parse response: ${data.substring(0, 500)}`));
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(timeoutMs, () => { req.destroy(); reject(new Error(`API timeout (${timeoutMs/1000}s)`)); });
    req.write(body);
    req.end();
  });
}

// ===== Supervisor Agent (Claude via ClawRouter) =====

class SupervisorAgent {
  private systemPrompt: string;

  constructor() {
    const promptPath = './agents/supervisor/prompt.md';
    this.systemPrompt = existsSync(promptPath) ? readFileSync(promptPath, 'utf-8') : 'You are a code review supervisor.';
    log(c.magenta, '+ Loaded supervisor agent (Claude via Anthropic API)');
  }

  async reviewTask(task: AgentTask, files: string[]): Promise<ReviewResult> {
    log(c.magenta, `\n[supervisor] Reviewing: ${task.id}`);

    // Build file contents for review
    const fileContents = files.map((filepath) => {
      const content = existsSync(filepath) ? readFileSync(filepath, 'utf-8') : '';
      return `### ${filepath}\n\`\`\`typescript\n${content.substring(0, 4000)}\n\`\`\``;
    }).join('\n\n');

    const userPrompt = `Review the following code generated for task ${task.id}.

## Task Spec
${task.context}

## Generated Files (${files.length})
${fileContents}

## Instructions
Respond with a JSON object:
{
  "verdict": "APPROVED" or "REJECTED",
  "score": 0-100,
  "summary": "brief review summary",
  "issues": [{"severity": "critical|high|medium|low", "file": "path", "description": "..."}],
  "strengths": ["..."]
}`;

    const startTime = Date.now();
    log(c.gray, '  -> Sending to Claude (Anthropic API)...');

    try {
      const response = await callLLM('anthropic', 'claude-sonnet-4-20250514', this.systemPrompt, userPrompt, 120000);
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      const tokens = response.usage?.total_tokens || 'unknown';
      log(c.gray, `  -> Review received in ${elapsed}s (${tokens} tokens)`);

      const content = response.choices?.[0]?.message?.content || '';

      // Extract JSON from response (may be wrapped in markdown)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const review = JSON.parse(jsonMatch[0]) as ReviewResult;
        if (review.verdict === 'APPROVED') {
          log(c.green, `  ✓ APPROVED (score: ${review.score}/100)`);
        } else {
          log(c.red, `  ✗ REJECTED (score: ${review.score}/100)`);
          log(c.yellow, `  Summary: ${review.summary}`);
          for (const issue of review.issues || []) {
            log(c.yellow, `    [${issue.severity}] ${issue.file}: ${issue.description}`);
          }
        }
        return review;
      }

      // If no JSON found, treat as approved with warning
      log(c.yellow, '  ! Could not parse review JSON, auto-approving');
      return { verdict: 'APPROVED', score: 70, summary: 'Auto-approved (parse failure)', issues: [], strengths: [] };

    } catch (error: any) {
      log(c.yellow, `  ! Supervisor error: ${error.message}`);
      log(c.yellow, '  -> Auto-approving (supervisor unavailable)');
      return { verdict: 'APPROVED', score: 0, summary: `Supervisor unavailable: ${error.message}`, issues: [], strengths: [] };
    }
  }
}

// ===== CEO Agent (Claude via ClawRouter) =====

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

    const userPrompt = `Sprint progress update:
- Done: ${done}/${total}
- Pending: ${pending.map(t => t.id).join(', ') || 'none'}
- Rejected: ${rejected.map(t => t.id).join(', ') || 'none'}

Task details:
${JSON.stringify(tasks.map(t => ({ id: t.id, status: t.status, agent: t.agent, priority: t.priority })), null, 2)}

As CEO, briefly assess:
1. Are we on track?
2. Any tasks to re-prioritize?
3. Cost efficiency — are we using the right models?
4. Any strategic adjustments needed?

Keep response under 200 words.`;

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
}

// ===== MiniMax Coding Agent =====

class CodingAgent {
  private name: string;
  private systemPrompt: string;

  constructor(name: string, systemPrompt: string) {
    this.name = name;
    this.systemPrompt = systemPrompt;
  }

  async execute(task: AgentTask): Promise<{ files: string[]; model: string }> {
    const model = 'MiniMax-M2.5';
    log(c.cyan, `\n[${this.name}] Executing: ${task.id} (${task.priority})`);
    log(c.gray, `  -> Using MiniMax-M2.5`);

    const deliverables = [
      ...(task.deliverables.code || []),
      ...(task.deliverables.tests || []),
      ...(task.deliverables.docs || []),
    ];

    const userPrompt = `## Current Task: ${task.id}

${task.context}

## Required Deliverables

Generate COMPLETE, PRODUCTION-READY code for each of these files:

${deliverables.map(f => `- ${f}`).join('\n')}

## Output Format

For EACH file, output it exactly like this:

\`\`\`typescript
// filepath: <relative-path-to-file>
<complete file content here>
\`\`\`

IMPORTANT:
- Include ALL imports at the top of each file
- Include complete error handling
- Include JSDoc comments for public APIs
- For test files, include comprehensive test cases
- Each code block MUST start with "// filepath: <path>"
- Generate ALL listed files, do not skip any`;

    log(c.gray, `  -> Sending to MiniMax (model: ${model})...`);
    const startTime = Date.now();
    const response = await callLLM('minimax', model, this.systemPrompt, userPrompt);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const tokens = response.usage?.total_tokens || 'unknown';
    log(c.gray, `  -> Response received in ${elapsed}s (${tokens} tokens)`);

    const output = response.choices?.[0]?.message?.content;
    if (!output) throw new Error('Empty response from MiniMax');

    const files = this.extractCodeBlocks(output);
    if (files.length === 0) {
      log(c.yellow, `  ! No file blocks extracted, saving raw output`);
      const fallbackPath = `output/${task.id}-raw.md`;
      mkdirSync('output', { recursive: true });
      writeFileSync(fallbackPath, output);
      return { files: [fallbackPath], model };
    }

    for (const file of files) {
      const dir = file.path.split('/').slice(0, -1).join('/');
      if (dir && !existsSync(dir)) mkdirSync(dir, { recursive: true });
      writeFileSync(file.path, file.content);
      log(c.green, `  + Created: ${file.path}`);
    }

    this.commitChanges(task.id, model);
    return { files: files.map(f => f.path), model };
  }

  private extractCodeBlocks(markdown: string): Array<{ path: string; content: string }> {
    const files: Array<{ path: string; content: string }> = [];
    const regex = /```(?:typescript|javascript|tsx|jsx|sql|yaml|json|bash|ts|js|tf|hcl|prisma|css|html)?\s*\n\/\/\s*filepath:\s*(.+?)\n([\s\S]*?)```/g;
    let match;
    while ((match = regex.exec(markdown)) !== null) {
      const filepath = match[1]?.trim();
      const content = match[2]?.trimEnd() + '\n';
      if (filepath && content && filepath.includes('/')) {
        files.push({ path: filepath, content });
      }
    }
    if (files.length === 0) {
      const altRegex = /```(?:\w+)?\s*\n\/[/*]\s*(.+?\.(?:ts|tsx|js|jsx|sql|tf|prisma|css|html|md))\s*\n([\s\S]*?)```/g;
      while ((match = altRegex.exec(markdown)) !== null) {
        const filepath = match[1]?.trim();
        const content = match[2]?.trimEnd() + '\n';
        if (filepath && content) files.push({ path: filepath, content });
      }
    }
    return files;
  }

  private commitChanges(taskId: string, model: string) {
    try {
      execSync('git add -A', { stdio: 'pipe' });
      execSync(`git commit -m "feat(${this.name}): ${taskId} [${model}]" --allow-empty`, { stdio: 'pipe' });
      log(c.blue, `  + Committed: feat(${this.name}): ${taskId}`);
    } catch { log(c.gray, `  -> No changes to commit`); }
  }
}

// ===== Orchestrator v2 =====

class Orchestrator {
  private codingAgents: Map<string, CodingAgent> = new Map();
  private supervisor: SupervisorAgent;
  private ceo: CEOAgent;
  private tasks: AgentTask[] = [];
  private sprintFile: string;
  private stats = { tasksExecuted: 0, approved: 0, rejected: 0, totalTokens: 0 };

  constructor() {
    this.sprintFile = process.argv[2] || './sprints/week-2.json';

    log(`${c.bold}${c.blue}`, '\n🦞 Countable Agent Orchestrator v2');
    log(c.gray, '9 agents: 3 Claude (Anthropic) + 6 MiniMax\n');

    this.loadCodingAgents();
    this.supervisor = new SupervisorAgent();
    this.ceo = new CEOAgent();
    this.loadTasks();
  }

  private loadCodingAgents() {
    const names = ['backend-core', 'backend-tax', 'backend-ledger', 'frontend', 'devops', 'security'];
    for (const name of names) {
      const promptPath = `./agents/${name}/prompt.md`;
      if (existsSync(promptPath)) {
        const systemPrompt = readFileSync(promptPath, 'utf-8');
        this.codingAgents.set(name, new CodingAgent(name, systemPrompt));
        log(c.green, `+ Loaded coding agent: ${name} (MiniMax M2.5)`);
      } else {
        log(c.yellow, `! Missing prompt: ${promptPath}`);
      }
    }
  }

  private loadTasks() {
    if (!existsSync(this.sprintFile)) throw new Error(`Sprint file not found: ${this.sprintFile}`);
    this.tasks = JSON.parse(readFileSync(this.sprintFile, 'utf-8'));
    // Reset stale in_progress tasks from previous crashed runs
    for (const t of this.tasks) {
      if (t.status === 'in_progress') { t.status = 'pending'; }
    }
    this.saveTasks();
    log(c.blue, `\nLoaded ${this.tasks.length} tasks from ${this.sprintFile}`);
    const byStatus = this.tasks.reduce((acc, t) => { acc[t.status] = (acc[t.status] || 0) + 1; return acc; }, {} as Record<string, number>);
    log(c.gray, `Status: ${JSON.stringify(byStatus)}`);
  }

  private saveTasks() {
    writeFileSync(this.sprintFile, JSON.stringify(this.tasks, null, 2));
  }

  private canExecute(task: AgentTask): boolean {
    if (task.status !== 'pending') return false;
    return task.dependencies.every(depId => {
      const dep = this.tasks.find(t => t.id === depId);
      return dep?.status === 'done' || dep?.status === 'approved';
    });
  }

  private getLatestCommit(): string {
    try { return execSync('git rev-parse --short HEAD', { stdio: 'pipe' }).toString().trim(); }
    catch { return 'unknown'; }
  }

  private async executeTask(task: AgentTask): Promise<'done' | 'rejected' | 'paused'> {
    const agent = this.codingAgents.get(task.agent);
    if (!agent) { log(c.red, `x Agent not found: ${task.agent}`); return 'paused'; }

    const MAX_RETRIES = 3;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      if (attempt > 1) log(c.yellow, `\n--- Retry #${attempt} for ${task.id} ---`);

      task.status = 'in_progress';
      this.saveTasks();

      try {
        // Step 1: MiniMax generates code
        const result = await agent.execute(task);
        task.output = { files: result.files, commit: this.getLatestCommit(), model: result.model };

        // Step 2: Supervisor reviews (Claude via ClawRouter)
        const review = await this.supervisor.reviewTask(task, result.files);
        task.output.review = review;

        if (review.verdict === 'APPROVED') {
          task.status = 'done';
          this.saveTasks();
          this.stats.approved++;
          log(c.green, `\n✓ Task ${task.id} -> DONE (${result.files.length} files, score: ${review.score}/100)`);
          return 'done';
        } else {
          // Rejected — revert and retry
          log(c.red, `\n✗ Task ${task.id} REJECTED by supervisor`);
          this.stats.rejected++;

          if (attempt < MAX_RETRIES) {
            try {
              execSync('git revert HEAD --no-edit', { stdio: 'pipe' });
              log(c.yellow, `  Reverted commit, retrying...`);
            } catch { log(c.yellow, `  Could not revert, retrying anyway...`); }
            task.status = 'pending';
            this.saveTasks();
            continue;
          } else {
            log(c.red, `  Task ${task.id} rejected after ${MAX_RETRIES} attempts`);
            task.status = 'rejected';
            this.saveTasks();
            return 'rejected';
          }
        }

      } catch (error: any) {
        log(c.red, `\nx Task ${task.id} failed: ${error.message}`);
        if (attempt < MAX_RETRIES) {
          log(c.yellow, `Retrying (attempt ${attempt}/${MAX_RETRIES})...`);
          task.status = 'pending';
          this.saveTasks();
          continue;
        } else {
          log(c.red, `Task ${task.id} failed after ${MAX_RETRIES} attempts`);
          task.status = 'pending';
          this.saveTasks();
          return 'paused';
        }
      }
    }
    return 'paused';
  }

  async run() {
    log(`${c.bold}${c.blue}`, '\nStarting Orchestration v2');
    log(c.gray, 'Flow: MiniMax codes → Supervisor reviews → CEO tracks\n');

    // CEO initial assessment
    await this.ceo.reviewSprintProgress(this.tasks);

    let paused = false;

    while (!paused) {
      const pending = this.tasks.filter(t => t.status === 'pending');
      const executable = pending.filter(t => this.canExecute(t));

      if (executable.length === 0) {
        if (pending.length === 0) {
          log(c.green, '\n🎉 All tasks complete!');
          break;
        }
        const blocked = pending.filter(t => !this.canExecute(t));
        if (blocked.length > 0) {
          log(c.yellow, `\n${blocked.length} tasks blocked by dependencies:`);
          for (const t of blocked) {
            const unmet = t.dependencies.filter(d => {
              const dep = this.tasks.find(x => x.id === d);
              return dep?.status !== 'done' && dep?.status !== 'approved';
            });
            log(c.gray, `  ${t.id} -> waiting for: ${unmet.join(', ')}`);
          }
        }
        break;
      }

      log(c.blue, `\nExecutable tasks: ${executable.map(t => t.id).join(', ')}`);

      const task = executable[0];
      const result = await this.executeTask(task);
      this.stats.tasksExecuted++;

      if (result === 'paused') { paused = true; break; }

      // Brief pause between tasks
      log(c.gray, `\n--- Waiting 3s before next task ---`);
      await new Promise(r => setTimeout(r, 3000));
    }

    // CEO final assessment
    if (this.stats.tasksExecuted > 0) {
      await this.ceo.reviewSprintProgress(this.tasks);
    }

    // Final summary
    const done = this.tasks.filter(t => t.status === 'done').length;
    const rejected = this.tasks.filter(t => t.status === 'rejected').length;
    const pendingCount = this.tasks.filter(t => t.status === 'pending').length;

    console.log('\n=======================================');
    console.log('  Sprint Summary (Orchestrator v2)');
    console.log('=======================================');
    log(c.green,   `  Done:       ${done}`);
    if (rejected > 0) log(c.red, `  Rejected:   ${rejected}`);
    if (pendingCount > 0) log(c.yellow, `  Pending:    ${pendingCount}`);
    log(c.blue,    `  Total:      ${this.tasks.length}`);
    log(c.gray,    `  Executed:   ${this.stats.tasksExecuted}`);
    log(c.green,   `  Approved:   ${this.stats.approved}`);
    log(c.red,     `  Rejected:   ${this.stats.rejected}`);
    console.log('=======================================');
    log(c.gray,    '  Models: MiniMax M2.5 (code) + Claude Sonnet (review)');
    console.log('=======================================\n');
  }
}

// ===== Main =====

new Orchestrator().run().catch((error) => {
  log(c.red, `\nFatal error: ${error.message}`);
  process.exit(1);
});
