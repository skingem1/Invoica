#!/bin/bash
cd /home/invoica/apps/Invoica

ANTHROPIC_KEY=$(grep ANTHROPIC_API_KEY .env | cut -d= -f2-)
MINIMAX_KEY=$(grep MINIMAX_API_KEY .env | cut -d= -f2-)
MINIMAX_GROUP=$(grep MINIMAX_GROUP_ID .env | cut -d= -f2-)

TODAY=$(date +%Y-%m-%d)
OUT_DIR="reports"
mkdir -p "$OUT_DIR/cto" "$OUT_DIR/cmo"

echo "=== Invoica Landing Page Analysis ==="
echo "Running CTO shipped-features report + CMO landing page audit..."
echo ""

# Call Claude with full context
python3 << PYEOF
import urllib.request, json, os

ANTHROPIC_KEY = "$ANTHROPIC_KEY"
MINIMAX_KEY = "$MINIMAX_KEY"
MINIMAX_GROUP = "$MINIMAX_GROUP"

def call_anthropic(system, user, max_tokens=4000):
    body = json.dumps({
        "model": "claude-sonnet-4-20250514",
        "max_tokens": max_tokens,
        "system": system,
        "messages": [{"role": "user", "content": user}]
    }).encode()
    req = urllib.request.Request(
        "https://api.anthropic.com/v1/messages",
        data=body,
        headers={
            "x-api-key": ANTHROPIC_KEY,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json"
        }
    )
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.loads(r.read())["content"][0]["text"]

def call_minimax(system, user):
    body = json.dumps({
        "model": "MiniMax-M2.5",
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user}
        ],
        "max_tokens": 3000
    }).encode()
    req = urllib.request.Request(
        f"https://api.minimaxi.chat/v1/text/chatcompletion_v2?GroupId={MINIMAX_GROUP}",
        data=body,
        headers={
            "Authorization": f"Bearer {MINIMAX_KEY}",
            "content-type": "application/json"
        }
    )
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.loads(r.read())["choices"][0]["message"]["content"]

# ── CONTEXT ──────────────────────────────────────────────────────────────────

ACTUAL_ROUTES = """
Live API routes (verified in production today):
- GET/POST /v1/invoices          — create & list invoices (22 real invoices in DB)
- GET/PUT  /v1/invoices/:id      — get/update invoice
- GET      /v1/invoices/number/:n — get invoice by number
- PUT      /v1/invoices/:id/status
- GET/POST /v1/settlements       — 14 real settlements in DB (Base mainnet)
- GET      /v1/settlements/:id
- GET      /v1/ledger            — full accounting ledger
- GET      /v1/ledger/summary
- GET      /v1/ledger/export.csv
- POST     /v1/ledger/send-verification / confirm-verification
- GET/POST /v1/api-keys          — API key management (no email required)
- POST     /v1/api-keys/:id/revoke / rotate
- GET/POST /v1/webhooks          — webhook endpoints
- GET/POST /v1/ai/inference      — x402 pay-per-call LLM inference (0.003 USDC/call, EIP-712 verified)
- GET      /v1/health            — health check (uptime 791s, db ok)
"""

SUPABASE_FEATURES = """
Supabase edge function (api v14) - verified live:
- Full invoice CRUD with user isolation (JWT auth, users see only their data)
- Dashboard stats (aggregated metrics)
- Trial balance / ledger
- API key management
- Billing integration (Stripe)
- Company profile + business verification (EU VIES, France SIRENE, Companies House UK, Canada, Japan NTA, Israel)
- Webhook management
"""

WHATS_WORKING = """
Confirmed working in production (Day 10 of beta):
✅ app.invoica.ai — dashboard live (Vercel)
✅ www.invoica.ai — landing page live
✅ docs at invoica.mintlify.app — 14 pages
✅ Backend API (localhost:3001) — all routes responding
✅ Supabase edge function — auth-aware, user-isolated
✅ Invoice creation/listing — 22 real invoices in DB
✅ Settlement detection — 14 settlements confirmed on Base mainnet
✅ x402 inference endpoint — EIP-712 payment verification, calls Anthropic/MiniMax
✅ API key management — create/revoke/rotate, no email required
✅ Webhooks — create/manage endpoints
✅ Business verification — EU VAT, UK Companies House, France SIRENE, Canada, Japan, Israel
✅ CSV ledger export
✅ SDK directory exists (frontend/src/lib/ + sdk/)

NOT CONFIRMED / PROBABLY NOT WORKING:
❌ Budget enforcement — mentioned on landing page, no /v1/budgets route found
❌ Tax compliance auto-calculation — no /v1/tax route found (company verification exists, not tax calc)
❌ "100 modules, 26 React hooks" SDK claim — not verified
❌ TypeScript SDK as npm package — no evidence of published package
❌ Multichain — explicitly marked "in development" on landing page (honest)
"""

LANDING_PAGE = """
Current landing page sections:
1. HERO: "The Financial OS for AI Agents" — Built on x402 Protocol
   - Sub: "Automated invoicing, tax compliance, budget enforcement, and settlement detection"
   - CTA: "Start Building" → app.invoica.ai/api-keys
   - Code snippet showing InvoicaClient SDK usage
   
2. PROBLEM: "AI agents can transact. Nobody tracks them."
   - Pain points: No invoice/record, Zero audit trail, No budget controls, Enterprise can't trust it
   
3. FEATURES (6 cards):
   - Automated Invoicing ✅ REAL
   - Tax Compliance ⚠️ CLAIMED (company verification exists, not full tax calc)
   - Budget Enforcement ❌ NOT FOUND in routes
   - Settlement Detection ✅ REAL (14 settlements on Base)
   - TypeScript SDK ⚠️ CLAIMED ("100 modules, 26 hooks" — unverified)
   - Developer Dashboard ✅ REAL (app.invoica.ai)

4. CODE EXAMPLE: webhook handler using @invoica/sdk — verifyWebhook
   
5. SOCIAL PROOF ("By the Numbers"):
   - "x402 Native Protocol" ✅
   - "100+ SDK Modules" ⚠️ UNVERIFIED
   - "Base Mainnet Live" ✅
   - "<10m Time to First Invoice" ✅ (probably true)

6. PRICING:
   - Developer: Free (1000 invoices/mo, $10K volume)
   - Growth: 0.5% of volume
   - Enterprise: Custom
   - NOTE: Currently in beta, everything is free — pricing page may confuse users

HIDDEN GEMS NOT ON LANDING PAGE:
- x402 inference endpoint (pay-per-use AI inference at 0.003 USDC/call) — very demo-able
- Business verification (EU VAT, UK, France, Canada, Japan, Israel) — enterprise credibility
- Ledger + CSV export — accounting teams love this
- Telegram bot (t.me/invoicaBot) — mentioned in docs, not on landing
"""

# ── STEP 1: CTO "What's Shipped" Report (MiniMax) ──────────────────────────

print("\\n[1/2] CTO generating shipped-features report...")

cto_system = """You are the CTO of Invoica. You write precise, factual technical reports. 
No fluff. Only confirmed facts. Flag anything uncertain."""

cto_prompt = f"""Generate a concise "What's Shipped" report for Invoica beta (Day 10).
Base it strictly on the data below — no assumptions.

{ACTUAL_ROUTES}
{SUPABASE_FEATURES}
{WHATS_WORKING}

Format as markdown with sections:
## What's Confirmed Working (with evidence)
## What's Partially Working (with caveats)  
## What's On Landing Page But NOT Confirmed in Routes
## Hidden Capabilities Not Promoted
## Quick Wins to Demo to First Users
"""

cto_report = call_minimax(cto_system, cto_prompt)
with open("reports/cto/whats-shipped-{TODAY}.md".format(TODAY="$TODAY"), "w") as f:
    f.write("# CTO Shipped Features Report — $TODAY\\n\\n")
    f.write(cto_report)
print("  ✅ Saved: reports/cto/whats-shipped-$TODAY.md")

# ── STEP 2: CMO Landing Page Audit + Recommendations (Claude) ──────────────

print("\\n[2/2] CMO analyzing landing page...")

cmo_system = """You are the CMO of Invoica — developer-first financial infrastructure for AI agents.
Brand: technical founder voice, precise, no hype. Colors: Invoica Blue #0A2540, Agentic Purple #635BFF.
Target: AI agent developers, x402 protocol builders, autonomous agent platforms."""

cmo_prompt = f"""Do a full landing page audit and give concrete recommendations.

## Current Landing Page Content
{LANDING_PAGE}

## CTO Verified Reality (what actually works)
{WHATS_WORKING}

## Task
1. AUDIT: What's working well on the current landing page? What's misleading or unverified?
2. POSITIONING: Given what's actually live, what's the strongest honest story to tell?
3. HERO: Should we change the hero message? The sub-headline? Suggest exact copy.
4. FEATURES: Which 6 features should we show? Replace unverified ones with real working ones.
5. SOCIAL PROOF: The stats section shows "100+ SDK Modules" (unverified). What real, provable numbers can we use instead?
6. DEMO-ABILITY: What's the single most impressive thing we can show someone in 60 seconds to make them want to sign up?
7. CTA STRATEGY: Is "Start Building" the right CTA? Who is our most likely first user?
8. WHAT TO ADD: Are there sections missing that would help conversion?
9. WHAT TO REMOVE OR FIX: What's hurting credibility?

Be specific. Suggest exact copy where possible. This is beta, be honest about that.
"""

cmo_report = call_anthropic(cmo_system, cmo_prompt, max_tokens=5000)
with open("reports/cmo/landing-page-audit-{TODAY}.md".format(TODAY="$TODAY"), "w") as f:
    f.write("# CMO Landing Page Audit — $TODAY\\n\\n")
    f.write(cmo_report)
print("  ✅ Saved: reports/cmo/landing-page-audit-$TODAY.md")

print("\\n=== Done. Reports saved. ===")
PYEOF
