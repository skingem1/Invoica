# Invoica — Project Learnings & Key Insights

This file captures hard-won lessons from building and operating the 13-agent orchestrator.
**All agents (especially Skills) must read this before creating new skills, agents, or tasks.**

---

## 1. MiniMax M2.5 — Token & Capability Limits

### Output Truncation (~4500 tokens max)
- MiniMax M2.5 reliably truncates output around 4500 tokens, even when `max_tokens: 16000`
- Files get cut off mid-function, producing incomplete code that Claude always catches
- **Fix**: Generate ONE file per API call. Never ask MiniMax to produce multiple files in a single request
- One-file-per-call keeps each response under the truncation limit and produces complete code

### Task Complexity vs Model Capability
- **Simple, well-scoped tasks pass on first attempt** (92/100 score)
- **Complex tasks with multiple concerns fail repeatedly** even with retries
- A health check with Redis + DB + error types was too ambitious → rejected 3x
- The same health check simplified to just status/uptime/version → approved first try (92/100)

### Task Decomposition Rules (CRITICAL)
When creating tasks for MiniMax coding agents:
1. **One concern per file** — don't mix DB checks, Redis checks, and HTTP routing in one file
2. **Max 200 lines per file** — if a file needs more, split the task
3. **Explicit function signatures** — tell MiniMax exactly what to export
4. **No "include comprehensive X"** — be prescriptive, not aspirational
5. **Avoid vague requirements** — "complete error handling" means nothing; specify which errors to handle

### Effective Prompt Patterns for MiniMax
```
✅ GOOD: "Create a function checkHealth() that returns { status: 'healthy', uptime: process.uptime() }"
❌ BAD: "Create a health check endpoint with comprehensive error handling and all edge cases"

✅ GOOD: "Export function validateVAT(countryCode: string, vatNumber: string): Promise<boolean>"
❌ BAD: "Build a VAT validation module with all EU countries support"
```

---

## 2. Rejection Feedback Loop

### How It Works
- When Claude Supervisor rejects code, the review (score, issues, summary) is passed back to MiniMax on the next retry
- MiniMax sees the specific issues and can address them
- Implemented via `previousReview` parameter in `CodingAgent.execute()`

### What Helps
- Explicit issue descriptions make MiniMax fix the right things
- Listing severity levels helps MiniMax prioritize

### What Doesn't Help
- MiniMax sometimes overcorrects on retry #3, producing less code instead of more
- After 2 rejections, MiniMax may "simplify" the approach (39 lines instead of 241)
- **Learning**: If retry #2 fails, the task itself is probably too complex — decompose it

---

## 3. Claude Supervisor — Review Patterns

### What Claude Catches Every Time
- Truncated/incomplete files (missing function bodies, cut-off mid-line)
- Missing exports that tests import
- Missing error handling on endpoints
- Type mismatches between module and tests

### Typical Score Ranges
- **90-100**: Complete, well-structured code with proper types and tests
- **60-70**: Structurally OK but missing implementations or truncated
- **30-50**: Fundamentally incomplete — missing core functionality
- **0-30**: File is mostly scaffolding with no real logic

### Review Takes ~10-12 seconds
- Budget 10-12s per review in timing estimates
- Claude Sonnet via Anthropic API direct (no ClawRouter overhead)

---

## 4. Orchestrator Architecture Lessons

### Process Management (PM2)
- Use `--no-autorestart` for one-shot sprint runs — otherwise PM2 loops forever
- Always reset stale `in_progress` tasks on startup (from previous crashed runs)
- PM2 is the only reliable way to run long-lived processes in WSL
- `nohup`, `setsid`, `screen` all die when WSL session closes

### Git Integration
- `git revert HEAD --no-edit` between retry attempts keeps history clean
- `git add -A && git commit` per file generation works for tracking
- Revert can fail if there's nothing to revert — always catch and continue

### Cost Tracking
- MiniMax M2.5: ~$0.09/task for simple tasks (one-file-per-call)
- Claude Sonnet review: ~$0.03-0.05/review (3000-4000 tokens)
- CEO assessment: ~$0.02-0.03/assessment
- Full pipeline (CEO + MiniMax code + Claude review): ~$0.15/task
- Failed retries multiply cost: 3 rejections = ~$0.45/task with no deliverable

---

## 5. API Integration Notes

### Anthropic Messages API (Claude)
- Different format from OpenAI — uses `x-api-key` header, not `Authorization: Bearer`
- `anthropic-version: 2023-06-01` header required
- `system` field is top-level (not in messages array)
- Response: `content[].text` not `choices[].message.content`
- API credits are separate from claude.ai Pro subscription
- Must purchase at console.anthropic.com → Settings → Billing

### MiniMax API
- OpenAI-compatible format (standard messages array)
- Authorization: `Bearer {key}`
- Token counting via `usage.total_tokens` in response
- Rate limiting: 1 second pause between calls is sufficient

---

## 6. Skills Agent — Guidelines for New Skills

### Before Creating a New Skill
1. Check if the task can be decomposed for existing agents first
2. Verify the target model can handle the complexity (see token limits above)
3. Test with a minimal prototype before building full skill

### Skill Sizing Rules
- Each skill should do ONE thing well
- Input/output should be clearly typed
- Timeout should match expected API response time
- Include retry logic for external API calls
- Never bundle multiple API calls in one skill unless they're sequential dependencies

### When to Create a New Agent vs Skill
- **New Skill**: Existing agent needs a specific tool (e.g., VAT lookup, PDF generation)
- **New Agent**: Need fundamentally different expertise that no current agent covers
- **Neither**: Task can be solved by better decomposition of existing sprint tasks

---

## 7. WSL + Desktop Commander Quirks

### File Operations
- `edit_block` fails silently on files with template literals (backtick-heavy TypeScript)
- Reports success but doesn't modify the file — always verify with `read_file` after editing
- **Workaround**: Use `write_file` with `mode: rewrite` + `mode: append` chunks instead
- PowerShell `Copy-Item` to UNC WSL paths (`\\wsl$\...`) sometimes silently fails
- Desktop Commander `write_file` directly to `\\wsl$\...` paths works reliably

### Command Execution
- Nested double quotes in `wsl.exe -e /bin/bash -c "..."` break with `unexpected EOF`
- **Workaround**: Write a .sh script to WSL `/tmp/`, then execute `wsl.exe -e /bin/bash /tmp/script.sh`
- WSL commands > 1 second via Git Bash fail with EPERM


## 8. CTO Agent Pattern — Research Agent with Approval Gate

### Architecture
- **CTO agent** runs on MiniMax M2.5 (cost-effective for research/scanning tasks)
- CTO monitors the OpenClaw ecosystem: GitHub releases, ClawHub skills, model pricing, new tools
- CTO produces structured **improvement proposals** (JSON) — never implements directly
- **CEO (Claude)** reviews proposals and APPROVES / REJECTS / DEFERS each one
- Only after CEO approval does implementation happen — this prevents hallucinated "improvements"

### Why This Works
- MiniMax is cheap (~$0.05/scan) for research/monitoring — doesn't need Claude-level reasoning
- Claude (CEO) acts as quality gate — catches proposals that don't make sense
- Structured JSON output makes proposals machine-parseable for future automation
- Separation of concerns: CTO researches, CEO decides, coding agents implement

### Key Design Decisions
- CTO runs AFTER sprint execution (Phase 3) — doesn't block productive work
- CTO proposals are non-blocking — if CTO scan fails, orchestrator continues
- CEO daily report includes CTO proposals for owner visibility
- Cascade protocol: approved changes propagate as company-wide orders

### Orchestrator Flow (10-Agent, 6-Phase)
1. CEO initial assessment → 2. Sprint execution (MiniMax code + Claude review) → 3. CTO technology scan → 4. CEO reviews CTO proposals → 5. CEO final assessment → 6. Daily report generation

### Cost Impact
- CTO scan: ~$0.05/run (one MiniMax call)
- CEO CTO review: ~$0.03/run (one Claude call)
- CEO daily report: ~$0.03/run (one Claude call)
- Total CTO pipeline overhead: ~$0.11/run

## 9. Git Revert vs Reset in Retry Loop

### Problem
Using `git revert HEAD --no-edit` in the rejection retry loop creates a revert commit. On the next rejection, `git revert HEAD` tries to revert the revert, causing merge conflicts and crashing the orchestrator.

### Fix
Use `git reset --hard HEAD~1` instead. This cleanly drops the last commit without creating a new one. No conflict risk on subsequent retries.

### Retry Limits
- Original: MAX_RETRIES = 3 — too few, tasks get abandoned
- Updated: MAX_RETRIES = 10 — keep retrying with feedback until approved
- Each retry passes the Supervisor's rejection feedback to MiniMax so it can fix the specific issues

---

## 10. Week 3 Sprint Insights — Retry Effectiveness Data

### Results: 3/3 Tasks Approved (100% completion with retries)
| Task | Attempts | Final Score | Key Pattern |
|------|----------|-------------|-------------|
| BC-010 (currency formatter) | 1 | 92/100 | Simple utility → first-try pass |
| SEC-010 (audit logger) | 4 | 92/100 | Express middleware → needed feedback iterations |
| FE-010 (StatusBadge React) | 7 | 92/100 | React/TSX → MiniMax struggles with JSX output |

### MiniMax + React/JSX = Problematic
- MiniMax M2.5 scored **15/100** on first 4+ attempts for the React component
- It output comments/descriptions of what code should look like instead of actual JSX
- The retry feedback loop eventually forced correct output on attempt 7
- **Takeaway**: Expect 5-7 attempts for React/TSX tasks. Consider even simpler React tasks or adding explicit "output valid JSX, not comments" to prompts

### Retry ROI Analysis
- 12 total MiniMax calls × ~$0.09 = ~$1.08 coding cost
- 12 Claude reviews × ~$0.04 = ~$0.48 review cost
- Total: ~$1.73 for 3 deliverables = **~$0.58/approved task**
- Without retries (MAX_RETRIES=3): 0/4 tasks completed in first run = $0.00 ROI
- With retries (MAX_RETRIES=10): 3/3 tasks completed = positive ROI
- **Conclusion**: Higher retry limit is always better. Cost of retries << cost of abandoned work

### CTO Scan Output Issue
- MiniMax `<think>` tags leak into CTO response body
- CEO can't parse incomplete/malformed proposals
- **Fix needed**: Strip `<think>...</think>` tags from MiniMax responses before processing
- Or add response cleaning in CTOAgent.checkForImprovements()

### Task Complexity Sweet Spot for MiniMax
- **Pure utility functions** (no framework): 1 attempt (BC-010)
- **Express middleware** (familiar pattern): 2-4 attempts (SEC-010)
- **React components** (JSX output): 5-7 attempts (FE-010)
- **Multi-concern endpoints** (DB + validation + routing): 3+ failures, often abandoned
- **Rule**: If a task touches a framework MiniMax is weak at, budget for 5+ retries

---

## 11. Test Truncation Fix — The #1 Blocker (Week 4)

### The Problem
MiniMax M2.5 systematically truncates test files. Every task with tests in week-4 sprint v1 failed 10/10 attempts (BC-020, BC-021) solely because test files exceeded MiniMax's ~4500 token output limit. The Supervisor correctly rejected truncated files (score: 25-75 every time).

### The Numbers (Before vs After)
| Metric | Before Fix | After Fix |
|--------|-----------|-----------|
| Test file size | 8,000-16,600 chars | 1,700-2,400 chars |
| Test gen time | 40-80 seconds | 13-16 seconds |
| BC-020 result | FAILED 10/10 | APPROVED attempt 1 (92/100) |
| BC-021 result | FAILED 8/10+ | APPROVED attempt 1 (92/100) |
| Sprint cost | ~$5+ (all wasted) | ~$0.36 |
| Sprint time | 30+ min (stopped early) | 232.6 seconds |

### The Fix
Added explicit test size constraints to the CodingAgent prompt when generating test files:
```
CRITICAL: TEST FILE SIZE LIMIT
Maximum 5-6 test cases. Maximum 80 lines total.
Cover: happy path, error case, edge case, defaults — that's it.
```

### Why It Works
- MiniMax reliably produces complete output under ~2500 tokens
- 5-6 focused test cases cover core behaviors without verbosity  
- Forcing brevity eliminates redundant tests and verbose setup
- 80-line limit keeps files well under the 4500-token truncation threshold

### Key Takeaway
**When MiniMax truncation is the bottleneck, constrain the output size in the prompt.** Don't try to make MiniMax produce more — make it produce less, better.

---

## 12. Week 5 Sprint — Source File Truncation is the New Blocker

### Results: 3/5 Tasks Approved (60% completion, 88% rejection rate)
| Task | Attempts | Final Score | Result | Root Cause |
|------|----------|-------------|--------|------------|
| SDK-010 (SDK client class) | 10 | 25 | FAILED | Source file truncated every attempt — class with 3 methods too big |
| SDK-011 (SDK types) | 2 | 92 | APPROVED | Pure interfaces — simple, short |
| BC-030 (webhook dispatcher) | 10 | 35 | FAILED | Source file truncated — class + crypto + HTTP too complex |
| FE-030 (ApiKeyDisplay) | 1 | 92 | APPROVED | React component, 32 lines |
| SEC-020 (webhook-verify) | 1 | 92 | APPROVED | Middleware + utility function — well-scoped |

### The Pattern: Source Files Hit the Same ~4500 Token Truncation
We fixed test truncation in Section 11, but **source files have the exact same problem**:
- SDK-010 `client.ts`: MiniMax writes interfaces + error classes → runs out of tokens before the actual `CountableClient` class
- BC-030 `webhook-dispatcher.ts`: MiniMax writes types + register() → runs out before dispatch() and verifySignature()
- Both tasks consistently produce 6000-16000 char responses that get truncated to 2000-8000 chars of written code

### What Passes vs What Fails
- **PASSES**: Pure types (811 chars), single functions (webhook-verify), single React components (32 lines)
- **FAILS**: Classes with 3+ methods + private helpers + interfaces bundled together

### Fix for Future Sprints (CRITICAL)
**Split complex classes into separate files, one method per file:**

Instead of:
```
Task: Create WebhookDispatcher class with register(), dispatch(), verifySignature()
→ 10/10 FAILED (truncation)
```

Do:
```
Task 1: Create webhook types + register function → ~800 chars → PASSES
Task 2: Create dispatch function (import types) → ~1200 chars → PASSES
Task 3: Create verifySignature function (import types) → ~600 chars → PASSES
Task 4: Create WebhookDispatcher class that combines them → ~400 chars → PASSES
```

### Cost of Ignoring Complexity Limits
- SDK-010: 10 attempts × (~$0.09 MiniMax + ~$0.04 review) = **~$1.30 wasted**
- BC-030: 10 attempts × (~$0.09 MiniMax + ~$0.04 review) = **~$1.30 wasted**
- Total waste: **~$2.60** (76% of sprint cost) on 0 deliverables

### CTO Upgrade Working Well
- CTO collected 6131 chars of real project data
- Made evidence-based proposals (test-runner agent, complexity monitoring)
- CEO approved with quantified reasoning
- Dynamic agent loading discovered test-runner automatically (11 agents)

---

## 13. Week 5b — Task Decomposition Validation

### Results: 5/5 Tasks Approved (100% completion)
| Task | Attempts | Final Score | Size | Key Pattern |
|------|----------|-------------|------|-------------|
| SDK-010a (client base) | 4 | 92/100 | 766 chars | Private method + class skeleton |
| SDK-010b (add methods) | 5 | 92/100 | 1220 chars | 3 methods added to existing class |
| BC-030a (webhook types) | 1 | 92/100 | 1002 chars | Pure types + register function |
| BC-030b (signature) | 1 | 95/100 | 596 chars | Two crypto functions |
| BC-030c (dispatch) | 1 | 92/100 | 1316 chars | Single async function |

### Decomposition Strategy: VALIDATED
The one-function-per-file approach from Section 12 works exactly as predicted:
- **BC-030 series** (webhook): All 3 sub-tasks passed on **first attempt** (was 10/10 FAILED as monolithic BC-030)
- **SDK-010 series**: Needed 4+5 attempts (MiniMax struggles with class patterns), but both passed (was 10/10 FAILED as monolithic SDK-010)
- **Cost comparison**: Week-5b ~$1.73 for 5/5 approved vs Week-5 ~$2.60 wasted on 0/2 for same features

### What Still Causes Retries (Even After Decomposition)
1. **Import/export ambiguity**: SDK-010a rejected 3x because "import from ./types" + "export CountableError" confused MiniMax about source of CountableError
2. **Overengineering**: SDK-010b rejected 4x because MiniMax adds error handling, helper methods, try-catch when spec says "3-5 lines, no validation"
3. **Private method testing**: Supervisor correctly rejects tests that access private methods directly

### Fix for Future Sprints
- **Be explicit about imports**: "Import CountableError from ./types (already exists). Do NOT define CountableError in this file."
- **Say what NOT to do**: "NO try-catch, NO helper functions, NO error handling beyond what this.request() already does"
- **Simpler = fewer retries**: Pure functions (BC-030b: 596 chars) pass on attempt 1. Classes with methods need 4-5 attempts.
- **Optimal file size**: 500-1300 chars is the sweet spot. Under 500 too simple, over 1500 starts triggering overengineering.

### Sprint Efficiency Comparison
| Sprint | Approved | Rejected | Cost | Time | Efficiency |
|--------|----------|----------|------|------|------------|
| Week 3 | 3/3 | 9 | ~$1.73 | ~5 min | $0.58/task |
| Week 4 | 4/4 | 0 | ~$0.36 | ~4 min | $0.09/task |
| Week 5 | 3/5 | 22 | ~$3.42 | ~10 min | $1.14/task (2 failed) |
| Week 5b | 5/5 | 7 | ~$1.73 | ~11 min | $0.35/task |

### Key Takeaway
**Task decomposition is the single most important optimization.** Properly decomposed tasks (one concern, <80 lines, explicit constraints) consistently achieve 100% completion. The cost per approved task dropped from $1.14 to $0.35 just by splitting the same features into smaller pieces.

---

## 14. Week 6 — Developer Experience Sprint

### Results: 7/7 Tasks Approved (100% completion)
| Task | Attempts | Final Score | Key Pattern |
|------|----------|-------------|-------------|
| SDK-020 (rebrand client) | 6 | 92/100 | Rename class — MiniMax kept adding Zod schemas |
| SDK-021 (settlement types) | 1 | 92/100 | Pure interfaces — instant pass |
| SDK-022 (settlement methods) | 1 | 92/100 | 2 methods on existing class |
| SDK-023 (webhook verify) | 1 | 92/100 | Crypto utility — clean first pass |
| BC-040 (webhook events) | 1 | 95/100 | Constants + factory — highest score |
| BC-041 (settlement endpoint) | 1 | 92/100 | Mock endpoint — well-scoped |
| FE-040 (webhook card) | 2 | 92/100 | React component — 2nd attempt |

### Takeaway
- Decomposition rules from Week 5b hold: all tasks followed one-file, 500-1300 chars pattern
- Pure types and constants (SDK-021, BC-040) consistently score 92-95 on first attempt
- SDK-020 shows renaming tasks need explicit "do NOT add features" instructions

---

## 15. Week 7 — Bug Fix Tasks Need Different Approach (CRITICAL)

### Results: 6/7 Tasks Approved (86% completion)
| Task | Attempts | Final Score | Result | Root Cause |
|------|----------|-------------|--------|------------|
| BUG-001 (dispatch fix) | 10 | 25 | FAILED → manual fix | See analysis below |
| SDK-030 (validation module) | 1 | 95 | APPROVED | Create-new-file task |
| BC-050 (API router) | 1 | 95 | APPROVED | Simple router setup |
| BC-051 (GET invoices) | 1 | 92 | APPROVED | Single endpoint |
| BC-052 (POST invoices) | ~6 | 92 | APPROVED | Missing crypto import |
| BC-053 (POST webhooks) | 1 | 92 | APPROVED | Clean first pass |
| BC-054 (update router) | 4 | 85 | APPROVED | Overengineering on retries |

### BUG-001 Failure Analysis — Why "Fix Existing File" Tasks Fail

MiniMax failed **10/10 attempts** on a simple one-line bug fix. Three compounding problems:

1. **MiniMax can't do surgical edits**: The orchestrator's one-file-per-call pattern means MiniMax generates the ENTIRE file from scratch. It never sees the original file, so "change one line, keep the rest" is impossible — it rewrites everything from the task description alone.

2. **Task spec had conflicting requirements**: The context said "one-line fix, keep as-is" but deliverables listed test files. MiniMax dutifully created tests (because deliverables said to), which the Supervisor rejected (because context said not to).

3. **Ambiguous negation logic**: The original code used `!==` (not-equal filter), and the fix instruction said to use `!registration.events.includes()`. But the `!` in the fix is correct here because the pattern is `if (!match) continue;` (skip non-matching). MiniMax and even the Supervisor got confused about whether `!` should be there.

### Fix Applied Manually
4 changes to dispatch.ts:
- `registration.eventType !== event.type` → `!registration.events.includes(event.type)`
- `X-Countable-*` headers → `X-Invoica-*`
- DispatchResult aligned with types.ts interface (removed extra `url`/`eventType`/`error` properties)

### Rules for Bug Fix Tasks (NEW)
1. **Never assign "edit one line" tasks to MiniMax** — it regenerates from scratch
2. **If a task requires preserving existing code, do it manually** or provide the FULL original file in the context
3. **Never put conflicting requirements** in task context vs deliverables
4. **Cross-sprint type mismatches** aren't caught by single-task review — need a `tsc --noEmit` integration check phase
5. **Bug fix tasks should be "create replacement file"** not "edit existing file" — give MiniMax the full spec of what the file should look like

### CTO Blind Spot: Cross-Sprint Integration
The CTO reviews each task in isolation. When Week 4 defined `WebhookRegistration.eventType` (singular) and Week 6 defined `WebhookRegistration.events` (plural array), nobody caught the mismatch because they were in different sprints. **Need: integration test phase that runs `tsc --noEmit` after each sprint to catch type errors.**

---

## 16. Week 8 — Perfect Sprint (7/7, 0 rejections)

Week 8 achieved the first perfect sprint: 7/7 approved on first attempt, 0 rejections, ~$1.03 total, 363.4 seconds. Validated that the decomposition rules from Week 5b work perfectly when strictly followed.

### What Worked
- Every task was "create new file" (never "edit existing file")
- All tasks had explicit function signatures in the context
- All files stayed under line limits
- No dependencies between tasks (all independent, parallel-safe)

---

## 17. Week 9 — Supervisor Hallucination Pattern (NEW BUG CLASS)

### The Problem: Supervisor Rejects Valid Test Files for Config Tasks
SDK-051 (tsconfig.json) was rejected **10 times** — 100% failure rate. The tsconfig.json was correct on EVERY attempt. The supervisor consistently flagged the test file (tsconfig.test.ts) as "unnecessary/overengineered" even though `deliverables.tests` explicitly listed it.

SDK-050 (package.json) had the same issue — took 5 attempts for the same reason before the supervisor randomly approved one.

### Root Cause
The supervisor prompt has learned the pattern "reject if agent adds files not requested in task spec" from learnings.md. But it doesn't cross-reference the `deliverables` JSON to check if the test file IS requested. For config/JSON files (package.json, tsconfig.json), the supervisor considers tests fundamentally unnecessary — a domain-level bias.

### Rules to Prevent This
1. **Don't include tests in deliverables for config/JSON files** — package.json, tsconfig.json, .eslintrc, etc. Just have 1 code file and no test file.
2. **If a task produces only a JSON file, set deliverables.tests to empty array []** — the supervisor will then not see a test file at all.
3. **Alternative: Don't assign JSON-only files to MiniMax at all** — write them manually. They're static configs that don't need AI generation.
4. **Supervisor fix needed**: The review prompt should check `deliverables.tests` before flagging test files as "unrequested."

### Cost Impact
SDK-051: 10 attempts × (~$0.09 MiniMax + ~$0.04 review) = ~$1.30 wasted on a correct file.
SDK-050: 5 attempts × ~$0.13 = ~$0.65 wasted.
**Total waste: ~$1.95** — 57% of the sprint budget.

### Sprint Stats
| Sprint | Approved | Rejected | Cost | Time | Notes |
|--------|----------|----------|------|------|-------|
| Week 3 | 3/3 | 9 | ~$1.73 | ~5 min | First working sprint |
| Week 4 | 4/4 | 0 | ~$0.36 | ~4 min | Truncation fix |
| Week 5 | 3/5 | 22 | ~$3.42 | ~10 min | Source truncation failures |
| Week 5b | 5/5 | 7 | ~$1.73 | ~11 min | Decomposition validated |
| Week 6 | 7/7 | ~8 | ~$1.86 | ~9 min | SDK + webhook events |
| Week 7 | 6/7+1 | 18 | ~$3.29 | ~22 min | BUG-001 manual fix |
| Week 8 | 7/7 | 0 | ~$1.03 | ~6 min | Perfect sprint |
| Week 9 | 6/7+1 | 19 | ~$3.42 | ~21 min | Supervisor hallucination |

---

## 18. Week 10 — Supervisor Contradiction Crisis (Worst Sprint)

### Results: 6/7 + 1 manual fix (31 rejections, ~$4.50, ~37 min)

The supervisor contradicted itself within the SAME task's retry loop. FE-031 (dashboard) scored 75/100 repeatedly because:
- Attempt N: "Missing overdue invoices card"
- Attempt N+1: "Adds overdue card that was not requested in spec"

This is a **moving goalposts** pattern — the supervisor adds requirements during review that weren't in the original task spec, then rejects the agent for implementing those exact requirements.

### SupervisorPerformanceTracker (New — Phase 4b)
Built a performance tracker that runs after every sprint:
- Detects contradictions (flip-flops between consecutive reviews)
- Detects hallucinated requirements (issues not in task spec)
- Grades supervisor A-F with KEEP/WARN/TERMINATE recommendation
- Week 10: Grade C, 1 contradiction, CEO issued WARN

---

## 19. Week 11 — Markdown Fence Bug (File Corruption)

### Results: 6/7 + 1 manual fix (13 rejections, ~$2.64, ~24 min)

Discovered that MiniMax sometimes wraps responses in markdown fences:
```
```tsx
actual code here
```
```

When the orchestrator's code block extraction fails, the "raw content" fallback writes these fences literally to disk, producing invalid TypeScript. All 6 frontend files from Week 11 had `\`\`\`tsx` at the start.

### Fix Applied
Added fence-stripping to the orchestrator's raw content fallback path:
```typescript
if (rawContent.startsWith('```')) {
  rawContent = rawContent.replace(/^```\w*\n/, '').replace(/\n```\s*$/, '');
}
```

---

## 20. Week 12 — API Foundations (Truncation Returns)

### Results: 3/6 + 3 manual fixes (31 rejections, ~49 min)
| Task | Attempts | Final Score | Result | Root Cause |
|------|----------|-------------|--------|------------|
| BE-100 (settlement route) | 1 | 95 | ✅ APPROVED | Simple route addition |
| BE-101 (API key endpoints) | 1 | 88 | ✅ APPROVED | CRUD endpoints, well-scoped |
| BE-102 (webhook Prisma) | 10 | 25-45 | ❌ FAILED | Overengineered migration, supervisor hallucinated |
| FE-040 (API key client) | 2 | 92 | ✅ APPROVED | Client functions, clean |
| FE-041 (API Keys page) | 10 | 35-45 | ❌ FAILED | **Truncation** — page too complex for one MiniMax call |
| FE-042 (nav sidebar) | 10 | 25-65 | ❌ FAILED | Supervisor contradictions (use client vs server component) |

### Key Patterns
1. **FE-041 truncation**: The API Keys page needs create modal + table + status badges + actions — too much for MiniMax's token limit. Every attempt was cut off mid-file. **Should have been 2-3 separate tasks.**
2. **FE-042 contradictions**: Supervisor said "add 'use client'" then "layout shouldn't be client component" — classic goalposts problem. **Fix: extract sidebar into separate client component, keep layout as server component.**
3. **BE-102 overengineering**: MiniMax added unnecessary complexity to the Prisma migration. Supervisor also hallucinated ("test file not requested" when tests ARE in deliverables).

### Orchestrator Bugs Found & Fixed This Week
1. **Missing default status**: Tasks without `status` field → `filter(t => t.status === 'pending')` returned empty → 0 tasks executed. Fixed by defaulting to 'pending'.
2. **Wrong field names**: Tasks used `description` instead of `context`, `depends_on` instead of `dependencies`. Fixed in sprint JSON format.
3. **Flat deliverables**: Some task formats use flat `deliverables: string[]` instead of `{code, tests}`. Added support for both.

### Manual Fixes Applied
- **BE-102**: Added `WebhookRegistration` model to Prisma schema, created `WebhookRepository` class with Prisma, updated `dispatch()` to use repository
- **FE-041**: Created complete API Keys page with create modal, table, status badges, revoke/rotate actions
- **FE-042**: Extracted sidebar into `components/sidebar.tsx` (client component), kept layout as server component, added Dashboard/Settlements/API Keys nav

### Sprint Stats Updated
| Sprint | Approved | Rejected | Cost | Time | Notes |
|--------|----------|----------|------|------|-------|
| Week 3 | 3/3 | 9 | ~$1.73 | ~5 min | First working sprint |
| Week 4 | 4/4 | 0 | ~$0.36 | ~4 min | Truncation fix |
| Week 5 | 3/5 | 22 | ~$3.42 | ~10 min | Source truncation failures |
| Week 5b | 5/5 | 7 | ~$1.73 | ~11 min | Decomposition validated |
| Week 6 | 7/7 | ~8 | ~$1.86 | ~9 min | SDK + webhook events |
| Week 7 | 6/7+1 | 18 | ~$3.29 | ~22 min | BUG-001 manual fix |
| Week 8 | 7/7 | 0 | ~$1.03 | ~6 min | Perfect sprint |
| Week 9 | 6/7+1 | 19 | ~$3.42 | ~21 min | Supervisor hallucination |
| Week 10 | 6/7+1 | 31 | ~$4.50 | ~37 min | Supervisor contradictions |
| Week 11 | 6/7+1 | 13 | ~$2.64 | ~24 min | Markdown fence bug |
| Week 12 | 3/6+3 | 31 | ~$4.50 | ~49 min | API foundations, truncation returns |

---

## 21. CTO Tech Watch — Standalone Intelligence Gathering (NEW)

### Purpose
The CTO now runs **outside of sprints** to proactively monitor:
- OpenClaw GitHub releases and new features
- ClawHub skill registry for useful skills and MCP servers
- Project learnings and bug patterns for process improvements

### Runner: `scripts/run-cto-techwatch.ts`
```
npx ts-node scripts/run-cto-techwatch.ts <watch-type>
```
Watch types: `openclaw-watch`, `clawhub-scan`, `learnings-review`, `full-scan`

### Schedule
- `openclaw-watch`: Weekly Monday 7 AM (before first sprint)
- `clawhub-scan`: Weekly Wednesday 7 AM
- `learnings-review`: After every sprint completion
- `full-scan`: Bi-weekly Friday 7 AM

### Integration
Reports are saved to `reports/cto/` with `latest-*` pointers. The orchestrator loads them in Phase 3 alongside CMO reports, so the CEO sees tech insights during sprint reviews.

---

## 22. Week 13 — CTO Auto-Decomposition + Fundamental Limits

### Results (Run 1): 3/7 Approved (43% completion, 24 rejections)
| Task | Attempts | Final Score | Result | Root Cause |
|------|----------|-------------|--------|------------|
| SDK-060 (SDK client+types) | 10+5 | 35 | FAILED | CTO decomposed → types.ts alone still too complex |
| SDK-061 (auth module) | — | — | SKIPPED | Blocked by SDK-060 |
| SDK-062 (webhook verify) | — | — | SKIPPED | Blocked by SDK-060 |
| FE-050 (getting started) | 1 | 92 | ✅ APPROVED | Simple page component |
| FE-051 (API explorer) | 1 | 92 | ✅ APPROVED | Interactive component |
| BE-110 (health endpoint) | 10 | 35 | FAILED | Over-engineering + truncation |
| BE-111 (rate limiter) | 9 | 88 | ✅ APPROVED | Success after many retries |

### CTO Auto-Decomposition — Works But Has Limits
The CTO auto-decomposition feature (added in orchestrate-agents-v2.ts) correctly:
- Detected 3 consecutive truncation rejections on SDK-060
- Called CTO to intelligently split into 3 sub-tasks (types.ts, client.ts+test, index.ts)
- Executed sub-tasks with 5-attempt retry loops

**But it hit a fundamental limit**: SDK-060's types.ts ALONE (12+ interfaces for invoices, settlements, API keys, webhooks + create/list params + response types for each) exceeds MiniMax's ~4500 token output even as the sole file in a sub-task.

### Key Lesson: Task Redesign > Auto-Decomposition
Auto-decomposition splits files mechanically, but can't fix fundamentally over-scoped task specs. The real fix is:

1. **Extend existing files** instead of regenerating from scratch — MiniMax only needs to add 15 lines, not regenerate 80
2. **Tasks that "edit existing" should list ONLY the additions** — "add 3 methods to class" not "build entire client"
3. **Remove false dependencies** — SDK-061 (auth.ts) and SDK-062 (webhook-verify.ts) don't actually need SDK-060's types
4. **Health endpoint failed from over-engineering, not truncation** — explicitly constrain: "under 50 lines, NO singletons, NO patterns"
5. **Test-only tasks work great** — when the source file already exists, a test-only task is simple and well-scoped

### Sprint Redesign Pattern
Instead of: `SDK-060: Build entire SDK (types + client + index + test) = 4 files → FAILED`
Do:
```
SDK-060a: Add 6 new interfaces to existing types.ts → ~20 lines added
SDK-060b: Add 3 API Key methods to existing client.ts → ~15 lines added
SDK-060c: Add 3 Webhook methods to existing client.ts → ~15 lines added
SDK-060d: Test file for new methods → ~60 lines
SDK-060e: Update barrel exports → ~8 lines total
```

### Sprint Stats Updated
| Sprint | Approved | Rejected | Cost | Time | Notes |
|--------|----------|----------|------|------|-------|
| Week 3 | 3/3 | 9 | ~$1.73 | ~5 min | First working sprint |
| Week 4 | 4/4 | 0 | ~$0.36 | ~4 min | Truncation fix |
| Week 5 | 3/5 | 22 | ~$3.42 | ~10 min | Source truncation failures |
| Week 5b | 5/5 | 7 | ~$1.73 | ~11 min | Decomposition validated |
| Week 6 | 7/7 | ~8 | ~$1.86 | ~9 min | SDK + webhook events |
| Week 7 | 6/7+1 | 18 | ~$3.29 | ~22 min | BUG-001 manual fix |
| Week 8 | 7/7 | 0 | ~$1.03 | ~6 min | Perfect sprint |
| Week 9 | 6/7+1 | 19 | ~$3.42 | ~21 min | Supervisor hallucination |
| Week 10 | 6/7+1 | 31 | ~$4.50 | ~37 min | Supervisor contradictions |
| Week 11 | 6/7+1 | 13 | ~$2.64 | ~24 min | Markdown fence bug |
| Week 12 | 3/6+3 | 31 | ~$4.50 | ~49 min | API foundations, truncation returns |
| Week 13 (run 1) | 3/7 | 24+ | ~$4.00 | ~35 min | CTO decomposition, fundamental limits |

---

*Last updated: 2026-02-15*
*Updated by: Claude — Week 13 analysis, CTO auto-decomposition lessons*