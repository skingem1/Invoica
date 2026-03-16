# Low-Score Pattern Monitoring Assessment (CTO-20260219-003)

**Date**: 2026-03-16
**Assessor**: Claude Opus 4.6 (prod session)
**Decision**: IMPLEMENTED as standalone script

## Findings

### Data Available
- **Swarm-run reports found**: 10 JSON files in `reports/swarm-runs/`
- **Tasks with review scores**: 4 (out of ~26 total tasks across all runs)
- **Agents with scores**: 1 ("unknown" — agent field not populated in older runs)
- **Score data quality**: Very sparse. Most runs have empty `tasks[]` arrays (wallet $0, no API budget).

### Root Cause of Sparse Data
The sprint runner has been mostly inactive due to:
1. Wallet balance $0 (no x402 budget for cloud LLM calls)
2. Most tasks were completed manually via Claude Code sessions, not through the swarm

### Pattern Analysis
- Only agent "unknown" has scored data: 4 tasks, all score=0 (rejected tasks)
- This is NOT a low-score pattern — it's a missing-data pattern. The agents aren't scoring low; they're not running at all.

## Implementation

Created `scripts/check-low-score-patterns.ts`:
- Scans all `reports/swarm-runs/*.json` files
- Extracts review scores per agent
- Calculates: avg score, low-score count (<70), max consecutive low
- Flags agents with avg < 75 OR 3+ consecutive tasks < 70
- Outputs JSON report to `reports/cto/low-score-patterns-YYYY-MM-DD.json`
- Can be added as PM2 cron (e.g., daily at 08:00) when swarm activity resumes

## Recommendation
- **No action needed now** — insufficient data to detect patterns
- **Revisit when** sprint runner resumes active execution (wallet funded)
- Script is ready and can be triggered manually or via PM2 cron
- Consider adding `agent` field to all sprint task specs to improve data quality
