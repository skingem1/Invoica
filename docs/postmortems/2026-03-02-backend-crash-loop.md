# Post-Mortem: Backend Crash Loop (Port 3001 Instability)
**Date:** March 2-3, 2026  
**Incident:** Backend service crash loop; 16,967+ restarts logged  
**Impact:** API instability, unknown downtime windows, development velocity impact  
**Status:** Partially mitigated; root cause addressed but not verified stable

---

## Timeline

- **March 2, ~10:50 UTC**: Backend crash loop begins (port 3001 conflicts)
- **March 2, 11:12 UTC**: First fix attempt — static asset copy (commit 3c515a5)
- **March 2, 11:23 UTC**: Second fix — kill stale port before restart (commit 7c10b0b)
- **March 2, 11:50 UTC**: Third fix — TS commit validation + stronger port wait (commit b2ea659)
- **March 2, 15:00 UTC**: Last error logged in health.json (per continuity brief)
- **March 3, 22:00 UTC**: Backend showing 2-minute uptime (recent restart but API operational)

---

## What Happened

### The Symptoms
- PM2 shows **16,967 restarts** for backend process
- Backend uptime cycles between **0-5 minutes** instead of hours/days
- Port 3001 conflicts preventing clean startup
- Health.json status: **critical** (but API shows operational)

### The Trigger
Bad TypeScript commits from Sprint 9 mass-rejections introduced syntax errors or missing dependencies that prevented backend from binding to port 3001 cleanly.

### Cascade Effect
1. Backend crashes on startup (syntax error or missing module)
2. PM2 auto-restarts backend
3. Port 3001 still held by dying process
4. New backend instance can't bind to port → crashes again
5. Loop repeats 16,967+ times

---

## Root Causes

### 1. Weak Port Cleanup Logic
**Problem:** Backend startup didn't verify port 3001 was free before attempting to bind.

**Why it happened:**
- Original startup assumed clean environment
- No `fuser -k 3001/tcp` or equivalent before `app.listen(3001)`
- PM2 restart-on-crash creates race condition with port release

**Fix applied (7c10b0b):**
```bash
# Kill any process on 3001 before backend starts
fuser -k 3001/tcp 2>/dev/null || true
```

### 2. TypeScript Commit Validation Gap
**Problem:** Malformed TypeScript from Sprint 9 rejections committed to main without syntax validation.

**Why it happened:**
- Sprint-runner commits code after supervisor approval
- No pre-commit TSC check
- Git-autodeploy pulls and restarts without build validation

**Fix applied (b2ea659):**
- Added TS commit validation to prevent syntax errors reaching main
- Stronger port wait logic (verify listening before marking healthy)

### 3. PM2 Aggressive Restart Policy
**Problem:** PM2 set to restart immediately on crash with no backoff.

**Why it happened:**
- Default `restart_delay: 0` in ecosystem.config.js
- No max_restarts threshold to stop runaway loops
- Crash → instant restart → instant crash creates tight loop

**Fix needed (NOT YET APPLIED):**
```javascript
// ecosystem.config.js
{
  name: 'backend',
  restart_delay: 5000,        // 5-second backoff
  max_restarts: 10,           // Stop after 10 attempts in 1 minute
  min_uptime: 10000,          // Must stay up 10s to count as success
}
```

### 4. Missing Module (Current Issue)
**Evidence from daily-log-2026-03-03.md:**
```
MODULE_NOT_FOUND: `../lib/pdf-generator` missing in `invoices.ts` route
(persistent since 16:40 UTC, crash loop)
```

**Current state:** Backend showing 2-minute uptime suggests this issue may still be active or recently fixed.

---

## What Worked

1. **Fast iteration on fixes** — 3 commits in 40 minutes addressing different failure modes
2. **Git-autodeploy** — fixes deployed automatically within 5 minutes of commit
3. **PM2 resilience** — despite 16,967 restarts, PM2 never gave up; backend eventually stabilized
4. **API operational** — despite backend instability, API endpoints responding (health shows operational)

---

## What Failed

1. **Pre-commit validation** — syntax errors reached production
2. **Monitoring lag** — crash loop not detected until thousands of restarts had occurred
3. **Fix verification** — no confirmation that 11:50 UTC fix actually resolved issue (logs stale)
4. **Circuit breaker** — no automatic "stop trying after 100 restarts" logic

---

## Fixes Applied

### Commit 7c10b0b (March 2, 11:23 UTC)
```bash
# Kill stale processes holding port 3001
fuser -k 3001/tcp 2>/dev/null || true
```

### Commit b2ea659 (March 2, 11:50 UTC)
- TypeScript commit validation before allowing merge
- Stronger port wait logic (verify socket listening)
- Timeout guards to prevent hang during startup

### Commit 3c515a5 (March 2, 11:12 UTC)
- Static asset copy to Mission Control standalone directory
- Prevents 404s on MC dashboard assets

---

## Fixes Still Needed

### 1. PM2 Restart Backoff (HIGH PRIORITY)
Add exponential backoff and max_restarts to ecosystem.config.js:
```javascript
restart_delay: 5000,
max_restarts: 10,
min_uptime: 10000,
exp_backoff_restart_delay: 100
```

### 2. Pre-Commit Build Validation (MEDIUM PRIORITY)
Add GitHub Action or pre-commit hook:
```yaml
- run: cd backend && npm run build
- run: tsc --noEmit  # Validate TypeScript without emitting files
```

### 3. Crash Loop Alerting (MEDIUM PRIORITY)
Monitor PM2 restart count and alert CEO if:
- Restarts exceed 100 in 10 minutes
- Uptime never exceeds 60 seconds for 5 consecutive starts

### 4. Missing Module Resolution (IMMEDIATE)
Verify `backend/src/lib/pdf-generator.ts` exists or remove import from `invoices.ts`.

---

## Verification Status

**UNVERIFIED** — Last error logged at 10:50 UTC; fix deployed 11:50 UTC, but:
- Health.json shows last heartbeat from March 2, 15:00 UTC (9+ hours stale)
- PM2 shows backend uptime of 2 minutes (as of March 3, 22:00 UTC)
- Daily log shows MODULE_NOT_FOUND error persisting through 16:40 UTC

**Action required:** Manual SSH to production server to:
1. Check PM2 logs: `pm2 logs backend --lines 50`
2. Verify port 3001 responding: `curl http://localhost:3001/health`
3. Confirm restart count stabilized: `pm2 describe backend | grep restart_time`

---

## Lessons Learned

### For Infrastructure
- **Port cleanup is mandatory** — never assume clean environment on restart
- **Backoff prevents runaway costs** — aggressive restart without delay = tight crash loops
- **Pre-commit validation saves hours** — 1 syntax error = 16,967 restarts

### For Monitoring
- **Restart count is a critical metric** — should alert at 10, escalate at 100
- **Health.json staleness is a bug** — 9-hour-old heartbeat is invisible failure
- **Logs must be real-time** — "last error at 10:50" is useless if current time is 22:00

### For Process
- **Fix verification is mandatory** — "deployed fix" ≠ "confirmed working"
- **One fix at a time** — 3 commits in 40 minutes makes it hard to know which one worked
- **Circuit breakers prevent waste** — after 100 restarts, stop and escalate to human

---

## Cost of Failure

- **Direct:** Unknown downtime windows (API shows operational but backend cycling)
- **Indirect:** 16,967 restarts = CPU churn, log noise, monitoring overhead
- **Risk:** If MODULE_NOT_FOUND still active, next git-autodeploy could restart the loop

**Impact:** Development velocity impacted; can't trust backend stability for production user onboarding.

---

## Action Items

| Item | Owner | Status | Deadline |
|------|-------|--------|----------|
| SSH to prod, verify backend stable | CEO | NOT STARTED | Immediate |
| Add PM2 restart backoff to ecosystem.config.js | DevOps | NOT STARTED | End of day |
| Implement crash loop alerting | Monitoring agent | NOT STARTED | End of week |
| Add pre-commit TS validation | CTO | NOT STARTED | Sprint 11 |
| Resolve MODULE_NOT_FOUND for pdf-generator | Backend-core | NOT STARTED | Immediate |

---

## Sign-Off

This post-mortem is accurate as of March 3, 2026, 22:30 UTC.

**Status: UNVERIFIED STABLE** — fixes deployed but not confirmed working.

CEO must manually verify backend stability before considering this incident resolved.

—CEO, Invoica
