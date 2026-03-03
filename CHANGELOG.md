# Changelog

All notable changes to Invoica are documented here.

## [1.7.0] — 2026-03-02

- Launched multi-chain x402 expansion: standing sprint priority for Base, Polygon, and Solana payment settlement
- Implemented memory-agent — institutional black box memory system for autonomous agent knowledge persistence
- Added live docs auto-generation system with data-driven changelog and API reference pages
- Enhanced SDK with 8 new auth and payment endpoints (AUTH-002, AUTH-003, PAY-001, PAY-002, PAY-003)
- Implemented git-autodeploy — server self-deploys from GitHub every 5 minutes with Vercel integration
- Added database schema migration suite (DB-001) and 10+ backend core features for payment and chain infrastructure

## [1.6.0] — 2026-02-28

- Added real execution tools to CEO bot: run_shell, write_file, create_github_issue via REST API
- Implemented live on-chain USDC balance monitoring for agent wallets with multi-RPC fallback and deduplication
- Added CTO email support monitoring (support@invoica.ai) with IMAP/SMTP integration and MiniMax-M2.5 agent responses
- Enhanced sprint automation: autonomous post-sprint test→CTO review→Vercel deploy pipeline with sprint-runner PM2 cron
- Implemented CMO weekly content plan generator with Sunday 06:00 UTC scheduling and CEO approval gates
- Added Mission Control integration for real-time agent ops visibility and health monitoring

## [1.5.0] — 2026-02-27

- Added x402 agent wallet spending — agents can now spend USDC on LLM calls with X402_SELLER_WALLET configuration
- Implemented multi-chain architecture support for Base, Polygon, and Solana with CHAIN-001 through CHAIN-009 endpoints
- Added CEO bot Telegram integration with /report, /pm2, /health, and /sprint command tools
- Enhanced x-admin autonomous posting agent with CEO + CTO review gates before publishing
- Fixed backend stability issues — added missing lib/prisma.ts and backend-wrapper.sh to eliminate crash loops
- Implemented autonomy system: PM2 service watchdog, heartbeat monitoring, and pre-deploy TypeScript checks

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
