# Outreach Email — Messari

**To:** team@messari.io *(or specific contact if known)*
**From:** team@invoica.ai
**Subject:** x402-native invoicing for Messari's agent stack — free pilot

---

Hi,

Two things happened last week worth noting: Stripe launched Multi-Party Payments, Visa launched Agentic Ready. Both are good products if you're already inside the Stripe ecosystem. Neither is built for what Messari is doing — autonomous agents transacting on-chain with USDC.

Invoica is the layer those tools skip: x402-native invoice generation, on-chain settlement detection across Base, Solana, and Polygon, and 12-country tax compliance — no Stripe account, no fiat rails, no KYC requirement.

The integration point for your stack is direct. We shipped four LangChain tools last week:

```python
from invoica_langchain import InvoicaToolkit
toolkit = InvoicaToolkit(api_key="YOUR_KEY")
tools = toolkit.get_tools()
# createInvoice, getInvoice, checkSettlement, listInvoices
```

Drop those into any LangChain agent and it can invoice, track settlement, and maintain a transaction history natively. No custom integration work.

**Pilot offer:** Full platform access, no cost, no commitment through the end of May. First cohort gets the Founding Partner rate ($299/month) locked permanently after that — standard enterprise pricing will be $800+/month.

15 minutes to show you the live system — or just grab an API key at invoica.ai and test it directly, no account creation required.

Worth a look?

— The Invoica Team
team@invoica.ai | invoica.ai
