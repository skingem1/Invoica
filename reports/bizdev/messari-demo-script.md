# Messari Discovery Call — 15-Minute Demo Script

*For Tarek Mnif | March 2026*

---

## Opening (2 min)

[TAREK SAYS]
"Thanks for the time. Quick context: Stripe launched Multi-Party Payments last week, Visa launched Agentic Ready the day before. Both are good products if you're already inside the Stripe ecosystem. But they're Web2 retrofits — they require Stripe accounts, USD rails, KYC. If you're running agent infrastructure on x402 natively, that's the wrong dependency to add.

Invoica is the x402-native layer: invoice generation, on-chain settlement detection, tax compliance, ERP sync — all without a Stripe account. It's the compliance and accounting layer for the parts of your stack that live on-chain.

I'll show you the actual system in 10 minutes. Let me know if you want me to slow down anywhere."

---

## Live Demo Flow (10 min)

### Step 1: Create an Invoice via API (2 min)

[TAREK SAYS]
"Here's the core operation — one API call to create an x402-native invoice."

[SHOW ON SCREEN]
```bash
curl -s -X POST https://api.invoica.ai/v1/invoices \
  -H "x-api-key: YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "messari-research-agent",
    "amount": 0.05,
    "currency": "USDC",
    "chain": "base",
    "description": "On-chain research query — 2026-03-25",
    "taxCountry": "US"
  }'
```

[TAREK SAYS]
"Response comes back with an invoice ID, a deterministic payment address, and a PDF URL. The invoice is now live on-chain — no Stripe webhook, no payment intent, just a wallet address your agent pays to."

---

### Step 2: Settlement Detection (2 min)

[TAREK SAYS]
"When the paying agent sends USDC to that address, Invoica detects it in real time."

[SHOW ON SCREEN — settlement endpoint or dashboard view]
```bash
curl -s https://api.invoica.ai/v1/invoices/{id}/status \
  -H "x-api-key: YOUR_KEY"
```

[TAREK SAYS]
"Status moves from 'pending' to 'settled' the moment the on-chain transfer confirms. No polling delay — we're listening to Base, Solana, and Polygon simultaneously. Your agent can call this endpoint to gate the next action."

---

### Step 3: Tax Compliance Output (2 min)

[TAREK SAYS]
"Every settled invoice automatically triggers tax calculation."

[SHOW ON SCREEN — tax record in response or dashboard]

[TAREK SAYS]
"We support 12 jurisdictions: US federal, UK, Germany, France, Netherlands, and seven others. The tax record is attached to the invoice and exportable. For US: FIFO cost basis, Schedule D compatible. For EU: VAT OSS format. If Messari has any cross-border agent billing, this is already handled."

---

### Step 4: SAP B1 ERP Sync (2 min)

[TAREK SAYS]
"For enterprise customers, settled invoices sync to SAP Business One automatically. This is the proof point that closes the loop with your finance team — on-chain agent transactions show up in the same ERP your accountants already use."

[SHOW ON SCREEN — SAP sync log or invoice record in SAP view]

---

### Step 5: OOBE LangChain Integration — Messari's Use Case (2 min)

[TAREK SAYS]
"This is the one most relevant to your stack. We shipped OOBE Protocol integration this week — four LangChain tools your agents can call directly."

[SHOW ON SCREEN]
```python
from invoica_langchain import InvoicaToolkit

toolkit = InvoicaToolkit(api_key="YOUR_KEY")
tools = toolkit.get_tools()
# createInvoice, getInvoice, checkSettlement, listInvoices
```

[TAREK SAYS]
"Drop these four tools into your LangChain agent and it can invoice, check payment status, and list its own transaction history natively. No custom integration work needed."

---

## Q&A Prep (3 min)

**"We don't use x402 yet."**
[TAREK SAYS]
"That's fine — most teams aren't live on x402 yet. Invoica still gives you the invoice and compliance layer for any USDC on-chain transaction, x402 or not. You can adopt x402 incrementally. We have customers using Invoica purely for settlement tracking before they've wired x402 fully."

---

**"We have our own invoicing."**
[TAREK SAYS]
"If it handles on-chain transactions, multi-chain settlement detection, and 12-country tax compliance, great — keep it. Most teams have billing for their SaaS tier but nothing for their agent's autonomous on-chain payments. That's the gap Invoica fills. Happy to do a 15-minute audit of your current flow if useful."

---

**"Security/compliance concerns."**
[TAREK SAYS]
"No wallet keys leave your agent. Invoica reads public blockchain state to detect settlement — there's no custodial component. Tax outputs are read-only reports. The API key scopes are minimal — you can issue a read-only key if you want to test without write access. SOC 2 is on our roadmap for Q3."

---

**"What about pricing?"**
[TAREK SAYS]
"Free until April 22, 2026. After that, Founding Partner rate is $299/month — locked permanently for the first cohort. Standard enterprise will be $800+/month when we flip the billing switch. Messari would be in the first cohort."

---

**"Can it integrate with X?"**
[TAREK SAYS]
"Depends on X. If it's EVM-compatible or Solana, settlement detection is already there. If it's another chain, I'll scope it and tell you the timeline honestly. If it's an off-chain system like Quickbooks or another ERP, we can discuss — SAP is live, others are on the roadmap."

---

## Closing

[TAREK SAYS]
"That's the full stack in 10 minutes. Two questions: Does the LangChain integration match what your agents actually need? And is there a specific billing or compliance requirement from your finance or legal team I should be aware of before we talk next steps?"
