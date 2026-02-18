# Invoica

**Financial OS for AI Agents** — an x402 invoice middleware platform built entirely by a multi-agent AI architecture.

[![Sprint Approval Rate](https://img.shields.io/badge/approval_rate-96.4%25-brightgreen)]()
[![Agents](https://img.shields.io/badge/agents-18-blue)]()
[![Tests](https://img.shields.io/badge/tests-192-green)]()
[![Sprints](https://img.shields.io/badge/sprints-49-orange)]()

---

## What is Invoica?

Invoica is a full-stack financial platform designed for AI agents to create, send, and settle invoices autonomously using the [x402 payment protocol](https://www.x402.org/). It provides:

- **TypeScript SDK** for programmatic invoice management
- **REST API** backend with authentication, webhooks, and rate limiting
- **Next.js dashboard** for human oversight and monitoring
- **Multi-agent orchestration** that builds and evolves the platform itself

## The Unique Part

Every line of code in this repository was written by AI agents — specifically **MiniMax M2.5** coding agents orchestrated by **Claude** executive agents. No human wrote any application code. The entire development process is autonomous:

1. **CEO agent** (Claude) prioritizes tasks and resolves conflicts
2. **6 coding agents** (MiniMax M2.5) write code one file at a time
3. **Dual supervisors** (Claude + Codex) review every output
4. **CTO agent** decomposes failed tasks and monitors the tech ecosystem
5. **CMO agent** handles branding and strategy reports

**Result: 243 tasks approved out of 252 submitted (96.4%) across 49 sprints.**

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    CEO (Claude)                      │
│         Prioritizes · Resolves · Approves            │
├──────────┬──────────┬───────────┬───────────────────┤
│   CTO    │   CMO    │Supervisor │  Skills Agent     │
│(MiniMax) │ (Grok)   │ (Claude)  │   (Claude)        │
├──────────┴──────────┴───────────┴───────────────────┤
│              Coding Agents (MiniMax M2.5)            │
│  backend-core · backend-ledger · backend-tax         │
│  frontend · devops · security                        │
├─────────────────────────────────────────────────────┤
│              Support Agents (Auto-created)            │
│  test-runner · execution-verifier · execution-watchdog│
│  conflict-analyzer · market-intelligence              │
│  pipeline-health-monitor · sprint-retrospective       │
└─────────────────────────────────────────────────────┘
```

### Orchestration Pipeline

```
CEO assessment → MiniMax codes (one-file-per-call)
  → Dual review (Claude + Codex)
  → CEO conflict resolution
  → CTO post-sprint analysis
  → CMO/Grok reports
  → Daily report to owner
```

---

## Project Structure

```
├── agents/                 # 18 AI agent configs (YAML + prompt.md)
├── backend/
│   └── src/
│       ├── middleware/      # Auth, rate limiting, API versioning
│       ├── routes/          # Invoice, settlement, webhook, API key endpoints
│       ├── services/        # Tax calculation, ledger, payment processing
│       └── workers/         # Background job processing
├── frontend/
│   ├── app/                # Next.js app router pages
│   ├── components/         # Dashboard, invoices, UI components
│   ├── hooks/              # useDebounce, useLocalStorage, useClipboard, useToggle, useApi
│   └── lib/                # Utilities (format, date, string, array, object, color, validation)
├── sdk/
│   └── typescript/
│       └── src/            # 50 modules — client, auth, retry, cache, headers, webhooks...
├── scripts/                # Orchestrator v2, CTO scan, CMO runner
├── sprints/                # 49 sprint JSON files (Weeks 2–51)
├── reports/                # Daily reports, CTO analyses, CMO strategies
└── docs/                   # Learnings, brand guidelines
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Coding Agents** | MiniMax M2.5 (~$0.09/task) |
| **Executive Agents** | Claude Sonnet (~$0.04/review) |
| **Intelligence** | Grok AI (X/Twitter feed) |
| **Orchestrator** | TypeScript, PM2, one-file-per-call pattern |
| **Backend** | Node.js, Express, TypeScript |
| **Frontend** | Next.js, React, Tailwind CSS |
| **SDK** | TypeScript, Axios, zero-dependency utilities |
| **Gateway** | OpenClaw v2026.2.12, ClawRouter |
| **Infrastructure** | WSL2 Ubuntu 22.04, Tailscale |

## SDK Modules

The TypeScript SDK provides everything needed to integrate with Invoica:

- **Core**: `client`, `auth`, `config`, `environment`
- **Network**: `http-transport`, `headers`, `retry`, `timeout`, `rate-limit`, `interceptors`
- **Data**: `serializer`, `response-parser`, `request-builder`, `url-builder`, `query-string`, `pagination`
- **Utilities**: `cache`, `logger`, `error-formatter`, `validation`, `number-utils`, `debug`
- **Webhooks**: `webhook`, `webhook-verify`
- **Events**: `events` (typed event emitter)

## Sprint Stats

| Metric | Value |
|--------|-------|
| Total sprints | 49 (Weeks 2–51) |
| Tasks approved | 243 / 252 |
| Approval rate | **96.4%** |
| Perfect sprints (9/9) | 4 consecutive (Weeks 48–51) |
| Total commits | 520+ |
| Test files | 192 |
| AI agents | 18 (6 coding + 12 executive/support) |

## How the Orchestrator Works

Each sprint is defined as a JSON file with 9 tasks:

```json
{
  "tasks": [
    {
      "id": "SDK-200",
      "agent": "backend-core",
      "type": "feature",
      "priority": "high",
      "status": "pending",
      "dependencies": [],
      "context": "Create sdk/typescript/src/query-string.ts — URL query string utilities...",
      "deliverables": { "code": ["sdk/typescript/src/query-string.ts"] }
    }
  ]
}
```

The orchestrator enforces:
- **One file per API call** to MiniMax (avoids output truncation)
- **Max 200 lines per file** (stays within model context)
- **Pure functions with no external deps** (ideal for single-shot generation)
- **Rejection feedback loop** — supervisor rejections are fed back as context for retries
- **CTO auto-decomposition** — after 3 truncation failures, CTO splits the task into sub-tasks

## Running a Sprint

```bash
# Start the orchestrator
pm2 start scripts/orchestrate-agents-v2.ts \
  --name orchestrator \
  --interpreter ts-node \
  -- sprints/week-51.json

# Monitor progress
pm2 logs orchestrator

# Check results
grep -E '(✓ Task|↻ Task)' ~/.pm2/logs/orchestrator-out.log
```

## Environment Variables

```env
ANTHROPIC_API_KEY=       # Claude API for CEO, Supervisor, Skills agents
MINIMAX_API_KEY=         # MiniMax API for coding agents
OPENAI_API_KEY=          # Codex for secondary review
SUPERVISOR_URL=          # Mac supervisor endpoint (optional)
SUPERVISOR_API_KEY=      # Supervisor auth key (optional)
```

## License

MIT

---

*Built by 18 AI agents. Supervised by Claude. Powered by MiniMax M2.5.*
*243 tasks approved. 96.4% success rate. Zero human-written application code.*
