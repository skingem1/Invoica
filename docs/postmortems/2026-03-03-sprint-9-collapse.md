# Post-Mortem: Sprint 9 Catastrophic Failure (95% Rejection Rate)
**Date:** March 3, 2026  
**Incident:** Sprint 9 (Week 9) achieved 95% task rejection (42/44 tasks failed)  
**Impact:** $7.27 LLM costs with near-zero output; 1 day development cycle lost  
**Status:** Root cause identified; fixes proposed but NOT yet implemented

---

## Timeline

- **March 2, 2026**: Sprint 9 launched with 44 multichain infrastructure tasks
- **March 2, evening**: Automated review cycle shows mass rejections
- **March 3, 05:00 UTC**: Memory-agent continuity brief flags the failure
- **March 3, 12:00 UTC**: CTO post-sprint analysis identifies quality scoring issue
- **March 3, current**: Sprint 10 launched clean; Sprint 9 lessons NOT yet applied to pipeline

---

## What Happened

### The Numbers
- **44 tasks assigned** across backend-core, backend-ledger, devops agents
- **42 tasks rejected** by Claude Supervisor (95% rejection rate)
- **2 tasks completed** (4.5% success rate vs. historical 60-70%)
- **Cost:** ~$7.27 in LLM calls for effectively zero output

### Immediate Symptoms
1. Tasks scored in 45-48 range yet auto-approved (CHAIN-002: 48, CHAIN-006: 45, CHAIN-007: 45)
2. MiniMax agents producing incomplete or malformed code
3. Supervisor approval logic allowed sub-60 scores to pass
4. No automatic retry/escalation for borderline scores (50-60 range)

### Secondary Effects
- Backend crash loop from bad TypeScript commits (port 3001 instability)
- 16,967+ backend restarts logged in PM2
- Development velocity collapsed to zero for 24 hours

---

## Root Causes

### 1. Auto-Approval Threshold Miscalibration
**Problem:** Supervisor auto-approved tasks scoring 45-48 despite 60-point quality floor being the intended standard.

**Why it happened:**
- Approval logic had no hard floor on quality scores
- "Good enough" heuristic allowed sub-standard code through
- No CEO escalation for scores below 60

**Evidence:**
- CTO post-sprint analysis shows 3 tasks scored 45-48 and passed
- Daily report confirms "quality threshold concern: auto-approval accepting sub-60 scores"

### 2. Task Complexity Mismatch
**Problem:** Non-coding tasks (schema migrations, RPC evaluations) routed to MiniMax code-generation model.

**Why it happened:**
- Sprint task routing assumes all tasks are code-generation
- CHAIN-006 (Supabase migration) and CHAIN-007 (RPC provider eval) are research/analysis tasks
- MiniMax optimized for code generation, not architectural analysis

**Evidence:**
- Both CHAIN-006 and CHAIN-007 scored 45 (lowest in sprint)
- CTO proposal CTO-20260305-002 flags task type mismatch

### 3. No Retry Escalation for Borderline Scores
**Problem:** Tasks scoring 50-60 auto-approve without retry attempt.

**Why it happened:**
- Pipeline assumes first-pass success or outright failure
- No intermediate "needs improvement" state
- No automatic prompt enhancement for low-scoring attempts

**Evidence:**
- CTO proposal CTO-20260305-003 recommends score-based retry logic
- Historical data shows sub-60 tasks often require post-approval fixes

### 4. MiniMax Token Truncation (Recurring)
**Problem:** MiniMax M2.5 truncates output around 4500 tokens even with max_tokens: 16000.

**Why it happened:**
- Known limitation documented in docs/learnings.md but not enforced in task creation
- Skills agent and sprint-runner don't validate task scope against truncation limits
- Multi-file tasks still being generated despite one-file-per-call rule

**Evidence:**
- docs/learnings.md section 1 explicitly warns about truncation
- Incomplete code files produce syntax errors caught by supervisor

---

## What Worked

1. **Claude Supervisor caught all bad code** — no defective commits reached main
2. **Memory-agent flagged the issue** — continuity brief identified the failure pattern
3. **CTO auto-generated proposals** — three concrete fixes proposed (CTO-20260305-001/002/003)
4. **Sprint isolation held** — catastrophic failure in Sprint 9 didn't break Sprint 10 launch

---

## What Failed

1. **Prevention:** No pre-flight task validation to catch complexity mismatches
2. **Detection:** Failure pattern not flagged until post-sprint analysis
3. **Response:** No automatic circuit breaker to halt sprint after 10+ consecutive rejections
4. **Learning:** Fixes proposed but not implemented — same failure could repeat in Sprint 10

---

## Fixes Proposed (NOT YET IMPLEMENTED)

### Immediate (CTO Proposals)
1. **CTO-20260305-001:** Hard reject tasks scoring <60 (modify supervisor approval logic)
2. **CTO-20260305-002:** Investigate task routing — send research/analysis tasks to Claude instead of MiniMax
3. **CTO-20260305-003:** Implement score-based retry escalation (50-60 triggers retry with stricter prompts)

### Systemic (Recommended by CEO)
4. **Circuit breaker:** Auto-pause sprint after 10 consecutive rejections; escalate to CEO
5. **Task scope validator:** Pre-flight check for token count, file count, complexity before assignment
6. **Model routing matrix:** Route by task type (code → MiniMax, analysis → Claude, schema → database agent)

---

## Lessons Learned

### For Sprint Planning
- **One concern per task** — don't mix schema changes, API routes, and validation logic
- **Validate scope against model limits** — check token estimates before assignment
- **Route by task type** — not all tasks are code-generation tasks

### For Quality Control
- **Hard floors matter** — "good enough" logic fails without absolute minimums
- **Borderline scores need retry** — 50-60 range should trigger improvement attempt
- **Fast failure is better than slow failure** — circuit breakers prevent runaway costs

### For Agent Design
- **Document known limits in enforceable rules** — MiniMax truncation was known but not prevented
- **Proposal generation ≠ proposal implementation** — CTO can identify issues but can't fix them without CEO approval
- **Memory systems need write-back loops** — learnings must flow from post-mortems back into agent prompts

---

## Action Items

| Item | Owner | Status | Deadline |
|------|-------|--------|----------|
| Implement hard <60 rejection floor | CEO/Supervisor | NOT STARTED | Before Sprint 11 |
| Add task routing logic (code vs. analysis) | CTO/Skills | NOT STARTED | Before Sprint 11 |
| Build score-based retry escalation | CEO/Supervisor | NOT STARTED | Sprint 11 |
| Add circuit breaker (10+ reject → pause) | CEO | NOT STARTED | Sprint 11 |
| Update agent prompts with post-mortem lessons | Memory-agent | NOT STARTED | End of week |

---

## Cost of Failure

- **Direct:** $7.27 LLM costs + 1 dev day lost = ~$500 opportunity cost
- **Indirect:** Backend instability from bad commits = 16,967 restarts, unknown downtime
- **Risk:** If Sprint 10 repeats this pattern, we burn another $7 + 1 day with zero output

**Total blast radius:** ~$500-1000 when accounting for opportunity cost and infrastructure churn.

---

## Sign-Off

This post-mortem is accurate as of March 3, 2026, 22:30 UTC.

**Fixes proposed but NOT implemented** — Sprint 10 is running on same pipeline that failed in Sprint 9.

If quality scores drop below 60 or rejection rate exceeds 30%, CEO must manually halt sprint and implement circuit breaker.

—CEO, Invoica
