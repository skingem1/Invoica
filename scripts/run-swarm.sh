#!/bin/bash
set -euo pipefail

# Invoica swarm runner with console capture
# Usage: ./scripts/run-swarm.sh <sprint-file>
# Captures stdout+stderr to logs/swarm-runs/<timestamp>.log via tee

INVOICA_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$INVOICA_ROOT"

# Source environment variables
set -a
source .env 2>/dev/null || true
set +a

SPRINT_FILE="${1:?Usage: ./scripts/run-swarm.sh <sprint-file>}"

if [ ! -f "$SPRINT_FILE" ]; then
  echo "ERROR: Sprint file not found: $SPRINT_FILE"
  exit 1
fi

mkdir -p logs/swarm-runs
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
LOG_FILE="logs/swarm-runs/${TIMESTAMP}.log"

echo "=== Invoica Swarm Run ==="
echo "Sprint:  $SPRINT_FILE"
echo "Log:     $LOG_FILE"
echo "Started: $(date)"
echo "========================="

npx ts-node --transpile-only scripts/orchestrate-agents-v2.ts "$SPRINT_FILE" 2>&1 | tee "$LOG_FILE"

echo ""
echo "=== Run Complete ==="
echo "Log saved to:  $LOG_FILE"
echo "Report:        reports/swarm-runs/latest-run.json"
