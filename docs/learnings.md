# Countable — Project Learnings & Key Insights

This file captures hard-won lessons from building and operating the 9-agent orchestrator.
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

*Last updated: 2026-02-14*
*Updated by: Claude — Week 3 sprint analysis*