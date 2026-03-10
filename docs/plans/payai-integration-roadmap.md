# Invoica × PayAI Integration Roadmap
*Source: invoica-arb-repurposing-plan-v2.docx*
*Integrated: 2026-03-10*
*Status: PRE-sprint pending human action*

---

## Overview

Repurpose the Solana arbitrage bot into three Invoica services, distributed **exclusively** through PayAI's x402 marketplace. PayAI is the distribution channel; Invoica builds the infrastructure. All three services are gated behind PayAI's x402 verification — only PayAI-verified agents get access.

**Total investment:** 43 agent hours · 4.5 human hours · 2 days registration
**Outcome:** Invoica becomes PayAI's flagship infrastructure partner with three live marketplace services.

---

## Where This Fits in the Existing Roadmap

```
CURRENT ROADMAP (post-integration)
────────────────────────────────────────────────────────
Priority 1  Gas Backstop              ← unchanged, no conflict
Priority 2  Arb Bot Stabilisation    ← new, separate repo, prerequisite
Priority 3  Payment Router (PayAI)   ← new, needs Sprint 050 + PRE
Priority 4  Solana Settlement        ← already planned, now gates Priority 5
Priority 5  Treasury Manager (PayAI) ← new, conditional on Solana + Sprint 051
Priority 6  SOL Incinerator          ← bumped, still ships before billing day
Priority 7  Reputation Oracle (PayAI)← replaces "Reputation Scoring API" Priority 3
Priority 8  PayAI Marketplace Demo   ← new, pitch asset for PayAI founder
Priority 9  Agent Marketplace        ← deferred, PayAI covers partial scope
────────────────────────────────────────────────────────
```

**Day 61 deadline (April 22, 2026):** Gas Backstop + Payment Router must ship before billing activates. Treasury Manager and Reputation Oracle are secondary but contribute to ARR.

---

## ⚠️ Human Action Required First — PRE Sprint

**This is NOT a code task. Tarek does this using his investor relationship with PayAI.**

| Step | Action | Output |
|------|--------|--------|
| 1 | Go to payai.network — use investor relationship for partner portal access (skip public queue) | Partner portal access |
| 2 | Register **Payment Router**: "Invoica Payment Router — Any Token, One Call" · 0.005 USDC/call for PayAI users | `PAYAI_SERVICE_ID_ROUTER` |
| 3 | Register **Treasury Manager**: "Invoica Treasury Manager — Autonomous Yield Engine" · 0.005 USDC/cycle | `PAYAI_SERVICE_ID_TREASURY` |
| 4 | Register **Reputation Oracle**: "Invoica Reputation Oracle — On-Chain Agent Trust Scores" · 0.002 USDC/query | `PAYAI_SERVICE_ID_ORACLE` |
| 5 | Get the `/verify` endpoint URL. Add all three IDs to `.env.example` | `.env.example` updated |
| 6 | Negotiate 50% fee reduction for PayAI users for first 3 months — get in writing | Written agreement |

**→ Do NOT start Sprint 051 until `PAYAI_SERVICE_ID_ROUTER` is confirmed. The gate middleware needs a real ServiceID.**

---

## Sprint 050 — Arb Bot Stabilisation
`PREREQUISITE · 6h agent · 1h human`

**⚠️ Arb bot repo not found locally.** The arb bot is a Solana arbitrage engine targeting Meteora DLMM pools. Locate it at: `github.com/skingem1/` (check for arb or meteora repos). Clone it before starting this sprint.

### Critical Bugs to Fix

| ID | Bug | Fix |
|----|-----|-----|
| F-01 | `wallet/keypair.json` — **private key committed to repo** | Add to `.gitignore`. ROTATE the key immediately. |
| F-02 | CPMM math (`x*y=k`) used for DLMM pools — wrong pricing model | Replace all `getAmountOut()` with `dlmm.swapQuote()` in `quotes.ts`, `cpmm.ts`, all pool adapters |
| F-03 | `meteoraSDK.ts:35` — `MeteoraPoolManager` passes WSOL as both mints A and B | Pass `TOKEN_A_MINT` and `TOKEN_B_MINT` from config. Two-line fix. |
| F-05 | `bsol.ts:170` — REST API returns base58 in reserve fields, `BigInt()` crashes | Type guard before every `BigInt()` conversion — validate numeric string, log and skip if base58 |

### Files Changed
- `src/quotes.ts` — replace CPMM with `swapQuote()`
- `src/cpmm.ts` — deprecate `getAmountOut()`
- `src/adapters/pools/bsol.ts` — type guard on reserve fields
- `src/lib/meteoraSDK.ts` — fix mint placeholders
- `.gitignore` — add `wallet/keypair.json`

### Validation Gate (Human — 1h)
- Run 50 simulated cycles on devnet. Confirm quotes are non-zero and directionally sane.
- Confirm circuit breaker triggers after 3 consecutive simulated losses.
- **Do NOT proceed to Sprint 051 until 50 clean devnet cycles complete. Non-negotiable.**

---

## Sprint 051 — Payment Router + PayAI Gate
`PRODUCT · 10h agent · 1h human`
**Gate: Sprint 050 done + `PAYAI_SERVICE_ID_ROUTER` confirmed**

### What It Does
When a client pays a Invoica invoice in SOL, PAYAI, or any SPL token, the router auto-converts to USDC. Entire service gated behind PayAI x402 verification.

### Tasks
1. `middleware/payai-gate.ts` — x402 verification middleware, applied to all three service route groups
2. `backend/src/services/payment-router.ts` — wraps arb bot `executeSwap()` into `route(invoiceId, tokenIn, amountIn)` → USDC settled
3. Update settlement route in `backend/src/routes/` — call `payment-router.ts` before booking
4. Enforce `simulate: true` flag by default — every payment dry-runs before execution

### PayAI Gate Pattern
```typescript
// middleware/payai-gate.ts
import { verifyPayAI } from '@payai/x402-sdk';

export async function requirePayAIUser(req, res, next) {
  const paymentHeader = req.headers['x-payment']; // x402 standard
  const isValid = await verifyPayAI({
    serviceId: process.env.PAYAI_SERVICE_ID_ROUTER,
    paymentHeader,
    amount: '0.005',  // PayAI user rate
    network: 'solana'
  });
  if (!isValid) return res.status(402).json({ error: 'PayAI x402 payment required' });
  next();
}

app.use('/payai/router/*',   requirePayAIUser);
app.use('/payai/treasury/*', requirePayAIUser);
app.use('/payai/oracle/*',   requirePayAIUser);
```

### Validation Gate (Human — 1h)
- Create a $1 devnet invoice. Pay in SOL **without** x402 header → confirm HTTP 402 returned.
- Pay **with** valid PayAI x402 header → confirm USDC lands in settlement wallet, invoice flips to paid.
- This is the PayAI proof point: autonomous invoice paid in non-native token, gated by PayAI, zero human intervention.

---

## Sprint 052 — Treasury Manager + PayAI Gate
`CONDITIONAL · 18h agent · 2h human`

**⛔ HARD GATES — DO NOT START UNTIL ALL FOUR ARE MET:**
1. CEO Solana sprint has landed — per-agent Solana wallets must exist
2. CTO has confirmed wallet interface compatibility with arb bot `executeSwap()`
3. Sprint 051 Payment Router is live and validated on devnet
4. `PAYAI_SERVICE_ID_TREASURY` confirmed from PRE sprint

### What It Does
Invoica's 18 agents sit idle between tasks. This sprint makes idle cycles generate yield — partially self-funding the swarm's operational costs. Access gated behind PayAI.

### Tasks
1. Register OpenClaw skill: `invoica-treasury-yield` via ClawRouter. Trigger: agent wallet above operational floor AND no active task for >10 minutes
2. `backend/src/skills/treasury-yield.ts` — calls arb bot fast-loop on Meteora BTC/SOL pool via **Jito bundles** (atomic sim+execution). Deposits profit to agent wallet. If slippage between simulation and execution exceeds tolerance threshold, bundle fails — nothing executes. No partial fills, no surprise losses.
3. `backend/src/services/treasury-attribution.ts` — maps yield earned to agent identity. Primary data source for Reputation Oracle.
4. Update `payai-gate.ts` to use `PAYAI_SERVICE_ID_TREASURY` for treasury routes
5. **On-chain spending cap program** — Deploy Solana program that enforces the per-cycle ceiling in program logic (not TypeScript). Program physically cannot release more than the cap per cycle regardless of what the yield skill instructs. On-chain state tracks cumulative daily loss; when threshold hit, program freezes delegation for 24h automatically. Auditable by anyone.
6. **Minimum cycle size floor** — Model gas costs before activating. Solana tx cost ≈ $0.003; triangular arb = 3 txs ≈ $0.009. At 2% edge: minimum viable cycle size ≈ 1.5–2 USDC. Hard-code floor in `treasury-yield.ts`: skill does not trigger if agent balance below floor OR if projected gross yield < $0.015 (= 1.5× gas). Prevents yield from being eaten by fees at scale.

### Safety Rails (immutable)
- Max 2% drawdown per cycle
- Circuit breaker after 3 consecutive losing cycles
- Spending cap and daily loss counter enforced ON-CHAIN — not via server logic
- Jito bundle atomicity: sim + execution in one atomic submission
- Minimum cycle floor: 1.5 USDC — no trigger below this threshold

### Validation Gate (Human — 2h)
- Model minimum cycle size against current Solana gas costs — confirm $0.015 floor math
- One agent completes an idle yield cycle on devnet (Jito bundle path) — confirm sim and execution in same block
- Force slippage breach mid-cycle → confirm bundle fails cleanly (no partial fill)
- Force 3 consecutive losses → circuit breaker triggers and skill pauses cleanly
- Query on-chain program state — confirm daily counter increments and freezes at threshold
- Non-PayAI request to `/payai/treasury/*` returns HTTP 402

---

## Sprint 053 — Reputation Oracle + PayAI Gate
`INFRASTRUCTURE · 15h agent · 1.5h human`
**Gate: Sprint 052 done**
**Replaces original roadmap item: "Reputation Scoring API — Priority 3"**

### What It Does
Indexes verifiable on-chain execution records, computes ACP trust scores from objective performance history, exposes a scoring API for task allocation. Distribution exclusively via PayAI.

**Note:** `agent-reputation-dashboard` repo already exists at `github.com/skingem1/agent-reputation-dashboard`. This sprint extends it — not greenfield.

**Cold-start strategy:** Any agent with fewer than 10 completed PayAI transactions receives an `UNRATED` badge instead of a score. Marketplace buyers see unknown-quantity risk clearly. PayAI's existing transaction history is ingested retroactively — every agent already transacting through PayAI gets a seeded score from day one. Invoica does not start from zero; it starts from PayAI's current volume.

### ACP Trust Score Composition (5 signals)
| Weight | Factor | Notes |
|--------|--------|-------|
| 37% | Yield generated (from `treasury-attribution.ts`) | Job-size weighted — larger cycle values contribute more per unit |
| 28% | Payment routing success rate | Zero-failure settlements weighted highest |
| 18% | Invoice settlement time | Faster autonomous settlement = higher score |
| 7% | Task completion rate | From Invoica's existing sprint approval metrics |
| 10% | Verified dispute rate | **NEW** — 5× negative multiplier on upheld disputes; 48h dispute window per job |

Score range: 0–1000. PayAI marketplace ranking threshold: 600+. `UNRATED` for agents with <10 PayAI transactions.

### Job-Size Weighting
Signals 1–4 are weighted by job value, not volume alone. A 0.01 USDC micro-task completion contributes 0.1 reputation points; a 50 USDC job contributes 10 points. Score farming via high-volume low-value jobs is penalised naturally — volume and value are both required to build a meaningful score.

### Stake-to-Bid (high-value jobs)
Jobs above 20 USDC require the accepting agent to post a 5 USDC stake via x402. If the client raises a verified dispute within 48h and it is upheld, the stake is slashed. PayAI x402 payment mechanics handle this natively — staking is an extension of the existing flow. Eliminates the reputation-farming-then-exploit attack on high-value tasks.

### Optional Endorsement Signal
After job completion, the hiring agent may broadcast a one-transaction on-chain endorsement (binary: satisfied or silent). Silence is neutral. Endorsement gives a small score boost. Endorsements are non-gameable: only verified paying clients from that job can issue one. No self-endorsement. This gives quality a pathway into the score without making it mandatory or adding friction to every transaction.

### Tasks
1. Extend `agent-reputation-dashboard` to ingest `treasury-attribution.ts` output + PayAI retroactive transaction history
2. `backend/src/services/acp-scorer.ts` — 5-signal weighted composite score with job-size weighting, cold-start `UNRATED` flag (<10 transactions), dispute rate multiplier
3. `backend/src/routes/oracle.ts` — `GET /payai/oracle/score/:agentId`, `GET /payai/oracle/leaderboard`, `POST /payai/oracle/record`, `POST /payai/oracle/dispute`, `POST /payai/oracle/endorse`
4. Apply `payai-gate.ts` middleware using `PAYAI_SERVICE_ID_ORACLE`
5. Stake-to-bid enforcement — x402 stake flow for jobs >20 USDC, 48h dispute window, slash mechanism

### Validation Gate (Human — 1.5h)
- Score API returns non-zero scores from devnet execution history (seeded from PayAI retroactive data)
- Agent with <10 transactions shows `UNRATED` — confirm no score is displayed
- Leaderboard ranks agents by composite score with job-size weighting applied correctly
- Post a dispute → confirm 5× multiplier applies and score drops on upheld dispute
- Jobs >20 USDC: confirm stake-to-bid flow blocks acceptance without posted stake
- Non-PayAI request to `/payai/oracle/*` returns HTTP 402

---

## Sprint 054 — PayAI Marketplace Listing + Demo Surface
`PITCH ASSET · 5h agent · 0.5h human`
**Gate: Sprint 053 done**

### What It Does
Makes all three services visible in the PayAI marketplace and produces the live demo URL to send the PayAI founder. Real on-chain numbers, not a deck.

### Tasks
1. `backend/src/routes/treasury-public.ts` — public read-only endpoint: total trades, win rate, max drawdown, total USDC yield, per-agent P&L. No auth.
2. Frontend `/treasury` dashboard tab — yield generated, swarm total, per-agent P&L, circuit breaker status, emergency pause button
3. Submit all three services to PayAI marketplace. Cross-branding: "Powered by Invoica" + link on every listing.
4. Emergency pause — kills yield engine without touching payment routing. Both services remain fully independent.

### Human Tasks (0.5h)
- Submit marketplace listings via PayAI partner portal
- Activate the 50% fee reduction promotion for first 3 months (if negotiated in PRE sprint)

### After Sprint 054
Send the PayAI founder:
- Live public endpoint URL showing Invoica on-chain execution history
- Invitation to check all three services in their marketplace
- Real numbers, live product, exclusive to their ecosystem
- **Pitch framing on cold start:** "We're not claiming the oracle is perfect at launch. We're claiming it gets better with every PayAI transaction. Every agent already transacting through your marketplace gets a retroactive score from day one. You don't start from zero — you start from your current transaction volume."

---

## Risk Mitigations

> Documented 2026-03-10. These challenges were surfaced during founder-level review and resolved before any mainnet exposure.

### Treasury Manager — Known Risks and Mitigations

**Risk 1: Delegation caps only cap damage — they don't prevent bugs or exploits**
*Mitigation:* Move the spending cap enforcement ON-CHAIN via a dedicated Solana program. The ceiling is baked into program logic — a TypeScript variable on a server is not sufficient. The program physically cannot release more than the cap per cycle regardless of what the yield skill instructs. The cap is on-chain and auditable by anyone. One program audit required before mainnet.

**Risk 2: Daily cumulative loss counter lives off-chain — can fail silently**
*Mitigation:* On-chain program tracks cumulative daily loss as program state. When the threshold is hit, the program freezes the delegation for 24 hours automatically. No server monitor required. Agents can verify freeze state by querying the program directly. See Sprint 052 Task 5.

**Risk 3: 8-second execution window is probabilistic — slippage between sim and execution**
*Mitigation:* Jito bundle atomicity. Simulation and execution are submitted as a single atomic bundle. If market conditions shift beyond the slippage tolerance threshold between sim and execution, the bundle fails — nothing executes. No partial fills. The result is binary: either the simulated yield lands exactly, or the cycle does not execute. See Sprint 052 Task 2.

**Risk 4: Transaction costs may eat yield at small cycle sizes — gas model not validated**
*Mitigation:* Model explicitly before Sprint 052 ships. Solana cost ≈ $0.003/tx; triangular arb = 3 txs ≈ $0.009. At 2% edge, minimum profitable cycle ≈ 1.5–2 USDC. Hard-code a floor: yield skill does not trigger if projected gross yield < $0.015 (= 1.5× estimated gas). See Sprint 052 Task 6.

---

### Reputation Oracle — Known Risks and Mitigations

**Risk 1: Score is gameable — farm low-value jobs to build high score, then exploit high-value job**
*Mitigation:* Two mechanisms in combination.
- *Job-size weighting:* A 0.01 USDC micro-task contributes 0.1 score points; a 50 USDC job contributes 10 points. Score requires volume AND value — volume alone is insufficient.
- *Stake-to-bid:* Jobs above 20 USDC require the agent to post a 5 USDC stake via x402. Upheld disputes within 48h slash the stake. Bad actors farming reputation to exploit one large job now have real capital at risk. See Sprint 053 Task 5.

**Risk 2: Operational efficiency ≠ quality — a fast financially active agent can score 850+ while producing mediocre work**
*Mitigation:* Signal 5 — verified dispute rate — added with 10% weight and 5× negative multiplier on upheld disputes. Completion rate is binary; disputes capture verified delivery failure. The endorsement signal (optional, from verified paying clients) provides a positive quality signal without requiring mandatory quality review. Together they give quality a pathway into the score without making it mandatory or adding friction. See Sprint 053 ACP Trust Score Composition.

**Risk 3: Completion rate is binary — delivered ≠ correct, payment can trigger on garbage delivery**
*Mitigation:* 48-hour dispute window on every completed job. Client can raise a dispute; if upheld it applies the 5× negative multiplier to Signal 5. This doesn't make the score a quality guarantee but it makes verified delivery failure permanently visible in the score. "Delivered" no longer means unchallenged.

---

### Meta-Challenge — Cold Start (week one, two agents, three transactions)

**Problem:** Both example scenarios (NEXUS, VERA) assume a mature ecosystem. Neither the idle-trigger logic at scale nor 67 PayAI transactions exist yet.

**Treasury Manager cold start:** The delegation mechanics work with one agent or ten thousand. The yield may be small but the trust model is ecosystem-agnostic. Demo is possible with a single agent wallet on devnet day one with real on-chain numbers.

**Reputation Oracle cold start:**
- Agents with fewer than 10 completed PayAI transactions show `UNRATED` (not a score). Marketplace buyers know they're taking on unknown-quantity risk. This is a feature, not a limitation.
- PayAI's existing transaction history is ingested retroactively. Every agent already transacting through PayAI gets a seeded score from day one. Invoica does not start from zero — it starts from PayAI's current volume.
- The pitch to the PayAI founder: "The oracle gets better with every transaction that flows through your marketplace. You already have the transaction history. We just haven't computed the scores yet."

---

## Architecture Summary

```
PayAI User  (x402 payment header)
↓  verifyPayAI() — serviceId check
Invoica Services  (all three gated)
├── 01  Payment Router       ← arb bot quote engine + executeSwap()
├── 02  Treasury Manager     ← arb bot yield loop + per-agent wallets
└── 03  Reputation Oracle    ← ACP ledger + Trust Architect agent

Every service returns HTTP 402 until valid PayAI x402 header is provided.
PayAI users get: priority routing, lower fees, marketplace visibility.
```

## Pricing Tiers

| User Type | Price | Perks |
|-----------|-------|-------|
| PayAI users | 0.005 USDC/call (router/treasury) · 0.002 USDC/query (oracle) | Priority routing, lower fees, marketplace visibility, 50% reduction first 3 months |
| Non-PayAI agents | 0.01 USDC/call (standard) | Standard routing, no marketplace listing |

---

## Dependency Graph

```
PRE (human) ─────────────────────────────────────────┐
                                                      │
Sprint 050 (Arb Bot bugs) ────────────────────────┐  │
                                                   ▼  ▼
                             Sprint 051 (Payment Router) ──────────┐
                                                                    │
CEO Solana sprint ──────────────────────────────────────────────────┤
                                                                    ▼
                                               Sprint 052 (Treasury Manager)
                                                                    │
                                                                    ▼
                                               Sprint 053 (Reputation Oracle)
                                                                    │
                                                                    ▼
                                               Sprint 054 (Marketplace + Demo)
```

---

## What Invoica Looks Like After Sprint 054

| | Before | After |
|---|---|---|
| Distribution | Direct signup only | PayAI marketplace + direct |
| Token support | Settlement token only | Any SPL token (auto-converted) |
| Agent idle time | Wasted | Generating yield |
| Reputation | Asserted | On-chain, verifiable, scored |
| PayAI relationship | None | Flagship infrastructure partner |
| Revenue streams | Subscription | Subscription + micro-fees on every PayAI transaction |

---

*Ref: invoica-arb-repurposing-plan-v2.docx · Integrated 2026-03-10*
