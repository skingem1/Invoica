#!/bin/bash
# Invoica backend startup wrapper
# Loads .env and starts the backend via ts-node (no build step required).
# Referenced by ecosystem.config.js as the PM2 entry point.
#
# If the backend needs a compiled build instead, replace the exec line with:
#   exec node /home/invoica/apps/Invoica/dist/backend/src/server.js

set -a
# shellcheck source=/dev/null
source /home/invoica/apps/Invoica/.env 2>/dev/null
set +a

cd /home/invoica/apps/Invoica

# Syntax-check TypeScript before starting.
# If an agent commit introduces a broken .ts file, bail immediately
# instead of looping thousands of times — PM2 unstable-restart kicks in
# after 15 bad exits and stops the process, preventing CPU burn.
if ! /home/invoica/apps/Invoica/node_modules/.bin/tsc \
    --project tsconfig.json --noEmit --skipLibCheck 2>&1 \
    | grep -qE "error TS1[0-9]{3}:"; then
  : # no errors, continue
else
  echo "[backend-wrapper] TypeScript SYNTAX errors (TS1xxx) detected — aborting to prevent crash loop:"
  /home/invoica/apps/Invoica/node_modules/.bin/tsc \
    --project tsconfig.json --noEmit --skipLibCheck 2>&1 \
    | grep -E "error TS1[0-9]{3}:" | head -10
  exit 1
fi

# Kill any stale process holding port 3001 before starting.
# Prevents EADDRINUSE crash loop when PM2 restarts faster than the old
# ts-node process releases the port.
fuser -k 3001/tcp 2>/dev/null || true
# Wait up to 5s for the port to be fully released.
for i in 1 2 3 4 5; do
  sleep 1
  fuser 3001/tcp 2>/dev/null || break
  fuser -k 3001/tcp 2>/dev/null || true
done

exec /home/invoica/apps/Invoica/node_modules/.bin/ts-node \
  --project tsconfig.json \
  --transpile-only \
  backend/src/server.ts
