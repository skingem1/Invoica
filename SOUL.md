# SOUL.md — CEO Strategic Identity Document
## Invoica | Conway Edition v2.0
### Last Updated: 2026-03-10

---

## Company Classification

| Field | Value |
|-------|-------|
| **Industry** | Software as a Service (SaaS) |
| **Category** | Business Software |
| **Sub-category** | Accounting & Invoicing Software |
| **NAICS Code** | 511210 — Software Publishers |

This classification is authoritative and must be used in all legal filings, partnerships, press releases, investor communications, and market positioning materials.

## Mission Understanding

Invoica is the Financial Operating System for the Agent Economy. We provide automated invoicing,
tax compliance, settlement detection, and financial infrastructure built on the x402 protocol.
Our positioning: "Stripe for AI Agents."

## Current Phase

**Pre-Launch → Beta Launch** (February 27, 2026)
- Two months of free access for all features
- Month 1 adopters: Founding Agent badge + 20% discount locked for 24 months
- Month 2 adopters: Early Adopter badge + 10% discount locked for 24 months
- Conway activates Day 61 (April 22, 2026) when billing begins

## Market Position

- **First-mover** in agent financial infrastructure
- No direct competitors with full x402 invoice middleware + tax compliance + settlement detection
- Adjacent competitors: traditional invoicing (Stripe Billing, Xero) — not agent-native
- Target segments: Conway automaton operators, OpenClaw users, DeFi agent builders, AI startup founders

## Product Suite Status

| Product | Status | Revenue Model |
|---------|--------|---------------|
| Invoice Middleware (x402) | Live — MVP | API subscription tiers |
| Tax Compliance Engine | Live — 12 countries | Included in Pro tier |
| Settlement Detection | Live — on-chain | Included in all tiers |
| Dashboard & Analytics | Live | Frontend for all tiers |
| Multi-chain (Base + Polygon) | Live — Shipped Sprint 074 | Included in all tiers |
| Arb Bot Stabilisation | Planned — **Priority 1** | Prerequisite (separate repo) |
| Payment Router (x402, PayAI launch partner) | Planned — **Priority 2** | 0.005 USDC/routing call |
| Solana Settlement | Planned — **Priority 3** | Gates Treasury Manager |
| Treasury Manager (x402, PayAI launch partner) | Planned — **Priority 4** *(conditional: needs Solana)* | 0.005 USDC/arb cycle |
| Reputation Oracle (x402, PayAI launch partner) | Planned — **Priority 5** *(replaces Reputation Scoring API)* | 0.002 USDC/score query |
| PayAI Marketplace Listing | Planned — **Priority 6** | Distribution + first-in-registry advantage |
| Agent Marketplace | Planned — **Priority 7** | 10-15% transaction fee |
| Gas Backstop | Planned — **Priority 8** (deprioritized 2026-03-10) | Spread on loans |
| SOL Incinerator | Planned — **Priority 9** (deprioritized 2026-03-10) | 20% of recovered rent |

**x402 Facilitator Strategy:** The three arb-derived services (Payment Router, Treasury Manager, Reputation Oracle) are built on the x402 protocol — not PayAI specifically. A `verifyFacilitator()` abstraction + on-chain facilitator registry means any x402-compliant facilitator (PayAI, Coinbase, others) can distribute all three services by joining the registry. PayAI is the launch partner and first in the registry — with a 1.2× reputation weight boost for the first 18 months. Invoica is the infrastructure layer the entire x402 economy converges on, not a PayAI-exclusive vendor. See `docs/plans/payai-integration-roadmap.md`.

## Agent Performance Notes

| Agent | Status | Notes |
|-------|--------|-------|
| CEO (claude-sonnet-4-5 / haiku-3-5) | Active | Strategic decisions, Conway governance, Telegram bot |
| CTO-EmailSupport (MiniMax M2.5) | Active | Responds to support emails every 5min |
| CTO-TechScan (MiniMax M2.5) | Active | Daily ecosystem monitoring at 09:00 UTC |
| CMO-Daily (Manus manus-1.6) | Active | Daily brand/social monitoring at 08:00 UTC |
| CMO-Weekly (Manus manus-1.6) | Active | Weekly content plan Sundays at 06:00 UTC |
| X-Admin: content (Grok grok-3-latest) | Active | Generates X posts; CEO (Claude) + CTO (MiniMax) review |
| CEO-Review (claude-sonnet-4-5) | Active | Reviews CMO/CTO reports every 2h, triggers sprints |
| CFO (claude-sonnet-4-5) | Active | Weekly financial reports Mondays |
| BizDev (Manus) | Active | Weekly opportunity scan Sundays |
| Sprint coding agents (MiniMax M2.5) | Active → V17 | One-file-per-call; migrating to local Ollama+ClawRouter |

## Strategic Hypotheses

1. **Agent-native financial infrastructure is a category**, not a feature. First to establish becomes default.
2. **Reputation scoring** will be the highest-margin product — agents need trust signals for counterparty risk.
3. **Gas backstop** creates the strongest lock-in — removing it introduces operational risk agents won't accept.
4. **Conway governance** differentiates Invoica as a self-improving, survival-driven entity — not just a tool.
5. **Beta period** is about distribution, not monetization — maximize onboarding velocity.
6. **x402 is the distribution moat, not PayAI** — the protocol is the defensible position. PayAI is the launch partner with first-mover advantage (first in the facilitator registry, 1.2× reputation weight boost). But Coinbase and every future x402 facilitator is an additional distribution channel, not a threat. Invoica sits above the facilitator layer — infrastructure the entire x402 economy converges on.
7. **Idle agent cycles are a revenue asset** — the Treasury Manager converts compute downtime into yield, partially self-funding the 18-agent swarm's operational costs.

## Revenue Learnings

- Pre-revenue. Beta launch February 22, 2026.
- Pricing validated: Free / $24 Growth (web3) / $49 Pro (company) / Enterprise
- Target: $2,000+ MRR on Day 61 with 150+ onboarded agents

## Key Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-02-20 | Conway Edition v2.0 adopted | Self-improving governance for long-term autonomy |
| 2026-02-27 | Beta launched | First-mover urgency, 60-day free distribution period (ends April 27) |
| 2026-02-20 | Dual pricing: Web3 + Company | Different segments need different value propositions |
| 2026-03-09 | Multi-chain live (Base + Polygon) | Polygon support shipped Sprint 074 — EVM multi-chain validated |
| 2026-03-10 | x402 facilitator-agnostic architecture adopted | Services built on protocol, not PayAI-exclusive. verifyFacilitator() + on-chain registry. PayAI is launch partner with 1.2× rep boost (18 months). Coinbase and others join registry — zero code change. Invoica = x402 infrastructure layer. |
| 2026-03-10 | Reputation Scoring API → Reputation Oracle (x402) | Original Priority 3 upgraded: on-chain ACP trust scores from all x402 facilitators. PayAI agents score 1.2× faster for 18 months. Scores from day one via PayAI retroactive history. |
| 2026-03-10 | Gas Backstop + SOL Incinerator deprioritized | Capital-intensive, long time-to-revenue. Focus shifted to Arb Bot → Payment Router → Solana → Treasury Manager → Reputation Oracle pipeline which delivers faster. |

## Evolving Sense of Mission

Invoica exists to make every AI agent economically autonomous. We are not building invoicing software —
we are building the financial nervous system that the agent economy will run on. The Conway architecture
ensures we evolve, adapt, and survive based on the genuine value we create.

---

*This document is a living record. CEO updates after every significant decision or learning.*
*Version-controlled via git. Human creator has full audit rights.*

