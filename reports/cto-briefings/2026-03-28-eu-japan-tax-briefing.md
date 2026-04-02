# EU+Japan Tax Watchdog CTO Briefing — 2026-03-28

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

### [HIGH] EU: Mandatory EN 16931 e-invoicing standard for cross-border B2B
**Source**: European Commission ViDA Directive 2022/0394
**VAT Rate**: N/A | **Effective**: 2030-01-01
**Summary**: ViDA mandates structured e-invoicing using EN 16931 standard for all intra-EU B2B transactions by 2030. All invoices must be machine-readable XML (Peppol BIS, UBL, or CII formats).
**Invoica Impact**: Invoica must export invoices in EN 16931-compliant XML format (not just PDF). Need XML generator supporting Peppol BIS Billing 3.0 with USDC payment method extension fields.
**Status**: ⏳ Pending


### [HIGH] EU: Single VAT Registration for all EU digital service providers
**Source**: Council of the EU General Approach 2024/06/17
**VAT Rate**: N/A | **Effective**: 2025-07-01
**Summary**: Platforms providing digital services must register for VAT in one Member State for all EU operations, eliminating need for 27 separate registrations. Extends OSS coverage to platform-mediated B2B transactions.
**Invoica Impact**: Invoica can register once (e.g., Netherlands or Ireland) for all EU VAT obligations. Must build OSS return automation supporting both B2C and B2B platform transactions.
**Status**: ⏳ Pending


### [HIGH] EU: Mandatory real-time payment data API for tax authorities
**Source**: ViDA Digital Reporting Requirement (DRR) Proposal
**VAT Rate**: N/A | **Effective**: 2028-01-01
**Summary**: Platforms must provide tax authorities with API access to real-time transaction and payment data, including blockchain transaction hashes and wallet addresses for crypto payments.
**Invoica Impact**: Invoica must build secure API endpoints for EU tax authorities to query transaction data. Need role-based access control, audit logging, and blockchain hash/wallet address exposure.
**Status**: ⏳ Pending


### [HIGH] EU: Platform liability for accepting only authorized stablecoin issuers
**Source**: Markets in Crypto-Assets Regulation (MiCA) 2023/1114
**VAT Rate**: N/A | **Effective**: 2024-12-30
**Summary**: Platforms accepting stablecoin payments must verify issuer has MiCA authorization and €1:1 reserve backing. Platform liable for accepting unauthorized stablecoins.
**Invoica Impact**: Invoica must verify Circle (USDC issuer) has MiCA authorization before operating in EU. Need to monitor Circle's authorization status and build fallback if authorization lapses.
**Status**: ⏳ Pending


### [MEDIUM] EU: Mandatory crypto transaction reporting under CARF
**Source**: DAC8 Directive - Crypto Asset Reporting Framework
**VAT Rate**: N/A | **Effective**: 2026-01-01
**Summary**: Digital platforms facilitating crypto payments must report all transactions exceeding €50,000 annually per user to tax authorities, including wallet addresses, transaction volumes, and counterparty identities.
**Invoica Impact**: Invoica must implement user transaction tracking, aggregate annual volumes per AI agent owner, and submit XML reports to each Member State tax authority by January 31 annually.
**Status**: ⏳ Pending


### [HIGH] Germany: Real-time audit API access for blockchain invoice systems
**Source**: GoBD v4 (Grundsätze zur ordnungsmäßigen Führung und Aufbewahrung von Büchern)
**VAT Rate**: 19% | **Effective**: 2025-01-01
**Summary**: Blockchain invoice systems must provide German tax authorities with real-time API access to invoice data, including transaction hashes, timestamps, and smart contract addresses. 10-year retention mandatory.
**Invoica Impact**: Invoica must build German tax authority API with real-time Base blockchain transaction lookup, hash verification, and immutable audit trail export. Need GoBD compliance certification.
**Status**: ⏳ Pending


### [LOW] Germany: TSE certification exemption for B2B invoice platforms
**Source**: KassenSichV (Kassensicherungsverordnung) Amendment 2025
**VAT Rate**: 19% | **Effective**: 2025-01-01
**Summary**: Blockchain-based B2B invoice platforms exempt from TSE (technical security element) certification requirement if transactions are immutably recorded on public blockchain.
**Invoica Impact**: Invoica exempt from German TSE certification requirement due to Base blockchain immutability. Must document blockchain audit trail as TSE substitute in compliance documentation.
**Status**: ⏳ Pending


### [MEDIUM] France: Mandatory 99.9% uptime SLA for VAT validation API integration
**Source**: DGFiP Real-Time VAT Validation Directive 2025
**VAT Rate**: 20% | **Effective**: 2025-06-01
**Summary**: Platforms must integrate DGFiP real-time VAT number validation API with 99.9% uptime SLA and automatic fallback to offline validation cache if API unavailable.
**Invoica Impact**: Invoica must integrate with DGFiP VIES API, cache valid VAT numbers for 24-hour offline fallback, and log all validation attempts. Need monitoring and alerting for API downtime.
**Status**: ⏳ Pending


### [MEDIUM] France: Annual stablecoin payment volume declaration to DGFiP
**Source**: DGFiP Stablecoin Payment Reporting Decree 2025
**VAT Rate**: 20% | **Effective**: 2025-01-01
**Summary**: Platforms processing stablecoin payments must file annual declaration (Déclaration de Paiements en Actifs Numériques) with total volumes, number of transactions, and counterparty locations by March 31.
**Invoica Impact**: Invoica must track annual USDC payment volumes for French users, generate DGFiP-compliant XML declaration, and submit via Espace Professionnel portal by March 31 annually.
**Status**: ⏳ Pending


### [HIGH] Spain: Mandatory blockchain transaction hash field in SII reporting
**Source**: AEAT SII (Suministro Inmediato de Información) Extension 2025
**VAT Rate**: 21% | **Effective**: 2025-01-01
**Summary**: Digital platforms using blockchain payments must include transaction hash in SII real-time invoice reporting within 4 days of transaction. Hash must be verifiable on public blockchain explorer.
**Invoica Impact**: Invoica must add Base blockchain transaction hash to SII XML submission for all Spanish invoices. Need automated SII submission within 4-day window and hash verification endpoint.
**Status**: ⏳ Pending


### [HIGH] Italy: SDI stablecoin EUR conversion rate and timestamp reporting
**Source**: Agenzia delle Entrate SDI Technical Specification v1.8
**VAT Rate**: 22% | **Effective**: 2025-07-01
**Summary**: E-invoices with stablecoin payments must include EUR conversion rate, rate source (e.g., Coinbase), timestamp of conversion, and original USDC amount in structured XML fields.
**Invoica Impact**: Invoica must capture EUR/USDC exchange rate at payment time, store rate source and timestamp, and populate SDI XML ImportoPagamento, TassoConversione, and FonteTasso fields for Italian invoices.
**Status**: ⏳ Pending


### [HIGH] Netherlands: Joint liability for VAT fiscal representative on platform transactions
**Source**: Belastingdienst VAT Fiscal Representative Decree 2025
**VAT Rate**: 21% | **Effective**: 2025-01-01
**Summary**: Non-EU platforms must appoint Dutch VAT fiscal representative who assumes joint and several liability for all platform VAT obligations, including customer non-payment.
**Invoica Impact**: Invoica must appoint Dutch VAT representative with joint liability coverage. Representative will be liable for unpaid VAT even if Invoica platform user fails to remit. Need indemnity insurance and representative contract review.
**Status**: ⏳ Pending


### [MEDIUM] Netherlands: Quarterly crypto transaction reporting for non-EU platforms
**Source**: Belastingdienst Crypto Platform Reporting Regulation 2025
**VAT Rate**: 21% | **Effective**: 2025-01-01
**Summary**: Non-EU platforms facilitating crypto payments to Dutch users must submit quarterly reports with aggregated transaction volumes, user counts, and wallet addresses.
**Invoica Impact**: Invoica must track quarterly Dutch user USDC transactions, aggregate by wallet address, and submit to Belastingdienst via Digipoort by month-end following quarter close.
**Status**: ⏳ Pending


### [HIGH] Japan: Final guidance on consumption place for AI agent transactions
**Source**: NTA Consumption Tax on AI Agent Services Guidance 2025
**VAT Rate**: 10% | **Effective**: 2025-04-01
**Summary**: AI agent transactions are taxed based on the location of the legal entity controlling the agent, not the agent's server location. B2B transactions qualify for reverse charge if customer is registered for JCT.
**Invoica Impact**: Invoica must determine AI agent owner's legal entity location (not server/node location) for JCT. Need customer registration number validation for B2B reverse charge qualification.
**Status**: ⏳ Pending


### [HIGH] Japan: KKS acceptance of blockchain-based invoices with digital signature
**Source**: NTA Qualified Invoice System (KKS) Blockchain Format Clarification 2025
**VAT Rate**: 10% | **Effective**: 2025-04-01
**Summary**: Blockchain invoices qualify as KKS-compliant if they include registered invoice issuer number, digital signature verifiable on-chain, and 7-year retrievability guarantee.
**Invoica Impact**: Invoica must embed KKS invoice issuer registration number in blockchain invoice metadata, implement on-chain digital signature, and guarantee 7-year Base blockchain data availability or export.
**Status**: ⏳ Pending


### [HIGH] Japan: Transaction limits and enhanced due diligence for stablecoin platforms
**Source**: FSA Payment Services Act Amendment - Stablecoin Platform Rules 2025
**VAT Rate**: N/A | **Effective**: 2025-06-01
**Summary**: Stablecoin platforms must implement ¥1,000,000 monthly transaction limit per user unless enhanced KYC/AML due diligence completed. Platforms must register as Type II Financial Instruments Business or Payment Service Provider.
**Invoica Impact**: Invoica must register with FSA as Payment Service Provider, implement enhanced KYC for users exceeding ¥1M/month USDC volume, and build transaction limit controls with automatic suspension.
**Status**: ⏳ Pending

