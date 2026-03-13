#!/bin/bash
# git-autodeploy.sh — polls GitHub every 5 min, self-deploys new commits
# Runs as a PM2 cron process (fire-and-forget, autorestart: false)
#
# What it does:
#   0. ALWAYS: self-heal ceo-ai-bot if not online (runs every 5 min, not just on new commits)
#   1. git fetch to check for new commits
#   2. If nothing new → exit 0 (silent)
#   3. If new commit → git pull, detect which services changed, restart them
#   4. Logs every deployment with commit hash + changed files

set -euo pipefail

APP_DIR="/home/invoica/apps/Invoica"
cd "$APP_DIR"

TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# ── Lock file guard — prevent overlapping cron runs ────────────────────────────
# If a previous deploy is still running (e.g. pm2 save is slow), skip this run.
LOCK_FILE="$APP_DIR/logs/git-autodeploy.lock"  # app-owned dir — no root/invoica permission conflict
if [ -f "$LOCK_FILE" ]; then
  LOCK_PID=$(cat "$LOCK_FILE" 2>/dev/null || echo "")
  if [ -n "$LOCK_PID" ] && kill -0 "$LOCK_PID" 2>/dev/null; then
    echo "[$TIMESTAMP] [AutoDeploy] Another instance already running (PID $LOCK_PID) — skipping this run"
    exit 0
  fi
  # Stale lock — previous run crashed without cleaning up
  echo "[$TIMESTAMP] [AutoDeploy] Stale lock file (PID $LOCK_PID gone) — removing and continuing"
fi
echo $$ > "$LOCK_FILE"
trap 'rm -f "$LOCK_FILE"' EXIT

# ── 0. (removed) ceo-ai-bot self-heal ────────────────────────────────────────
# ceo-ai-bot is managed by root PM2 daemon. This script runs as invoica user
# and cannot see root PM2 — the old self-heal was spawning duplicate phantom
# processes in the invoica PM2. Root PM2's autorestart handles recovery.

# ── 1. Fetch remote silently ──────────────────────────────────────────
git fetch origin main --quiet 2>/dev/null

LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/main)

if [ "$LOCAL" = "$REMOTE" ]; then
  echo "[$TIMESTAMP] [AutoDeploy] No changes (HEAD=$LOCAL)"
  exit 0
fi

# ── 2. New commit detected ────────────────────────────────────────────
echo "[$TIMESTAMP] [AutoDeploy] New commit: $LOCAL → $REMOTE"

# ── 3. Pull ───────────────────────────────────────────────────────────
# Pull FIRST, then diff using the pre-pull hash ($LOCAL) vs new HEAD.
# This avoids a race condition where a concurrent push between diff and pull
# causes CHANGED to miss newly-arrived files. ORIG_HEAD is not reliable
# with --rebase, so we use the saved $LOCAL hash directly.

# Hard-reset to origin/main. This is safer than git pull --rebase when the
# sprint runner has local commits (agent code, sprint JSON updates). Rebase
# was causing interactive-rebase conflicts blocking all future deploys.
# Runtime files (.wallet-alert-state.json, sprints/*.json, reports/) are
# untracked or gitignored so they survive the reset.
git reset --hard origin/main --quiet
echo "[$TIMESTAMP] [AutoDeploy] Hard-reset to origin/main (was $LOCAL, now $(git rev-parse HEAD))"

# Get changed files by comparing pre-pull hash to new HEAD
CHANGED=$(git diff --name-only "$LOCAL" HEAD)
echo "[$TIMESTAMP] [AutoDeploy] Changed files:"
echo "$CHANGED" | sed 's/^/  /'

# ── 4. Restart affected services ─────────────────────────────────────

# Backend: only restart on code/config changes — skip docs, markdown, fixtures
# Also trigger on backend-wrapper.sh (root-level startup script)
BACKEND_CHANGED=false
if echo "$CHANGED" | grep "^backend/" | grep -qE "\.(ts|js|json|prisma|sh)$"; then
  BACKEND_CHANGED=true
fi
if echo "$CHANGED" | grep -q "^backend-wrapper\.sh$"; then
  BACKEND_CHANGED=true
fi
if [ "$BACKEND_CHANGED" = "true" ]; then
  # Migration lockfile guard — skip restart if a prisma migrate/push is in progress.
  # Any script running migrations must: touch /tmp/invoica-migration.lock before
  # starting and rm /tmp/invoica-migration.lock on exit (trap or explicit).
  # Prevents orphaned Prisma child processes that survive a force-kill mid-migration.
  if [ -f /tmp/invoica-migration.lock ]; then
    echo "[$TIMESTAMP] [AutoDeploy] Migration in progress (/tmp/invoica-migration.lock) — skipping backend restart, will retry next cron tick"
    exit 0
  fi

  echo "[$TIMESTAMP] [AutoDeploy] backend changed → restarting backend"
  # Use 'restart' (not 'reload') — reload starts new process while old holds port 3001,
  # causing EADDRINUSE cascade. Restart kills old first, then starts new cleanly.
  pm2 restart backend --update-env
  echo "[$TIMESTAMP] [AutoDeploy] backend restarted"
fi

# CEO AI bot (standalone process — replaces the old telegram-bot PM2 entry)
if echo "$CHANGED" | grep -q "^scripts/run-ceo-bot\.ts$"; then
  echo "[$TIMESTAMP] [AutoDeploy] run-ceo-bot.ts changed → restarting ceo-ai-bot"
  pm2 restart ceo-ai-bot
  echo "[$TIMESTAMP] [AutoDeploy] ceo-ai-bot restarted"
fi

# Heartbeat daemon (cron-based — will pick up changes on next cron fire, no restart needed)
if echo "$CHANGED" | grep -q "^scripts/heartbeat-daemon\.ts$"; then
  echo "[$TIMESTAMP] [AutoDeploy] heartbeat-daemon.ts changed — will apply on next hourly cron"
fi

# Mission Control startup wrapper (long-running — restart on script change)
if echo "$CHANGED" | grep -qE "^scripts/run-mission-control\.sh$"; then
  echo "[$TIMESTAMP] [AutoDeploy] run-mission-control.sh changed → restarting mission-control"
  pm2 restart mission-control --update-env || true
  echo "[$TIMESTAMP] [AutoDeploy] mission-control restarted"
fi

# ecosystem.config.js: reload PM2 so new/removed processes take effect
if echo "$CHANGED" | grep -q "^ecosystem\.config\.js$"; then
  echo "[$TIMESTAMP] [AutoDeploy] ecosystem.config.js changed → reloading PM2"
  # Delete the retired telegram-bot process if it still exists
  if pm2 list | grep -q "telegram-bot"; then
    pm2 delete telegram-bot || true
    echo "[$TIMESTAMP] [AutoDeploy] Deleted retired telegram-bot process"
  fi
  # Load .env into shell environment (avoids xargs quoting issues with special chars)
  set -a; source .env; set +a
  # Start any NEW processes defined in ecosystem that aren't running yet
  pm2 start ecosystem.config.js --update-env
  # Reload (graceful restart) all existing processes with updated env
  pm2 reload ecosystem.config.js --update-env
  # Persist process list so it survives server reboots
  pm2 save
  echo "[$TIMESTAMP] [AutoDeploy] PM2 ecosystem reloaded"
fi

# ── 5. Restart services whose env changed (even if no code changed) ──────────
# .env changes don't match code file extensions — handle separately so env
# updates (new API keys, config tweaks) actually take effect at runtime.
if echo "$CHANGED" | grep -qE "^\.env$"; then
  echo "[$TIMESTAMP] [AutoDeploy] .env changed → reloading backend + ceo-ai-bot with updated env"
  pm2 restart backend --update-env
  pm2 restart ceo-ai-bot --update-env
  echo "[$TIMESTAMP] [AutoDeploy] env-only reload complete"
fi

echo "[$TIMESTAMP] [AutoDeploy] ✅ Done — deployed $REMOTE"
