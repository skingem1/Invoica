# Changelog

All notable changes to Invoica are documented here.

## [1.7.0] — 2026-03-02

- Completed multi-chain architecture rollout — integrated CHAIN-001 through CHAIN-009 tasks for Base, Polygon, and Solana support
- Delivered expanded SDK capabilities with SDK-060a through SDK-062 enhancements for improved payment processing
- Finalized authentication system with AUTH-002 and AUTH-003 implementations for secure x402 transactions
- Resolved orchestrator schema mismatches and fixed CEO hallucination edge cases in agent pipelines
- Implemented live docs auto-generation system with data-driven changelog and API reference pages
- Activated agent institutional memory via black-box memory-agent system for persistent decision context

## [1.6.0] — 2026-03-01

- Launched Mission Control integration for centralized agent operations visibility and monitoring
- Implemented autonomous post-sprint pipeline — auto-trigger test→CTO review→Vercel deploy after sprints
- Added CMO weekly content plan generator with CEO approval gate and Sunday 06:00 UTC scheduling
- Enabled git auto-deployment system — server self-deploys from GitHub every 5 minutes with TypeScript + ecosystem CI gates
- Enhanced CTO email support — added IMAP/SMTP monitoring for support@invoica.ai with AI-powered responses
- Introduced heartbeat service with Telegram summaries, dead-man's switch pings, and PM2 watchdog for autonomy gap closure

## [1.5.0] — 2026-02-27

- Added x402 agent wallet spending — agents now spend USDC on LLM calls via configured seller wallet
- Launched autonomous X posting agent (@invoica_ai) with CEO + CTO review gates for all content
- Implemented CEO bot with execution tools — run_shell, write_file, create_github_issue, and live system context injection
- Added Telegram bot integration with /report, /pm2, /health, /sprint commands for real-time ops visibility
- Fixed backend stability — added missing lib/prisma.ts and backend-wrapper.sh to eliminate 4799+ crash restarts
- Introduced multichain x402 expansion with standing sprint priority for Base, Polygon, and Solana

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
