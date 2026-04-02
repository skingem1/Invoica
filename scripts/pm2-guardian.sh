#!/bin/bash
# pm2-guardian.sh — resurrect PM2 processes if table is empty
COUNT=$(pm2 jlist 2>/dev/null | python3 -c "import json,sys; print(len(json.load(sys.stdin)))" 2>/dev/null || echo 0)
if [ "$COUNT" -eq 0 ] || [ "$COUNT" = "0" ]; then
  echo "[pm2-guardian] $(date): 0 processes detected — resurrecting"
  pm2 resurrect 2>&1
  # If resurrect fails or is empty, start from ecosystem
  NEW_COUNT=$(pm2 jlist 2>/dev/null | python3 -c "import json,sys; print(len(json.load(sys.stdin)))" 2>/dev/null || echo 0)
  if [ "$NEW_COUNT" -lt 5 ]; then
    echo "[pm2-guardian] $(date): resurrect insufficient ($NEW_COUNT) — starting from ecosystem"
    cd /home/invoica/apps/Invoica && pm2 start ecosystem.config.js 2>&1
    pm2 save 2>&1
  fi
  echo "[pm2-guardian] $(date): recovered to $(pm2 jlist | python3 -c "import json,sys; print(len(json.load(sys.stdin)))" 2>/dev/null) processes"
fi
