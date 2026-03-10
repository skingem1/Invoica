# INVOICA — Claude Code Session Context

## BEFORE YOU DO ANYTHING

1. Read `SOUL.md` — company identity, product suite, agent performance
2. Read `constitution.md` — governance rules, Conway Edition constraints
3. Read `~/kognai/docs/shared-infra.md` — shared infrastructure (Hetzner, Supabase, PM2, models, x402)
4. Check current sprint: look in `sprints/` for the highest-numbered JSON file

## PROJECT OVERVIEW

Invoica is the **Financial OS for the Agent Economy** — x402 invoice middleware that lets AI agents earn, spend, invoice, and settle payments autonomously. "Stripe for AI Agents."

**Status:** Live beta (launched Feb 27, 2026). Free for 2 months. Billing starts Day 61 (Apr 22, 2026).

**Product Suite:**
| Product | Status |
|---------|--------|
| Invoice Middleware (x402) | Live — MVP |
| Tax Compliance Engine | Live — 12 countries (service built, wiring in progress — see core-platform-fixes sprint) |
| Settlement Detection | Live — on-chain |
| Dashboard & Analytics | Live |
| Reputation Scoring API | Planned — Priority 1 |
| Agent Marketplace | Planned — Priority 2 |
| Gas Backstop | Planned — Priority 3 (deprioritized 2026-03-10) |
| SOL Incinerator | Planned — Priority 4 (deprioritized 2026-03-10) |

**Agent Stack (18 agents):**
- CEO = Claude Sonnet (strategic decisions, Conway governance)
- CTO = Claude Sonnet (sprint verification, ecosystem monitoring)
- CMO = Grok (brand, content, social media, @invoica_ai)
- Supervisor 1 = Claude Sonnet (code review — quality gate)
- Supervisor 2 = Codex o4-mini (code review — independent verification)
- Telegram Support Bot = MiniMax (customer support)
- 12x MiniMax M2.5 (coding agents — one-file-per-call pattern)

**Architecture:** One-file-per-API-call (max 200 lines), OpenClaw orchestration, Conway Edition governance.

**Sprint History:** 001-062e completed (769 commits, 96.4% approval rate). Built in 6 days for ~$200.

## RELATIONSHIP TO KOGNAI

Invoica and Kognai share infrastructure but are **separate products**:
- **Invoica** = SaaS product (invoicing, payments, tax) — currently in beta
- **Kognai** = sovereign AI runtime platform — currently in Phase 0 foundation

**What's shared:** Hetzner VPS, Supabase, PM2, x402 protocol, model routing, Mac Mini vault, GitHub (skingem1). See `~/kognai/docs/shared-infra.md` for details.

**What's NOT shared:**
- Invoica codebase, agents, sprints, SOUL.md, constitution — Invoica-only
- Kognai phase system, gates, TikTok agent, Achiri, OpenClaw skills — Kognai-only
- Invoica's Conway governance — does not apply to Kognai agents
- Kognai's kill switches — do not apply to Invoica

**Rule:** When making infrastructure changes (server, DB, PM2, models), update `~/kognai/docs/shared-infra.md` so the Kognai session picks it up too. When making Invoica-specific changes, update only this file and Invoica docs.

## KEY RULES

1. **Read SOUL.md first** — it defines the product identity and Conway governance
2. **One-file-per-call** — max 200 lines per file, each API call is one file
3. **Don't break live beta** — real users are onboarding during the 60-day window
4. **Dual supervisor review** — all code goes through Supervisor 1 + Supervisor 2
5. **No fabricated metrics** — every number must come from verifiable sources
6. **Shipped-only content** — @invoica_ai posts only about deployed features, never roadmap
7. **Summer Yu rule** — safety constraints in SOUL.md/constitution.md, NEVER chat-only
8. **Shared changes → update shared-infra.md** — infra changes OR reusable code written/modified → update so Kognai session stays in sync

## DEPLOYMENT

- **Backend:** Hetzner VPS (65.108.90.178), user `invoica`, path `/home/invoica/apps/Invoica`
- **Frontend:** Vercel (Next.js dashboard)
- **Database:** Supabase (Session Pooler port 6543)
- **Processes:** PM2 via `ecosystem.config.js` (see shared-infra.md for full list)
- **Auto-deploy:** git push → git-autodeploy PM2 process (every 5 min)

## FILE STRUCTURE

```
~/Documents/Invoica/
├── CLAUDE.md                 ← you are here
├── SOUL.md                   ← CEO strategic identity (Conway Edition v2.0)
├── constitution.md           ← governance rules
├── agents/                   ← 18 agent configs
├── backend/                  ← Express + Prisma + Supabase
├── frontend/                 ← Next.js dashboard (Vercel)
├── scripts/                  ← automation scripts
├── sprints/                  ← sprint history (001-062e)
├── reports/                  ← agent output reports
├── docs/                     ← product documentation
├── x402-base/                ← payment protocol
├── x402-evm/                 ← EVM integration
├── sdk/                      ← TypeScript SDK
├── SkinMemory/               ← imported founder memory
├── ecosystem.config.js       ← PM2 process configs
└── logs/                     ← runtime logs
```

## MASTER REFERENCES

- Shared infrastructure: `~/kognai/docs/shared-infra.md`
- Kognai context (if needed): `~/kognai/CLAUDE.md`
- PM2 config (shared): `~/kognai/ecosystem.config.js`
- Invoica agent in Kognai swarm: `~/kognai/kognai-agents/invoica-x-admin/`
