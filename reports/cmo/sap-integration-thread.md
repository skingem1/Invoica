# SAP Integration Tweet Thread

**Tweet 1 — The headline:**

Invoica now auto-detects SAP escrow settlements on Solana. 🔍

When an agent pays via @OOBEProtocol SAP x402 escrow, Invoica sees it on-chain and creates the invoice automatically.

SAP Program: SAPpUhsWLJG1FfkGRcXagEDMrMsWGjbky7AyhGpFETZ

---

**Tweet 2 — How it works:**

detectSapEscrowSettlement(txSig, rpcUrl)
→ checks if tx targets SAP program + USDC → Invoica wallet
→ discriminator-based detection with fallback
→ returns SapEscrowMatch | null. Never throws. ⚡

---

**Tweet 3 — Why it matters:**

SAP agents don't have to chase invoices. Pay via SAP escrow, Invoica auto-invoices. Fully on-chain. Zero manual steps. 🤖

One more step toward the fully autonomous agent economy.

