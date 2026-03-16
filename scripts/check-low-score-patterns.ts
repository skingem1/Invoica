#!/usr/bin/env ts-node
/**
 * Low-Score Pattern Monitor (MONITOR-001 / CTO-20260219-003)
 * Scans swarm-run reports and flags agents with consistently low review scores.
 *
 * Run: ts-node scripts/check-low-score-patterns.ts
 * Output: reports/cto/low-score-patterns-YYYY-MM-DD.json
 */

import * as fs from 'fs';
import * as path from 'path';

const SWARM_RUNS_DIR = path.join(__dirname, '..', 'reports', 'swarm-runs');
const OUTPUT_DIR = path.join(__dirname, '..', 'reports', 'cto');

interface TaskScore {
  taskId: string;
  agent: string;
  score: number;
  date: string;
  sprintFile: string;
}

interface AgentScoreReport {
  agentId: string;
  avgScore: number;
  taskCount: number;
  lowScoreCount: number;
  consecutiveLow: number;
  flag: boolean;
  scores: number[];
}

interface LowScoreReport {
  date: string;
  totalTasksScored: number;
  agentCount: number;
  flaggedAgents: number;
  agents: AgentScoreReport[];
}

function collectScores(): TaskScore[] {
  const scores: TaskScore[] = [];
  if (!fs.existsSync(SWARM_RUNS_DIR)) {
    console.log(`No swarm-runs directory found at ${SWARM_RUNS_DIR}`);
    return scores;
  }

  const files = fs.readdirSync(SWARM_RUNS_DIR).filter(f => f.endsWith('.json')).sort();
  for (const file of files) {
    try {
      const raw = fs.readFileSync(path.join(SWARM_RUNS_DIR, file), 'utf-8');
      const data = JSON.parse(raw);
      const runs = Array.isArray(data) ? data : [data];

      for (const run of runs) {
        const tasks = run.tasks || [];
        const sprintFile = run.sprint_file || file;
        const runDate = run.started_at?.substring(0, 10) || file.substring(0, 10);

        for (const task of tasks) {
          const review = task.review;
          const score = typeof review === 'object' && review !== null ? review.score : null;
          if (typeof score === 'number') {
            scores.push({
              taskId: task.task_id || task.id || 'unknown',
              agent: task.agent || 'unknown',
              score,
              date: runDate,
              sprintFile,
            });
          }
        }
      }
    } catch {
      // Skip malformed files
    }
  }
  return scores;
}

function analyzeAgent(agentId: string, scores: number[]): AgentScoreReport {
  const avg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  const lowCount = scores.filter(s => s < 70).length;

  let maxConsecutive = 0;
  let current = 0;
  for (const s of scores) {
    if (s < 70) {
      current++;
      maxConsecutive = Math.max(maxConsecutive, current);
    } else {
      current = 0;
    }
  }

  const flag = avg < 75 || maxConsecutive >= 3;

  return {
    agentId,
    avgScore: Math.round(avg * 10) / 10,
    taskCount: scores.length,
    lowScoreCount: lowCount,
    consecutiveLow: maxConsecutive,
    flag,
    scores,
  };
}

function main() {
  const allScores = collectScores();
  console.log(`Found ${allScores.length} scored tasks across swarm-run reports.`);

  // Group by agent
  const byAgent: Record<string, number[]> = {};
  for (const s of allScores) {
    if (!byAgent[s.agent]) byAgent[s.agent] = [];
    byAgent[s.agent].push(s.score);
  }

  const agents = Object.entries(byAgent).map(([id, scores]) => analyzeAgent(id, scores));
  agents.sort((a, b) => a.avgScore - b.avgScore);

  const report: LowScoreReport = {
    date: new Date().toISOString().substring(0, 10),
    totalTasksScored: allScores.length,
    agentCount: agents.length,
    flaggedAgents: agents.filter(a => a.flag).length,
    agents,
  };

  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const outputFile = path.join(OUTPUT_DIR, `low-score-patterns-${report.date}.json`);
  fs.writeFileSync(outputFile, JSON.stringify(report, null, 2));
  console.log(`Report written to ${outputFile}`);

  // Print summary
  console.log(`\n--- Low-Score Pattern Report (${report.date}) ---`);
  console.log(`Total scored tasks: ${report.totalTasksScored}`);
  console.log(`Agents with data: ${report.agentCount}`);
  console.log(`Flagged agents: ${report.flaggedAgents}`);

  if (agents.length > 0) {
    console.log('\nAgent breakdown:');
    for (const a of agents) {
      const marker = a.flag ? '🚩' : '✅';
      console.log(`  ${marker} ${a.agentId}: avg=${a.avgScore}, tasks=${a.taskCount}, low<70=${a.lowScoreCount}, consecutive=${a.consecutiveLow}`);
    }
  } else {
    console.log('\nNo scored tasks found in swarm-run reports.');
    console.log('This is expected if the sprint runner has not been active recently.');
  }
}

main();
