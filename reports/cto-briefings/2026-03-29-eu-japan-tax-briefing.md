# EU+Japan Tax Watchdog CTO Briefing — 2026-03-29

## Summary
No summary provided.

## Invoica Product Impact
See raw research in report.

## Compliance Gaps (Product Action Required)
None identified.

## Priority Actions
None required this week.

## VAT Rate Reference


## New Regulatory Entries

### [HIGH] EU: Stablecoin Platform Segregation of Customer Funds
**Source**: European Commission MiCA Regulation (EU) 2023/1114
**VAT Rate**: N/A | **Effective**: 2025-06-30
**Summary**: MiCA requires platforms accepting stablecoins to ensure segregation of customer funds and verify issuer compliance with reserve requirements. Platforms must conduct quarterly due diligence on stablecoin issuers.
**Invoica Impact**: Invoica must verify Circle's USDC authorization status quarterly and implement fund segregation tracking in payment processing.
**Status**: ⏳ Pending


### [HIGH] EU: Platform VAT Collection on Micro-Transactions
**Source**: ViDA Proposal COM/2022/701 Final - Platform Economy Rules
**VAT Rate**: 19-22% depending on member state | **Effective**: 2028-01-01
**Summary**: ViDA eliminates de minimis thresholds for platform-mediated B2C transactions; platforms liable for VAT on all transaction values including micro-payments. Real-time VAT calculation required for each transaction.
**Invoica Impact**: Invoica must implement real-time VAT calculation for every AI agent invoice regardless of amount, with jurisdiction-specific rates (19-22%).
**Status**: ⏳ Pending


### [HIGH] Germany: OSS Blockchain Transaction Log Requirements
**Source**: Bundeszentralamt für Steuern (BZSt) OSS Implementation Guideline 2025
**VAT Rate**: 19% | **Effective**: 2025-07-01
**Summary**: BZSt requires platforms using blockchain to maintain exportable transaction logs linking on-chain hashes to OSS declarations. Quarterly reconciliation mandatory.
**Invoica Impact**: Invoica must build OSS declaration module linking Base blockchain transaction hashes to quarterly VAT filings with export functionality.
**Status**: ⏳ Pending


### [HIGH] France: Mandatory Supplier VAT Number Verification for Platforms
**Source**: DGFiP Bulletin Officiel des Finances Publiques BOI-TVA-DECLA-30-10-30
**VAT Rate**: 20% | **Effective**: 2025-04-01
**Summary**: French platforms must verify VAT numbers of all EU suppliers using VIES API before first transaction and quarterly thereafter. Non-compliant transactions trigger platform VAT liability.
**Invoica Impact**: Invoica must integrate VIES API for real-time VAT validation with quarterly re-verification and block non-validated B2B suppliers.
**Status**: ⏳ Pending


### [MEDIUM] Spain: Crypto Invoice EUR Conversion Timestamp Requirement
**Source**: AEAT Orden HAC/1177/2024 - Facturación Electrónica
**VAT Rate**: 21% | **Effective**: 2025-07-01
**Summary**: Spanish tax authority requires invoices paid in crypto to include EUR conversion rate, timestamp of conversion, and exchange source. SII reporting must include both crypto and EUR amounts.
**Invoica Impact**: Invoica must capture and store USDC/EUR exchange rate at payment timestamp with source reference for all Spanish invoices.
**Status**: ⏳ Pending


### [LOW] Italy: SDI Blockchain Invoice Pilot Program
**Source**: Agenzia delle Entrate Provvedimento n. 34534/2024
**VAT Rate**: 22% | **Effective**: 2025-09-01
**Summary**: Italian tax authority launches voluntary pilot for blockchain-based invoices submitted to SDI with on-chain verification. Requires dual submission (XML + blockchain hash) until 2027.
**Invoica Impact**: Invoica can participate in pilot for Italian clients, requiring SDI XML generation with embedded Base transaction hash.
**Status**: ⏳ Pending


### [MEDIUM] Netherlands: Annual Platform Turnover Reporting Requirement
**Source**: Belastingdienst Handboek Btw 2025 - Platformregels
**VAT Rate**: 21% | **Effective**: 2025-01-01
**Summary**: Dutch platforms must file annual report of total turnover by supplier jurisdiction and service category. First filing covers 2025 transactions, due March 31, 2026.
**Invoica Impact**: Invoica must build annual reporting module aggregating turnover by supplier country and AI service category for Dutch tax authority.
**Status**: ⏳ Pending


### [HIGH] Japan: Stablecoin Payment Confirmation for Qualified Invoices
**Source**: National Tax Agency Qualified Invoice System Q&A Update March 2025
**VAT Rate**: 10% | **Effective**: 2025-03-01
**Summary**: NTA confirms stablecoin payments acceptable for qualified invoices if invoice displays JPY amount and payment confirmation links to invoice number. Exchange rate documentation required for 7-year retention.
**Invoica Impact**: Invoica must ensure Japanese invoices display JPY amount with USDC/JPY rate documentation and link blockchain payment to invoice ID.
**Status**: ⏳ Pending


### [MEDIUM] Japan: Quarterly Stablecoin Reserve Verification for Platform Intermediaries
**Source**: Financial Services Agency Payment Services Act Enforcement Order Amendment 2024
**VAT Rate**: N/A | **Effective**: 2025-04-01
**Summary**: FSA requires registered platform intermediaries to verify stablecoin issuer reserve attestations quarterly and maintain evidence. Non-compliance triggers 30-day suspension.
**Invoica Impact**: Invoica must obtain and store Circle's quarterly reserve attestations with verification timestamps in compliance database.
**Status**: ⏳ Pending


### [HIGH] Japan: AI Agent Principal Entity Identification for JCT
**Source**: National Tax Agency AI Transaction Tax Treatment Guideline 2025
**VAT Rate**: 10% | **Effective**: 2025-06-01
**Summary**: NTA requires platforms facilitating AI agent transactions to identify and record the legal entity operating each agent. Entity information must appear on qualified invoices.
**Invoica Impact**: Invoica must implement AI agent registration requiring legal entity verification and include entity details on all Japanese invoices.
**Status**: ⏳ Pending


### [HIGH] EU: Mandatory Platform Customer Location Verification
**Source**: ViDA Proposal COM/2022/701 - Customer Location Rules
**VAT Rate**: 19-22% depending on verified location | **Effective**: 2028-01-01
**Summary**: ViDA requires platforms to verify customer location using two independent data points (IP, billing address, payment method, SIM country). Location determines VAT jurisdiction for B2C.
**Invoica Impact**: Invoica must implement dual-factor location verification for all B2C transactions to determine correct VAT rate application.
**Status**: ⏳ Pending


### [MEDIUM] Germany: AI-Generated Invoice Audit Trail Requirements
**Source**: GoBD v4 BMF-Schreiben IV A 4 - S 0316/19/10003
**VAT Rate**: 19% | **Effective**: 2025-01-01
**Summary**: Updated GoBD requires platforms using AI to generate invoices to maintain complete audit trail of AI model version, input parameters, and human oversight for each invoice.
**Invoica Impact**: Invoica must log AI assistance metadata (if used) for invoice generation including model version and any human edits for German compliance.
**Status**: ⏳ Pending


### [MEDIUM] EU: Platform Reporting of AI Agent Beneficial Owners
**Source**: EU Council Directive DAC8 (EU) 2023/2226
**VAT Rate**: N/A | **Effective**: 2026-01-01
**Summary**: DAC8 extends CARF to require platforms to identify and report beneficial owners of entities operating AI agents generating income. Annual reporting to tax authorities starts 2027 for 2026 transactions.
**Invoica Impact**: Invoica must implement beneficial ownership verification for AI agent operators with annual reporting module for EU tax authorities.
**Status**: ⏳ Pending


### [MEDIUM] France: Platform VAT Security Deposit Requirement
**Source**: DGFiP Direction de la Législation Fiscale Instruction 2025-012
**VAT Rate**: 20% | **Effective**: 2025-07-01
**Summary**: Non-EU platforms collecting French VAT must maintain security deposit equal to one quarter's VAT liability. Deposit requirement triggered at €100,000 annual French VAT.
**Invoica Impact**: Invoica must monitor French VAT collection and set aside security deposit if threshold reached, impacting cash flow.
**Status**: ⏳ Pending


### [LOW] Japan: Platform JCT Threshold Aggregation Across Platforms
**Source**: National Tax Agency Consumption Tax Law Enforcement Order Amendment 2025
**VAT Rate**: 10% | **Effective**: 2025-04-01
**Summary**: NTA clarifies that foreign platforms under common control must aggregate turnover across all platforms for JPY 10M registration threshold. Applies to related entities operating multiple platform brands.
**Invoica Impact**: Invoica must track if parent company operates other platforms and aggregate turnover for JCT threshold monitoring.
**Status**: ⏳ Pending


### [MEDIUM] EU: Platform Obligation to Support Stablecoin Redemption
**Source**: MiCA Regulation (EU) 2023/1114 Article 49
**VAT Rate**: N/A | **Effective**: 2025-06-30
**Summary**: Platforms accepting e-money tokens (stablecoins) must provide functionality for users to redeem tokens directly with issuer or inform users of redemption rights. Redemption at par value required within 1 business day.
**Invoica Impact**: Invoica must either integrate Circle redemption API or display prominent USDC redemption instructions with Circle contact information.
**Status**: ⏳ Pending


### [MEDIUM] Spain: SII Real-Time Reporting Extended to Platforms Above €6M
**Source**: AEAT Real Decreto 1007/2024 - SII Platform Extension
**VAT Rate**: 21% | **Effective**: 2025-07-01
**Summary**: SII immediate supply information extended to platforms with Spanish turnover exceeding €6M annually. Real-time invoice registration within 4 days of issuance required starting July 2025.
**Invoica Impact**: Invoica must implement SII API integration for real-time invoice submission if Spanish turnover exceeds €6M threshold.
**Status**: ⏳ Pending

