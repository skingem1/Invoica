# Invoica — The Financial OS for the Agent Economy

*One-pager for AI data platforms | March 2026*

---

## The Problem

AI agents transact autonomously — but the financial infrastructure around them is still Web2. Stripe requires a Stripe account and USD rails. Traditional invoicing tools assume a human is in the loop. Neither handles on-chain USDC payments, multi-chain settlement detection, or per-transaction tax compliance at the agent level.

**The result:** autonomous agents with no financial layer. Transactions happen on-chain but there's no invoice, no tax record, no audit trail, and no way to gate the next action on confirmed payment.

---

## What Invoica Does

Invoica is the compliance and accounting middleware for agent-to-agent and agent-to-human transactions — built natively on x402.

| Capability | What it means |
|------------|---------------|
| **Invoice generation** | One API call → invoice ID, deterministic payment address, PDF |
| **On-chain settlement detection** | Real-time settlement status on Base, Solana, Polygon |
| **Tax compliance engine** | 12 countries: US, UK, Germany, France, Netherlands + 7 others |
| **SAP B1 ERP sync** | Settled invoices automatically posted to SAP Business One |
| **LangChain SDK** | 4 native tools: createInvoice, getInvoice, checkSettlement, listInvoices |
| **Trust-gated acceptance** | Invoices can require on-chain reputation score before settling |

---

## For AI Data Platforms Like Messari

Messari's research agents query, produce, and distribute data. The billing layer for that work — agent-to-agent data access fees, API metering, subscription settlements — needs to be as autonomous as the agents themselves.

Invoica gives Messari:
- **Per-query invoicing** at the agent level (no Stripe checkout flow)
- **Instant settlement confirmation** that can gate the next data delivery
- **Clean tax records** for every cross-border transaction, audit-ready
- **LangChain-native integration** — drop four tools into your existing agent stack

---

## Pricing

| Period | Price |
|--------|-------|
| Months 1–3 (Pilot) | Free — no commitment |
| Month 4+ (Founding Partner) | $299/month, locked permanently |
| Standard Enterprise (post-cohort) | $800+/month |

First cohort of enterprise pilots get the Founding Partner rate permanently.

---

## Status

Live beta since February 27, 2026. Free for 60 days. Billing starts April 22, 2026.

**Try it now:** invoica.ai — API key in 60 seconds, no account creation required.
**Contact:** team@invoica.ai | invoica.ai
