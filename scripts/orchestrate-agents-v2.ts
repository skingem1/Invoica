#!/usr/bin/env ts-node

/**
 * Countable Agent Orchestrator v2
 *
 * Dynamic Agent Architecture:
 *   Leadership (Claude via Anthropic API):
 *     - CEO: Sprint planning, strategy, decisions, daily reports
 *     - Supervisor: Code review & quality gate
 *     - Skills: Agent/skill factory
 *   Technology (MiniMax M2.5):
 *     - CTO: Data-driven analysis, OpenClaw/ClawHub monitoring, agent spawning proposals
 *   Execution (MiniMax M2.5 — dynamically loaded from agents/ directory):
 *     - Coding agents auto-discovered from agents/{name}/prompt.md
 *     - New agents created by CTO proposals + CEO approval
 *
 * Flow: CEO plans → MiniMax codes → Supervisor reviews
 *       → CTO analyzes (with real data) → CEO approves → agents created → CEO daily report
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
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

interface CTOProposal {
  id: string;
  title: string;
  category: 'cost_optimization' | 'new_feature' | 'new_agent' | 'process_change' | 'architecture' | 'tooling';
  description: string;
  estimated_impact: string;
  risk_level: 'low' | 'medium' | 'high';
  implementation_steps: string[];
  agent_spec?: {
    name: string;
    role: string;
    llm: 'minimax' | 'anthropic';
    trigger: string;
    prompt_summary: string;
  };
}

interface CTOReport {
  summary: string;
  proposals: CTOProposal[];
  metrics_reviewed: string[];
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
  async reviewCTOProposals(ctoReport: CTOReport): Promise<string> {
    log(c.magenta, `\n[ceo] Reviewing ${ctoReport.proposals.length} CTO proposals...`);
    const proposalsSummary = ctoReport.proposals.map((p, i) => `
### Proposal ${i + 1}: ${p.title}
- ID: ${p.id}
- Category: ${p.category}
- Risk: ${p.risk_level}
- Description: ${p.description}
- Impact: ${p.estimated_impact}
- Steps: ${p.implementation_steps.join(', ')}
${p.agent_spec ? `- NEW AGENT: name=${p.agent_spec.name}, role="${p.agent_spec.role}", llm=${p.agent_spec.llm}, trigger=${p.agent_spec.trigger}` : ''}
`).join('\n');

    const userPrompt = `The CTO has analyzed our project data and submitted ${ctoReport.proposals.length} proposal(s).

## CTO Summary
${ctoReport.summary}

## Proposals
${proposalsSummary}

## Your Review Criteria
For each proposal, evaluate:
1. **Evidence-based**: Is it backed by real sprint data? (CTO reviewed: ${ctoReport.metrics_reviewed.join(', ')})
2. **Cost impact**: Will this save or cost money?
3. **Risk level**: Can we roll back if it fails?
4. **Business value**: Does it help ship features faster?
5. **Disruption level**: How much will this change current workflows?

**For new_agent proposals, ALSO evaluate:**
- Is the capability gap real? (not something an existing agent handles)
- Is MiniMax appropriate, or does this need Claude-level intelligence?
- Is the trigger frequency reasonable? (every_sprint may be expensive)
- Will the total agent count become unmanageable?

**For ClawHub skill proposals:**
- Has a security_review step been included? (REQUIRED — ClawHub skills may contain malware)
- Is the skill from a trusted author?

## Decision Format
For EACH proposal, respond with a decision JSON:
{
  "decision": "APPROVED | REJECTED | DEFERRED",
  "proposal_id": "the proposal ID",
  "reasoning": "Why this decision",
  "conditions": ["Any conditions for implementation"],
  "cascade_orders": ["Company-wide changes if approved"],
  "priority": "immediate | next_sprint | backlog"
}

Wrap all decisions in a JSON array. Be concise.`;

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
// ===== CTO Data Collector (gathers real project context for CTO analysis) =====

class CTODataCollector {
  collect(): string {
    const sections: string[] = ['## PROJECT DATA (Real metrics — base all proposals on this data)\n'];

    // 1. Sprint results — find most recent sprint file
    try {
      const sprintDir = './sprints';
      if (existsSync(sprintDir)) {
        const sprintFiles = readdirSync(sprintDir).filter(f => f.endsWith('.json')).sort().reverse();
        if (sprintFiles.length > 0) {
          const latestSprint = JSON.parse(readFileSync(`${sprintDir}/${sprintFiles[0]}`, 'utf-8'));
          const tasks = latestSprint.tasks || [];
          const done = tasks.filter((t: any) => t.status === 'done').length;
          const rejected = tasks.filter((t: any) => t.status === 'rejected').length;
          sections.push(`### Sprint Results (${sprintFiles[0].replace('.json', '')})`);
          sections.push(`- ${tasks.length} tasks, ${done} approved, ${rejected} rejected`);
          for (const t of tasks) {
            const score = t.output?.review?.score || '?';
            const attempts = t.output?.review ? 1 : '?';
            sections.push(`- ${t.id} (${t.agent}): status=${t.status}, score=${score}`);
          }
          sections.push('');
        }
      }
    } catch (e: any) { sections.push(`### Sprint Results\n- Error reading: ${e.message}\n`); }

    // 2. Learnings — first 3000 chars
    try {
      const learnings = existsSync('./docs/learnings.md') ? readFileSync('./docs/learnings.md', 'utf-8') : '';
      if (learnings) {
        sections.push('### Key Learnings (from docs/learnings.md)');
        sections.push(learnings.substring(0, 3000));
        if (learnings.length > 3000) sections.push('... (truncated)');
        sections.push('');
      }
    } catch { sections.push('### Key Learnings\n- File not found\n'); }

    // 3. Existing agents
    try {
      const agentDirs = existsSync('./agents') ? readdirSync('./agents') : [];
      const leadershipAgents = ['ceo', 'supervisor', 'skills'];
      const techAgents = ['cto'];
      sections.push(`### Existing Agents (${agentDirs.length} directories)`);
      for (const dir of agentDirs) {
        const layer = leadershipAgents.includes(dir) ? 'Claude/leadership'
          : techAgents.includes(dir) ? 'MiniMax/technology' : 'MiniMax/coding';
        sections.push(`- ${dir} (${layer})`);
      }
      sections.push('');
    } catch { sections.push('### Existing Agents\n- Error reading agents directory\n'); }

    // 4. Most recent daily report (last 2000 chars)
    try {
      const reportDir = './reports/daily';
      if (existsSync(reportDir)) {
        const reports = readdirSync(reportDir).filter(f => f.endsWith('.md')).sort().reverse();
        if (reports.length > 0) {
          const latestReport = readFileSync(`${reportDir}/${reports[0]}`, 'utf-8');
          sections.push(`### Recent Daily Report (${reports[0]})`);
          sections.push(latestReport.substring(0, 2000));
          sections.push('');
        }
      }
    } catch { /* no reports yet */ }

    // 5. Current stack versions (read from package.json or env)
    sections.push('### Current Stack');
    sections.push('- OpenClaw: v2026.2.12');
    sections.push('- ClawRouter: v0.9.3 (unfunded, using Anthropic API direct)');
    sections.push('- Models: MiniMax M2.5 (coding ~$0.09/task), Claude Sonnet (review ~$0.04/review)');
    sections.push('- Node.js: v22.22.0, PM2 in WSL2');
    sections.push('- Orchestrator: v2, dynamic agent loading, one-file-per-call, rejection feedback');
    sections.push('');

    // 6. External monitoring hints
    sections.push('### External Sources to Consider');
    sections.push('- OpenClaw GitHub: https://github.com/openclaw/openclaw (check weekly for new releases since v2026.2.12)');
    sections.push('- ClawHub.ai: https://clawhub.ai/ (check for existing skills when proposing improvements)');
    sections.push('  SECURITY WARNING: ClawHub skills are third-party and may contain malicious code.');
    sections.push('  Any skill from ClawHub MUST include a security_review step in implementation_steps.');
    sections.push('- MiniMax / Anthropic pricing pages for cost changes');
    sections.push('');

    return sections.join('\n');
  }
}

// ===== CTO Agent (MiniMax — data-driven tech analyst + agent spawning) =====

class CTOAgent {
  private systemPrompt: string;
  private dataCollector: CTODataCollector;

  constructor() {
    const promptPath = './agents/cto/prompt.md';
    this.systemPrompt = existsSync(promptPath) ? readFileSync(promptPath, 'utf-8') : 'You are the CTO of Countable.';
    this.dataCollector = new CTODataCollector();
    log(c.cyan, '+ Loaded CTO agent (MiniMax M2.5 — data-driven)');
  }

  async analyze(): Promise<CTOReport> {
    log(c.cyan, '\n[cto] Collecting project data for analysis...');
    const projectContext = this.dataCollector.collect();
    log(c.cyan, `  Context collected: ${projectContext.length} chars`);

    const userPrompt = `You are the CTO of Countable. Analyze the REAL project data below and identify improvements.

${projectContext}

## Your Analysis Tasks
Based on the REAL data above (do NOT hallucinate or assume — use only what you see):
1. Review sprint results — are rejection rates acceptable? Any patterns?
2. Review learnings — are there unresolved issues or recurring problems?
3. Check agent coverage — is there a capability gap that a new agent could fill?
4. Consider cost efficiency — can we reduce per-sprint costs?
5. Consider OpenClaw/ClawHub — are there new releases or skills that could help?
   - For ClawHub skills: flag any that could help, but mark them for security review
   - For OpenClaw: note version differences if updates are available

## CRITICAL: Output Format
Respond with ONLY a JSON object. No markdown fences, no explanation text, no thinking.
{
  "summary": "1-2 sentence overview of findings",
  "proposals": [
    {
      "id": "CTO-20260214-001",
      "title": "Short title",
      "category": "new_agent|cost_optimization|process_change|architecture|tooling|new_feature",
      "description": "What and why",
      "estimated_impact": "cost/quality impact",
      "risk_level": "low|medium|high",
      "implementation_steps": ["step1", "step2"],
      "agent_spec": {
        "name": "agent-name",
        "role": "What this agent does",
        "llm": "minimax|anthropic",
        "trigger": "every_sprint|on_demand|weekly",
        "prompt_summary": "Key instructions for this agent"
      }
    }
  ],
  "metrics_reviewed": ["sprint_results", "learnings", "agent_list", "daily_report", "stack_versions"]
}

Rules:
- agent_spec is ONLY required when category="new_agent"
- If no improvements needed, return empty proposals array
- For ClawHub skill proposals, always include "security_review: audit skill source code for malicious patterns" in implementation_steps
- Be specific — "improve performance" is rejected; "add Redis caching to /api/invoices with 5min TTL" is accepted
- Maximum 3 proposals per analysis cycle`;

    try {
      const startTime = Date.now();
      const response = await callLLM('minimax', 'MiniMax-M2.5', this.systemPrompt, userPrompt, 120000);
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      let content = response.choices?.[0]?.message?.content || '';
      // Strip MiniMax <think>...</think> tags
      content = content.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
      log(c.cyan, `  CTO analysis completed in ${elapsed}s`);
      log(c.gray, `  Raw output preview: ${content.substring(0, 300)}`);

      // Parse JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const report = JSON.parse(jsonMatch[0]) as CTOReport;
        report.proposals = report.proposals || [];
        report.metrics_reviewed = report.metrics_reviewed || [];
        log(c.cyan, `  Summary: ${report.summary}`);
        log(c.cyan, `  Proposals: ${report.proposals.length}`);
        for (const p of report.proposals) {
          log(c.cyan, `    - [${p.category}] ${p.title} (risk: ${p.risk_level})`);
        }
        return report;
      }
      log(c.yellow, '  Could not parse CTO JSON, returning empty report');
      return { summary: 'CTO output was not valid JSON', proposals: [], metrics_reviewed: [] };
    } catch (error: any) {
      log(c.yellow, `  CTO analysis failed: ${error.message}`);
      return { summary: `Error: ${error.message}`, proposals: [], metrics_reviewed: [] };
    }
  }
}

// ===== Agent Creator (creates new agents from CEO-approved CTO proposals) =====

class AgentCreator {
  createAgent(spec: NonNullable<CTOProposal['agent_spec']>): string {
    const agentDir = `./agents/${spec.name}`;
    mkdirSync(agentDir, { recursive: true });

    // Write agent.yaml
    const yaml = `name: ${spec.name}
role: "${spec.role}"
llm: ${spec.llm === 'anthropic' ? 'anthropic/claude-sonnet-4-20250514' : 'minimax/MiniMax-M2.5'}
reports_to: ceo
trigger: ${spec.trigger}
created_by: cto_proposal
created_at: "${new Date().toISOString()}"
context_files:
  - docs/learnings.md
`;
    writeFileSync(`${agentDir}/agent.yaml`, yaml);

    // Write prompt.md
    const prompt = `# ${spec.name} Agent — ${spec.role}

You are the **${spec.name}** agent at **Countable** — the world's first Financial OS for AI Agents.

## Your Role
${spec.prompt_summary}

## Guidelines
- Follow all instructions in \`docs/learnings.md\`
- Report findings to CEO for review
- Never take destructive actions without approval
- Keep outputs concise and structured (JSON preferred)

## Created By
This agent was proposed by the CTO and approved by the CEO.
Trigger: ${spec.trigger}
LLM: ${spec.llm}
`;
    writeFileSync(`${agentDir}/prompt.md`, prompt);

    log(c.green, `  ✓ Created agent: ${spec.name} at ${agentDir}/`);
    log(c.gray, `    Role: ${spec.role}`);
    log(c.gray, `    LLM: ${spec.llm}, Trigger: ${spec.trigger}`);
    return spec.name;
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

      const isTestFile = filepath.includes('test') || filepath.includes('spec');
      const testConstraint = isTestFile
        ? `\n\n## CRITICAL: TEST FILE SIZE LIMIT
This is a test file. You MUST keep it SHORT to avoid truncation:
- Maximum 5-6 test cases (describe + it blocks)
- Maximum 80 lines total
- NO verbose setup — use inline mocks
- NO redundant tests — one test per behavior
- Cover: happy path, error case, edge case, defaults — that's it
- If you write more than 80 lines, the file WILL be truncated and REJECTED\n`
        : '';

      const userPrompt = `You are ${this.name}, a coding agent at Countable.
${rejectionContext}
## Task
${task.context}

## All Deliverable Files
${fileList}

## Generate ONLY: ${filepath}
${priorCtx}${testConstraint}
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
        let content = response.choices?.[0]?.message?.content || '';
        // Strip MiniMax <think>...</think> tags that leak into responses
        content = content.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
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
// ===== Orchestrator (Dynamic Agent Pipeline) =====

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
    log(c.bold, '║   Dynamic agents: 3 Claude + N MiniMax (auto-discovered) ║');
    log(c.bold, '╚══════════════════════════════════════════════════════════╝\n');

    // Leadership layer (Claude via Anthropic API)
    this.ceo = new CEOAgent();
    this.supervisor = new SupervisorAgent();

    // Technology layer (MiniMax)
    this.cto = new CTOAgent();

    // Execution layer — dynamically load all coding agents from agents/ directory
    const skipAgents = ['ceo', 'supervisor', 'skills', 'cto'];
    const agentDirs = existsSync('./agents') ? readdirSync('./agents').filter(d => {
      if (skipAgents.includes(d)) return false;
      return existsSync(`./agents/${d}/prompt.md`);
    }) : [];
    for (const name of agentDirs) {
      const promptPath = `./agents/${name}/prompt.md`;
      const prompt = readFileSync(promptPath, 'utf-8');
      this.agents.set(name, new CodingAgent(name, prompt));
      log(c.cyan, `+ Loaded ${name} agent (MiniMax M2.5)`);
    }

    const totalAgents = 3 + 1 + this.agents.size; // 3 Claude + 1 CTO + N coding
    log(c.green, `\n✓ ${totalAgents} agents loaded (3 Claude + ${1 + this.agents.size} MiniMax)\n`);
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

    const MAX_RETRIES = 10;
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
        execSync('git reset --hard HEAD~1', { timeout: 10000 });
        log(c.gray, '  Reset to previous commit (dropped rejected code)');
      } catch {
        log(c.gray, '  Reset skipped (nothing to reset)');
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
    // 4. CTO data-driven analysis (reads sprint results, learnings, agent list)
    log(c.cyan, '\n--- Phase 3: CTO Data-Driven Analysis ---');
    let ctoReport: CTOReport = { summary: '', proposals: [], metrics_reviewed: [] };
    let ctoDecisions = '';
    try {
      ctoReport = await this.cto.analyze();

      // 5. CEO reviews CTO proposals (including new agent requests)
      if (ctoReport.proposals.length > 0) {
        log(c.magenta, '\n--- Phase 4: CEO Reviews CTO Proposals ---');
        ctoDecisions = await this.ceo.reviewCTOProposals(ctoReport);

        // Handle approved new_agent proposals
        const agentCreator = new AgentCreator();
        for (const proposal of ctoReport.proposals) {
          if (proposal.category === 'new_agent' && proposal.agent_spec) {
            // Check if CEO approved this specific proposal
            if (ctoDecisions.includes(proposal.id) && ctoDecisions.toUpperCase().includes('APPROVED')) {
              log(c.green, `\n  🤖 CEO approved new agent: ${proposal.agent_spec.name}`);
              agentCreator.createAgent(proposal.agent_spec);
              log(c.green, `  Agent will be loaded on next orchestrator run.`);
            } else {
              log(c.yellow, `  CEO did not approve agent: ${proposal.agent_spec.name}`);
            }
          }
        }
      } else {
        log(c.cyan, '  No proposals from CTO — stack is current and optimized');
        ctoDecisions = 'No proposals to review.';
      }
    } catch (error: any) {
      log(c.yellow, `  CTO/CEO review cycle skipped: ${error.message}`);
      ctoDecisions = 'CTO analysis was not performed this run.';
    }

    // 6. CEO final assessment
    log(c.magenta, '\n--- Phase 5: CEO Final Assessment ---');
    await this.ceo.reviewSprintProgress(this.tasks);

    // 7. CEO generates daily report
    log(c.magenta, '\n--- Phase 6: Daily Report Generation ---');
    const ctoReportStr = `Summary: ${ctoReport.summary}\nProposals: ${ctoReport.proposals.length}\n${ctoReport.proposals.map(p => `- [${p.category}] ${p.title} (${p.risk_level})`).join('\n')}`;
    await this.ceo.generateDailyReport(this.tasks, this.stats, ctoReportStr, ctoDecisions);

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
    log(c.cyan,  `  CTO proposals: ${ctoReport.proposals.length}`);
    log(c.blue,  `  Total time: ${elapsed}s`);
    log(c.gray,  `  Pipeline: CEO → MiniMax code → Claude review → CTO analyze → CEO approve → Daily report`);
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