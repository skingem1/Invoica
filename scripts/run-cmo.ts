#!/usr/bin/env ts-node

/**
 * Invoica CMO Runner
 *
 * Standalone script that executes CMO tasks via Manus AI.
 * Run manually or via PM2 cron schedule.
 *
 * Usage:
 *   npx ts-node scripts/run-cmo.ts <task-type> [additional-context]
 *
 * Task types:
 *   market-watch      - Daily competitive intelligence report
 *   strategy-report   - Weekly strategy and brand report
 *   brand-review      - On-demand brand assessment
 *   product-proposal  - On-demand product proposal (pass focus area as context)
 *   x-admin-design    - Design the X Admin Agent specification
 *   website-audit     - Website strategy review
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { join } from 'path';
import 'dotenv/config';
import { ManusClient, ManusTaskResult } from './lib/manus-client';

// ===== Types =====

type CMOTaskType =
  | 'market-watch'
  | 'strategy-report'
  | 'brand-review'
  | 'product-proposal'
  | 'x-admin-design'
  | 'website-audit';

const VALID_TASKS: CMOTaskType[] = [
  'market-watch', 'strategy-report', 'brand-review',
  'product-proposal', 'x-admin-design', 'website-audit',
];

// ===== Colors =====

const c = {
  reset: '\x1b[0m', bold: '\x1b[1m',
  red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m',
  blue: '\x1b[34m', magenta: '\x1b[35m', cyan: '\x1b[36m', gray: '\x1b[90m',
};

function log(color: string, msg: string) {
  console.log(color + msg + c.reset);
}

// ===== CMO Runner =====

class CMORunner {
  private client: ManusClient;
  private cmoPrompt: string;
  private reportsDir: string;
  private projectRoot: string;

  constructor() {
    this.projectRoot = join(__dirname, '..');
    this.client = new ManusClient({});

    // Load CMO system prompt
    const promptPath = join(this.projectRoot, 'agents/cmo/prompt.md');
    if (!existsSync(promptPath)) {
      throw new Error('CMO prompt not found: ' + promptPath);
    }
    this.cmoPrompt = readFileSync(promptPath, 'utf-8');

    // Ensure reports directory exists
    this.reportsDir = join(this.projectRoot, 'reports/cmo');
    mkdirSync(this.reportsDir, { recursive: true });

    log(c.magenta, '\n' + '='.repeat(60));
    log(c.magenta, '  Invoica CMO Agent (Manus AI)');
    log(c.magenta, '='.repeat(60));
  }

  async run(taskType: CMOTaskType, additionalContext?: string): Promise<string> {
    log(c.cyan, '\n[cmo] Starting task: ' + taskType);
    const startTime = Date.now();

    // 1. Build the full prompt
    const taskPrompt = this.buildTaskPrompt(taskType, additionalContext);
    const fullPrompt = this.cmoPrompt + '\n\n---\n\n## Current Task: ' + taskType + '\n\n' + taskPrompt;

    log(c.gray, '  Prompt length: ' + fullPrompt.length + ' chars');

    // 2. Execute via Manus
    log(c.cyan, '[cmo] Sending to Manus AI...');
    const result = await this.client.executeTask({ prompt: fullPrompt });

    // 3. Save report
    const reportPath = this.saveReport(taskType, result.output);
    log(c.green, '[cmo] Report saved: ' + reportPath);

    // 4. Update latest pointer
    this.updateLatestReport(taskType, reportPath);

    // 5. Log metrics
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    log(c.cyan, '\n[cmo] Task complete');
    log(c.gray, '  Status: ' + result.status);
    log(c.gray, '  Duration: ' + elapsed + 's');
    log(c.gray, '  Manus polls: ' + result.pollAttempts);
    log(c.gray, '  Output length: ' + result.output.length + ' chars');

    return reportPath;
  }

  private buildTaskPrompt(taskType: CMOTaskType, additionalContext?: string): string {
    const today = new Date().toISOString().split('T')[0];
    const dayOfWeek = new Date().toLocaleDateString('en-US', { weekday: 'long' });

    // Gather context from existing reports
    const existingContext = this.gatherContext(taskType);

    const taskInstructions: Record<CMOTaskType, string> = {
      'market-watch': [
        'Produce today\'s Market Watch Report for Invoica (invoica.ai).',
        'Today is ' + today + ' (' + dayOfWeek + ').',
        '',
        'Research the current state of:',
        '- x402 protocol ecosystem and adoption (check GitHub repos, blog posts, announcements)',
        '- AI agent payment infrastructure competitors (Stripe, Coinbase Commerce, PayAI, Paygentic)',
        '- Relevant regulatory developments affecting AI payments',
        '- Technology trends: new AI agent frameworks, payment protocols, LLM capabilities',
        '- Crypto and DeFi developments relevant to machine-to-machine payments',
        '',
        'Output in the Market Watch Report format specified in your system prompt.',
        'Include specific URLs as sources for every claim.',
      ].join('\n'),

      'strategy-report': [
        'Produce this week\'s Strategy Report for Invoica.',
        'Today is ' + today + '.',
        '',
        'Synthesize insights from recent market intelligence.',
        'Include:',
        '- Brand health assessment (how is Invoica positioned vs competitors?)',
        '- Website strategy recommendations (based on competitor site analysis)',
        '- Social media content strategy for the coming week',
        '- Product pipeline recommendations (features or products to consider)',
        '- Any marketing budget recommendations (keep lean — we are pre-revenue)',
        '',
        'Output in the Weekly Strategy Report format.',
      ].join('\n'),

      'brand-review': [
        'Conduct a comprehensive brand review for Invoica (invoica.ai).',
        '',
        'Analyze:',
        '- Visual identity: how should our colors, typography, and design language feel?',
        '- Messaging: is our positioning ("Stripe for AI Agents") clear and differentiated?',
        '- Brand consistency: what guidelines should all materials follow?',
        '- Competitor branding: how do Stripe, Coinbase, and other fintech brands present?',
        '- Developer brand perception: what makes developer tools feel trustworthy?',
        '',
        'Note: The brand recently transitioned from "Countable" to "Invoica".',
        'Propose a complete brand guide with color palette, typography, voice, and visual style.',
      ].join('\n'),

      'product-proposal': [
        'Based on current market intelligence, propose a new product or feature',
        'for the Invoica platform.',
        '',
        additionalContext ? 'Focus area: ' + additionalContext : 'Identify the highest-impact market gap.',
        '',
        'Research the market thoroughly before proposing.',
        'Output in the Product Proposal format (use PROP-001 as the ID).',
        'Include real market data, competitor analysis, and revenue projections.',
      ].join('\n'),

      'x-admin-design': [
        'Design the complete specification for an X Admin Agent.',
        'This agent will manage Invoica\'s X/Twitter presence.',
        '',
        'Include in your specification:',
        '- Required X API v2 endpoints and permissions',
        '- OAuth 2.0 setup requirements',
        '- Content strategy: pillars, posting frequency, content mix',
        '- Posting schedule with optimal times for crypto/AI developer audience',
        '- Engagement rules: when to reply, retweet, like, or ignore',
        '- Content queue workflow: CMO designs content → CEO approves → Agent posts',
        '- Approval workflow integration with the orchestrator',
        '- Analytics: what metrics to track (impressions, engagement rate, follower growth)',
        '- Safety guardrails: rate limits, content filters, escalation rules',
        '- Technical implementation: agent.yaml and prompt.md structure',
        '',
        'This must be detailed enough for the Skills Agent to implement.',
      ].join('\n'),

      'website-audit': [
        'Analyze the ideal invoica.ai website strategy.',
        '',
        'Provide recommendations for:',
        '- Landing page: hero section, value proposition hierarchy, social proof, CTAs',
        '- Developer documentation: structure, navigation, getting-started flow',
        '- Pricing page: tier structure, free tier, usage-based pricing model',
        '- SEO strategy: target keywords, meta descriptions, content priorities',
        '- Conversion optimization: visitor → signup → active developer pipeline',
        '',
        'Compare to competitor websites:',
        '- stripe.com (gold standard for developer payments)',
        '- coinbase.com/commerce (crypto payments)',
        '- vercel.com (developer tool branding excellence)',
        '',
        'Provide actionable wireframe descriptions for key pages.',
      ].join('\n'),
    };

    let prompt = taskInstructions[taskType];

    // Add existing context if available
    if (existingContext) {
      prompt += '\n\n## Previous Context\n' + existingContext;
    }

    // Add additional user context
    if (additionalContext && taskType !== 'product-proposal') {
      prompt += '\n\n## Additional Context from CEO\n' + additionalContext;
    }

    return prompt;
  }

  /**
   * Gather relevant context from existing reports for continuity.
   */
  private gatherContext(taskType: CMOTaskType): string {
    const sections: string[] = [];

    // Brand guidelines (if they exist)
    const brandPath = join(this.projectRoot, 'docs/brand-guidelines.md');
    if (existsSync(brandPath)) {
      const content = readFileSync(brandPath, 'utf-8');
      sections.push('### Existing Brand Guidelines (summary)\n' + content.substring(0, 2000));
    }

    // For strategy reports, attach recent market watches
    if (taskType === 'strategy-report') {
      const recentReports = this.getRecentReports('market-watch', 5);
      if (recentReports.length > 0) {
        sections.push('### Recent Market Watch Reports');
        for (const report of recentReports) {
          // Include just the executive summary of each
          const summary = this.extractSection(report.content, 'Executive Summary');
          sections.push('**' + report.date + '**: ' + (summary || report.content.substring(0, 300)));
        }
      }
    }

    // For product proposals, attach latest strategy report
    if (taskType === 'product-proposal') {
      const latestStrategy = join(this.reportsDir, 'latest-strategy-report.md');
      if (existsSync(latestStrategy)) {
        const content = readFileSync(latestStrategy, 'utf-8');
        sections.push('### Latest Strategy Report\n' + content.substring(0, 2000));
      }
    }

    return sections.join('\n\n');
  }

  /**
   * Get recent reports of a given type, sorted by date descending.
   */
  private getRecentReports(taskType: string, count: number): Array<{ date: string; content: string }> {
    if (!existsSync(this.reportsDir)) return [];

    const files = readdirSync(this.reportsDir)
      .filter(f => f.startsWith(taskType + '-') && f.endsWith('.md'))
      .sort()
      .reverse()
      .slice(0, count);

    return files.map(f => ({
      date: f.replace(taskType + '-', '').replace('.md', ''),
      content: readFileSync(join(this.reportsDir, f), 'utf-8'),
    }));
  }

  /**
   * Extract a specific markdown section from content.
   */
  private extractSection(content: string, sectionName: string): string | null {
    const regex = new RegExp('## ' + sectionName + '\\n([\\s\\S]*?)(?=\\n## |$)');
    const match = content.match(regex);
    return match ? match[1].trim().substring(0, 500) : null;
  }

  /**
   * Save report to dated file.
   */
  private saveReport(taskType: CMOTaskType, content: string): string {
    const date = new Date().toISOString().split('T')[0];
    const filename = taskType + '-' + date + '.md';
    const filepath = join(this.reportsDir, filename);
    writeFileSync(filepath, content);
    return filepath;
  }

  /**
   * Update the "latest" pointer file for orchestrator consumption.
   */
  private updateLatestReport(taskType: CMOTaskType, reportPath: string): void {
    const latestPath = join(this.reportsDir, 'latest-' + taskType + '.md');
    const content = readFileSync(reportPath, 'utf-8');
    writeFileSync(latestPath, content);
    log(c.gray, '  Updated latest pointer: latest-' + taskType + '.md');
  }
}

// ===== CLI Entry Point =====

async function main() {
  const taskType = process.argv[2] as CMOTaskType;
  const additionalContext = process.argv.slice(3).join(' ') || undefined;

  if (!taskType || !VALID_TASKS.includes(taskType)) {
    console.log('Usage: npx ts-node scripts/run-cmo.ts <task-type> [context]');
    console.log('');
    console.log('Task types:');
    console.log('  market-watch      Daily competitive intelligence');
    console.log('  strategy-report   Weekly strategy and brand report');
    console.log('  brand-review      Brand assessment and guidelines');
    console.log('  product-proposal  New product proposal (pass focus as context)');
    console.log('  x-admin-design    X Admin Agent specification');
    console.log('  website-audit     Website strategy review');
    console.log('');
    console.log('Examples:');
    console.log('  npx ts-node scripts/run-cmo.ts market-watch');
    console.log('  npx ts-node scripts/run-cmo.ts product-proposal "agent-to-agent marketplace"');
    process.exit(1);
  }

  try {
    const runner = new CMORunner();
    const reportPath = await runner.run(taskType, additionalContext);

    log(c.green, '\n' + '='.repeat(60));
    log(c.green, '  CMO task complete: ' + taskType);
    log(c.green, '  Report: ' + reportPath);
    log(c.green, '='.repeat(60) + '\n');

    process.exit(0);
  } catch (error: any) {
    log(c.red, '\n[cmo] FAILED: ' + error.message);
    if (error.stack) {
      log(c.gray, error.stack);
    }
    process.exit(1);
  }
}

main();
