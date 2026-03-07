# Changelog

All notable changes to Invoica are documented here.

## [1.7.0] — 2026-03-07

- Completed multi-chain architecture expansion (Base, Polygon, Solana) with chain detection
- Hardened orchestrator with TypeScript syntax gate, deliverable file verification, and path normalization
- Enhanced agent autonomy with skill delegation and CEO-assigned task handling
- Fixed PM2 process stability with restart limits and watchdog monitoring
- Auto-generated live documentation system for API contract and changelog
- Improved x402 settlement queue with batching (50 calls/5 min) and 0.003 USDC pricing

## [1.6.0] — 2026-03-01

- Launched autonomous agent framework with 37 agents across CFO, CMO, CTO, BizDev, and tax roles
- Implemented memory protocol for long-term institutional memory across agent sprints
- Added post-sprint pipeline automation with test→CTO review→Vercel deploy
- Integrated Telegram bot with real execution tools (/pull, /sprint, /update commands)
- Deployed email support monitoring (support@invoica.ai IMAP/SMTP) with auto-response
- Added Mission Control dashboard for real-time agent operations visibility

## [1.5.0] — 2026-02-27

- Added X/Twitter marketing automation with autonomous posting agent (@invoica_ai)
- Implemented x402 payment system with agent wallet spending on USDC
- Added support ticket system with Supabase backend integration
- Deployed Telegram bots for customer support and CEO assistant commands
- Added self-service signup and API key onboarding flow
- Implemented system status pages for dashboard and public website

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
