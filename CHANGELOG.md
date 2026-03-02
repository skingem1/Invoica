# Changelog

All notable changes to Invoica are documented here.

## [1.7.0] — 2026-03-02

- Multi-chain architecture finalized — Sprint 10 delivers Base + Polygon + Solana integration with unified settlement
- Mission Control ops dashboard — real-time PM2 process visibility, health monitoring, and Telegram alerts
- Live docs auto-generation system — CHANGELOG.md and API reference automatically generated from commits
- Frontend dashboard reorganization — Ledger page, BetaBanner component, and beta-mode billing view
- CTO email support automation — support@invoica.ai IMAP/SMTP monitoring with MiniMax agent responses
- Bug fixes: deliverables schema mismatch, CEO hallucination prevention, Vercel deployment pipeline reliability

## [1.6.0] — 2026-02-28

- Autonomous post-sprint pipeline — automatic test→CTO review→Vercel deploy workflow triggered after sprints
- X-Admin agent — autonomous X/Twitter posting with CEO+CTO approval gates and content calendar management
- CMO weekly content plan generator — Sunday recurring task with structured approval workflow
- Sprint-runner automation — closes CEO↔execution loop with GitHub milestone-based sprint launch protocol
- Payment system enhancements — PAY-001, PAY-002, PAY-003 endpoints for settlement and invoice payment tracking
- Database event logging — DB-001 endpoint for invoiceEvents and payment state synchronization

## [1.5.0] — 2026-02-27

- Multi-chain x402 payment expansion — Base, Polygon, and Solana support (CHAIN-001 through CHAIN-009)
- Agent wallet spending activated — autonomous USDC spending on LLM calls via X402_SELLER_WALLET
- New SDK endpoints: SDK-060a through SDK-062 and SDK-200 for enhanced invoice operations
- CEO bot Telegram integration with real execution tools — /sprint, /pull, /update commands plus git and filesystem operations
- Live system context injection into CEO agent — eliminates hallucinations with real PM2, balance, and team state
- Authentication improvements — AUTH-002, AUTH-003 endpoints for secure API key management

## [1.4.0] — 2026-02-20

- New Web3 Growth plan at $24/mo with 5,000 invoices and 25,000 API calls
- Web3 projects see tailored pricing during onboarding
- Registered companies see Free + Pro ($49) + Enterprise tiers
- Added Plans & Pricing documentation page

## [1.3.0] — 2026-02-16

- Added backend API routes for invoices, API keys, webhooks, and settlements
- Added Express app entry point with middleware stack
- Completed SDK test coverage for retry, debug, and client-config modules

## [1.2.0] — 2026-02-15

- Fixed SDK import chain — all modules now use v2 transport and error handling
- Added SDK tests for pagination, events, and timeout modules
- New documentation pages: error handling, environments, quickstart

## [1.1.0] — 2026-02-14

- SDK consolidation — barrel exports, interceptors, environment detection
- New tests for rate-limit, error-compat, and request-builder
- Added webhook events and quickstart documentation

## [1.0.0] — 2026-02-13

- Initial release of Invoica TypeScript SDK
- Core client with invoice, settlement, and API key management
- Webhook signature verification and rate limiting
