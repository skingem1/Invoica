# Changelog

All notable changes to Invoica are documented here.

## [1.7.0] — 2026-03-05

- Expanded agent autonomy with AUTONOMY-001, AUTONOMY-004-A capability enhancements
- Added task decomposition system (DECOMP-001-006) for complex sprint management
- Implemented agent-driven feature restoration (RESTORE-003) with automatic recovery
- Enhanced frontend with QFIX-007-A and SPRINT-002 improvements for user experience
- Added AGENTS-003-A and BACK-001-002 architectural improvements for backend stability
- Improved sprint execution with real file tree injection and stuck task detection mechanisms

## [1.6.0] — 2026-03-01

- Launched x402 payment infrastructure with 0.003 USDC pricing and batched settlement queue
- Enabled agent wallet spending on LLM calls with autonomous USDC settlement
- Integrated Mission Control orchestrator visibility dashboard for agent operations
- Added multi-chain architecture support (Base, Polygon, Solana) with CHAIN-001-009 features
- Implemented autonomous post-sprint pipeline: test → CTO review → Vercel deploy
- Added CMO weekly content plan generator with CEO approval gate and Sunday automation

## [1.5.0] — 2026-02-27

- Added GET /invoices/number/:number endpoint for invoice lookup by invoice number
- Fixed invoices router with corrected v1 API routes and proper route ordering
- Replaced Prisma enums with plain const objects to resolve invoice module crashes
- Added real file tree injection into sprint generation with pre-flight validation
- Implemented graceful port conflict handling in backend startup wrapper

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
