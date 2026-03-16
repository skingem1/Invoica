#!/bin/bash
# Invoica backend startup wrapper
# Loads .env and starts the backend via ts-node (no build step required).

set -a
source /home/invoica/apps/Invoica/.env 2>/dev/null
set +a

cd /home/invoica/apps/Invoica

# ── Mutex lock — prevents parallel wrapper instances competing for port 3001 ──
# If PM2 spawns multiple wrappers (e.g. rapid restarts, reload cascade), only
# one proceeds. Others wait up to 90s for the lock, then exit cleanly.
# flock fd is inherited by exec ts-node — held until ts-node exits.
LOCK_FILE="/tmp/invoica-backend.lock"
exec 200>"$LOCK_FILE"
if ! flock -w 90 200; then
  echo "[backend-wrapper] Could not acquire startup lock within 90s — another instance is starting. Exiting."
  exit 0
fi
echo "[backend-wrapper] Lock acquired (fd 200). Starting backend."

# Syntax-check BACKEND TypeScript only (not scripts/ or agents/).
# Using backend/tsconfig.json prevents agent-written script errors from
# crashing the production API — the most common cause of the restart cascade.
if ! /home/invoica/apps/Invoica/node_modules/.bin/tsc \
    --project backend/tsconfig.json --noEmit --skipLibCheck 2>&1 \
    | grep -qE "error TS1[0-9]{3}:"; then
  : # no syntax errors, continue
else
  echo "[backend-wrapper] TypeScript SYNTAX errors (TS1xxx) in backend — aborting:"
  /home/invoica/apps/Invoica/node_modules/.bin/tsc \
    --project backend/tsconfig.json --noEmit --skipLibCheck 2>&1 \
    | grep -E "error TS1[0-9]{3}:" | head -10
  exit 1
fi

# Wait for port 3001 to be free (graceful wait, then force-kill only if needed).
# Increased to 30s to accommodate PM2 graceful shutdown (kill_timeout: 15s + buffer).
PORT_FREE=false
for i in $(seq 1 30); do
  if ! lsof -ti :3001 >/dev/null 2>&1; then
    PORT_FREE=true
    break
  fi
  sleep 1
done

if [ "$PORT_FREE" = "false" ]; then
  echo "[backend-wrapper] Port 3001 still busy after 30s — force-killing zombie holder"
  lsof -ti :3001 | xargs kill -9 2>/dev/null || true
  sleep 2
fi

# exec: replaces bash with ts-node (same PID — PM2 tracks correctly).
# The flock fd (200) is inherited by ts-node and held until ts-node exits.
exec /home/invoica/apps/Invoica/node_modules/.bin/ts-node \
  --project tsconfig.json \
  --transpile-only \
  backend/src/server.ts
