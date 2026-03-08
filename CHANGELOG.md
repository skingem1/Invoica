# Changelog

All notable changes to Invoica are documented here.

## [1.7.0] — 2026-03-06

- Completed multi-chain architecture support: Base, Polygon, and Solana payment settlement
- Added TypeScript syntax gate in orchestrator with deliverable file verification in git
- Implemented X DM outreach automation with Claude-personalized message generation
- Added admin dashboard with clean seed data and improved invoice management
- Fixed invoices router with proper v1 route ordering and GET /invoices/number/:number lookup
- Hardened PM2 process watchdog with restart limits and JSON parse guards

## [1.6.0] — 2026-03-01

- Deployed autonomous post-sprint CI/CD pipeline: test → CTO review → Vercel deploy
- Added CMO weekly content plan generator with CEO→X-admin approval workflow
- Launched Mission Control agent ops visibility dashboard with live PM2 process monitoring
- Implemented memory protocol across all 37 agents for institutional knowledge persistence
- Added git-autodeploy system with self-healing cron checks every 5 minutes
- Integrated Telegram bot with live wallet balance alerts and sprint command execution

## [1.5.0] — 2026-02-27

- Added Telegram bot integration with CEO assistant and customer support capabilities
- Implemented x402 payment protocol with agent wallet spending for LLM calls
- Added email support monitoring via IMAP/SMTP for support@invoica.ai
- Launched public beta with new onboarding flow: company profile → pricing → API key
- Added company registry verification across 12 countries during signup
- Implemented Stripe billing integration with usage analytics dashboard

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
