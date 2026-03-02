# Changelog

All notable changes to Invoica are documented here.

## [1.7.0] — 2026-03-02

- Launched multi-chain x402 expansion: Base, Polygon, and Solana payment support (CHAIN-001 through CHAIN-009)
- Implemented autonomous post-sprint pipeline: test→CTO review→Vercel deploy with sprint-runner orchestration
- Added live docs auto-generation system with data-driven changelog and API reference pages
- Integrated memory-agent for institutional black-box memory system supporting agent autonomy
- Activated agent wallet spending with X402_SELLER_WALLET environment configuration
- Added CMO weekly content plan generator with Sunday cron and CEO approval gate for autonomous marketing

## [1.6.0] — 2026-02-28

- Launched autonomous X posting agent (@invoica_ai) with content calendar and CEO/CTO review gate
- Added Telegram bot integration with /report, /pm2, /health, /sprint commands for ops visibility
- Implemented CTO email support monitoring (support@invoica.ai) with IMAP/SMTP agent response
- Added full CRUD webhook management page with active/inactive toggle functionality
- Fixed recurring Telegram silence with multi-RPC balance checks and deduplication logic
- Implemented PM2 service watchdog with Telegram alerts and pre-deploy TypeScript validation

## [1.5.0] — 2026-02-27

- Added real API keys management page with TypeScript SDK build support
- Implemented x402 wallet integration for agent spending on LLM calls with USDC support
- Added CEO bot tools: create_github_issue, run_shell, write_file, check_signups, get_team_status
- Upgraded CEO bot to Claude Sonnet with live system context injection and improved identity
- Fixed mixed content issues via Next.js rewrites and enabled Web3 no-email bypass for beta
- Added Ledger page to dashboard sidebar for transaction tracking

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
