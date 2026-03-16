# Invoica Project State

## Current State (2026-03-16)
- **Git**: e697bf8 on main, pushed to origin (clean)
- **Tests**: 87/87 suites, 593/593 tests — ALL PASS
- **TypeScript**: 0 source errors
- **Backend**: Running on Hetzner (port 3001), health OK, DB connected — STABLE (HF-006 flock mutex applied, 0 restarts)
- **OpenClaw**: Stable (v2026.3.13, port 18789 WebSocket)
- **Frontend**: Vercel (no local node_modules — deps installed by Vercel)
- **Sprint Runner**: Waiting (cron */30)
- **git-autodeploy**: Stopped (not critical)

## Infrastructure
- **Server**: Hetzner VPS 65.108.90.178, disk ~19%
- **Backend port**: 3001 (not 3000). Health: /v1/health
- **OpenClaw port**: 18789 (WebSocket, not HTTP) — v2026.3.13
- **DB**: Supabase (Session Pooler port 6543)
- **.env**: Exists on server, NOT in git (only .env.example)
- **Health URL**: http://localhost:3001/v1/health (not /health)

## Completed Sprints (This Session)
1. HF-JEST — Jest + ts-jest configured (7d71034)
2. SOL-005 — Solana paymentDetails validation (897177d)
3. HF-SOL-TESTS — Solana detector test rewrite (0574478)
4. CTO-006 — Frontend api-keys page split 545→294 lines (4069ad2)
5. HF-TESTS — Fixed all 75 test suites (092916b)
6. Sprint 006 — Solana x402 adapter + OpenClaw fix (b995fd9)
7. Sprint 007 — Low-score pattern monitoring (730e532)
8. Sprint 008 — Agent health monitoring assessment (6a2bcf0)
9. Sprint 009 — Backend PM2 stability fix (dd1529a)
10. Sprint 010 — Legacy test cleanup 38 files (3de6abd)
11. Sprint 011 — Wire Solana invoice route (8ffeeea)
12. HF-001 — PM2 listen_timeout 10s→60s fix (445408c)
13. HF-002 — Kill stale root node process holding port 3001 (server-only, no code change)
14. Sprint 012 — Tax Compliance Engine wiring: routes/tax.ts + invoice tax integration (c83d31b)
15. HF-003 — PM2 max_restarts 50→20, listen_timeout 60s→120s (ecosystem.config.js)
16. HF-004 — Remove wait_ready (PM2 IPC incompatible with bash wrappers)
17. HF-005 — Remove max_restarts entirely (bounded by min_uptime:"30s" instead)
18. HF-006 — flock mutex in backend-wrapper.sh (prevents parallel wrapper race on port 3001)
19. Sprint 013 — Reputation API: fix agentId→companyId query + env var consistency + 4 route tests (8fd5e88)
20. Sprint 014 — Route coverage: add tests for admin, ledger, ai-inference, gas-backstop (f118149)
21. Sprint 015 — Service unit tests: tax calculator (28 tests) + reputation scoring (14 tests) (22eda17)
22. Sprint 016 — Core service unit tests: invoice (18 tests) + ledger recorder (12) + ledger budget (11) — jest uuid ESM fix (e697bf8)

## Known Issues
- Redis: not_configured (backend health shows redis: not_configured — non-blocking)
- .env not in repo (only .env.example) — local dev can't run full stack
- openclaw-gateway: PM2 shows "waiting" state (24 restarts) but gateway IS functional
- CMO-001: Reactivate Manus CMO blocked — needs MANUS_API_KEY (human action)

## Week-76 Status — ALL DONE
- [x] FIX-001, FIX-002, FIX-003, FIX-004, FIX-005 — all done
- [x] SOL-004, SOL-005, SOL-006 — Solana features complete
- [x] FRONTEND-001 — api-keys page split
- [x] INFRA-001 — OpenClaw stable
- [x] MONITOR-001 — low-score monitoring script
- [x] ASSESS-001 — caching NO-GO
- [ ] CMO-001 — blocked on human action (MANUS_API_KEY)

## Sprint 012 — COMPLETE
- routes/tax.ts: POST /v1/tax/calculate + GET /v1/tax/jurisdictions
- invoices.ts: POST /v1/invoices now accepts buyerCountryCode/buyerStateCode/buyerVatNumber, stores tax in paymentDetails.tax
- app.ts: taxRoutes registered
- 11 new tests — 77/77 suites, 492/492 pass
- No Prisma migration needed (tax stored in existing paymentDetails JSON field)

## Sprint 013 — COMPLETE
- services/reputation.ts: query companyId not agentId + guard env vars
- routes/reputation.ts: use NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (consistent)
- 4 reputation route existence tests added

## Sprint 014 — COMPLETE
- 4 new test files: admin, ledger, ai-inference, gas-backstop route tests
- 14 new tests — all route files now have coverage
- Tests: 82/82 suites, 510/510 pass

## Sprint 015 — COMPLETE
- services/tax/__tests__/calculator.test.ts: 28 tests for calculateTax(), calculateUSTax(), calculateEUVAT(), hasUSNexus(), getUSNexusRate(), calculateNoTax()
- services/__tests__/reputation.test.ts: 14 tests for computeAndStoreReputation() — score algorithm, tier boundaries, bonus caps, status handling, error propagation
- Tests: 84/84 suites, 552/552 pass (42 new tests)

## Sprint 016 — COMPLETE
- services/__tests__/invoice.test.ts: 18 tests for isValidStatusTransition(), error classes, Zod schemas
- services/ledger/__tests__/recorder.test.ts: 12 tests for validateBalancedTransaction(), generateTransactionId(), recordTransaction(), isTransactionIdempotent()
- services/ledger/__tests__/budget.test.ts: 11 tests for getBudget(), checkBudget(), reservation lifecycle, cleanupExpiredReservations(), createBudget()
- jest.config.js: uuid added to transformIgnorePatterns (ESM fix)
- Tests: 87/87 suites, 593/593 pass (41 new tests)

## Next Sprint: Sprint 017
- Remaining service test gaps: ledger/query.ts, ledger/enforcement.ts, settlement-poller.ts, gas-manager.ts
- OR: create week-77.json with new feature tasks (Agent Marketplace or invoice improvements)

## V17 + Solana Migration — COMPLETE
- All 4 V17 sprints COMPLETE
- SOL-004, SOL-005, SOL-006 — ALL COMPLETE
- Chain tests COMPLETE
