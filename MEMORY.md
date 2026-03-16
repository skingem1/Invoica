# Invoica Project State

## Current State (2026-03-16)
- **Git**: dd1529a on main, pushed to origin
- **Tests**: 76/76 suites, 481/481 tests — ALL PASS
- **TypeScript**: 0 source errors (6 in node_modules/ox — skipLibCheck)
- **Backend**: Running on Hetzner (port 3001), health OK, DB connected
- **OpenClaw**: FIXED — stable at 77s+ uptime, no more crash loop
- **Frontend**: Vercel (no local node_modules — deps installed by Vercel)
- **Sprint Runner**: Waiting (cron */30)
- **git-autodeploy**: Running (cron */5)

## Infrastructure
- **Server**: Hetzner VPS 65.108.90.178, disk 19%
- **Backend port**: 3001 (not 3000)
- **OpenClaw port**: 18789 (WebSocket, not HTTP) — v2026.3.13
- **DB**: Supabase (Session Pooler port 6543)
- **.env**: Exists on server, NOT in git (only .env.example)

## Completed Today (6 sprints)
1. HF-JEST — Jest + ts-jest configured
2. SOL-005 — Solana paymentDetails validation (programId + tokenMint)
3. HF-SOL-TESTS — Solana detector test rewrite
4. CTO-006 — Frontend api-keys page split (545→294 lines)
5. HF-TESTS — Fixed all 75 test suites to match implementations
6. Sprint 006 — Solana x402 adapter + OpenClaw fix + task status sync
7. Sprint 007 — Low-score pattern monitoring script (MONITOR-001)
8. Sprint 008 — Agent health monitoring assessment (CTO-20260217-002 — already done)
9. Sprint 009 — Backend PM2 stability fix (removed cron restart loop)

## Known Issues
- Redis: not_configured (backend health shows redis: not_configured)
- backend/tests/ directory: legacy vitest-based tests excluded from jest config
- .env not in repo (only .env.example) — local dev can't run full stack

## Remaining week-76 Items
- [ ] CMO-001: Reactivate Manus CMO (needs MANUS_API_KEY in .env — human action)
- [x] MONITOR-001: done (Sprint 007)
- [x] FRONTEND-001: done (CTO-006)
- [x] INFRA-001: done (OpenClaw fixed)
- [x] SOL-005: done (commit 897177d)
- [x] SOL-006: done (commit b995fd9)
- [x] ASSESS-001: done (closed NO-GO)

## V17 Migration Status
- All 4 V17 sprints COMPLETE
- SOL-004 Solana invoice creation COMPLETE
- SOL-005 Solana paymentDetails validation COMPLETE
- SOL-006 Solana x402 adapter COMPLETE
- Chain tests COMPLETE (chain-registry, settlement-router, solana-detector)
