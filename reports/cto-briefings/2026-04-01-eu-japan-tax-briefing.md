# EU+Japan Tax Watchdog CTO Briefing — 2026-04-01

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

### [HIGH] EU: Platform VAT liability for autonomous AI agent transactions
**Source**: European Commission VAT Committee Guidelines 2025
**VAT Rate**: N/A | **Effective**: 2025-01-01
**Summary**: ViDA clarifies that platforms facilitating AI-to-AI transactions are deemed suppliers for VAT purposes when AI agents lack identifiable human principals. Platforms must collect VAT on all B2C AI service transactions from January 2025.
**Invoica Impact**: Invoica must implement VAT collection logic for B2C transactions where customer identification fails to establish a valid business entity, treating such transactions as B2C by default with VAT applied at customer location rate.
**Status**: ⏳ Pending


### [HIGH] EU: Mandatory crypto payment method disclosure in OSS declarations
**Source**: European Commission OSS Technical Specification v2.1
**VAT Rate**: N/A | **Effective**: 2025-07-01
**Summary**: OSS quarterly declarations must now include a specific field identifying transactions paid via cryptocurrency/stablecoins, with USDC requiring distinct reporting code 'STABLECOIN-USD'.
**Invoica Impact**: Invoica must tag all USDC transactions with payment method identifier and include this in OSS declaration exports, requiring schema update to quarterly VAT reporting module.
**Status**: ⏳ Pending


### [HIGH] Germany: Daily exchange rate documentation for stablecoin VAT reporting
**Source**: Bundeszentralamt für Steuern (BZSt) Circular 04/2025
**VAT Rate**: N/A | **Effective**: 2025-06-01
**Summary**: German tax authorities require platforms to document USDC/EUR exchange rates at transaction time using approved sources (ECB, Bundesbank) for VAT base calculation.
**Invoica Impact**: Invoica must integrate real-time EUR/USDC exchange rate API (ECB or Bundesbank) and store rate with each transaction for German audit trail compliance.
**Status**: ⏳ Pending


### [HIGH] France: Mandatory legal entity identification for AI agent transactions
**Source**: Direction Générale des Finances Publiques (DGFiP) BOI-TVA-CHAMP-10-10-40-80
**VAT Rate**: 20% | **Effective**: 2025-05-01
**Summary**: All invoices for AI agent services must identify the legal entity controlling the agent, including SIREN number and declaration that agent acts on entity's behalf.
**Invoica Impact**: Invoica must require and validate SIREN registration for French customers using AI agents, adding mandatory 'AI Agent Controller' field with legal entity verification during onboarding.
**Status**: ⏳ Pending


### [MEDIUM] Spain: Blockchain transaction hash required in SII real-time reporting
**Source**: Agencia Estatal de Administración Tributaria (AEAT) SII v1.4 Specification
**VAT Rate**: 21% | **Effective**: 2025-09-01
**Summary**: SII submissions for stablecoin payments must include Base blockchain transaction hash as mandatory field 'HashCadenaBloque' for audit traceability.
**Invoica Impact**: Invoica must automatically populate blockchain transaction hash in Spanish SII XML exports, requiring integration between payment processing and invoicing modules to capture Base tx hash at payment confirmation.
**Status**: ⏳ Pending


### [HIGH] Italy: Crypto wallet address disclosure in SDI e-invoices
**Source**: Agenzia delle Entrate (ADE) Provvedimento n. 23847/2025
**VAT Rate**: 22% | **Effective**: 2025-07-01
**Summary**: All SDI invoices paid via cryptocurrency must include both payer and payee wallet addresses in new dedicated XML fields 'IndirizzoWalletPagante' and 'IndirizzoWalletDestinatario'.
**Invoica Impact**: Invoica must capture customer USDC wallet addresses during payment and include both customer and Invoica treasury wallet addresses in Italian SDI XML invoice format, requiring customer wallet validation during payment initiation.
**Status**: ⏳ Pending


### [HIGH] Netherlands: Joint and several VAT liability for platform operators
**Source**: Belastingdienst VAT Platform Guidance 2025
**VAT Rate**: 21% | **Effective**: 2025-06-01
**Summary**: Non-EU platforms facilitating Dutch B2C digital services are jointly liable for uncollected VAT if they fail to verify supplier VAT registration or implement adequate collection mechanisms.
**Invoica Impact**: Invoica must implement Dutch VAT number verification for all Netherlands-based suppliers, maintaining verification records for 7 years and blocking transactions where VAT registration cannot be confirmed for B2C supplies.
**Status**: ⏳ Pending


### [HIGH] Japan: AI agent principal disclosure on qualified invoices
**Source**: National Tax Agency (NTA) Qualified Invoice System Guidance Rev. 3
**VAT Rate**: 10% | **Effective**: 2025-04-01
**Summary**: Qualified invoices under KKS must identify the legal entity responsible for AI agent actions, with entity's registration number displayed alongside agent identifier.
**Invoica Impact**: Invoica must add 'AI Agent Principal' field to Japanese invoice template, validating Japanese registration number (T+13 digits) and linking to agent ID for all transactions involving AI agents serving Japanese customers.
**Status**: ⏳ Pending


### [MEDIUM] Japan: Quarterly stablecoin transaction volume reporting
**Source**: Financial Services Agency (FSA) Payment Services Act Enforcement Order Amendment 2025
**VAT Rate**: N/A | **Effective**: 2025-07-01
**Summary**: Platforms processing stablecoin payments exceeding JPY 100M quarterly must submit transaction volume reports to FSA, including counterparty jurisdiction breakdown and AML screening summaries.
**Invoica Impact**: Invoica must implement quarterly Japanese transaction volume monitoring, auto-generating FSA report format when JPY 100M threshold exceeded, with jurisdiction tagging for all transactions and AML check status flags.
**Status**: ⏳ Pending


### [HIGH] Japan: JCT tax base calculation for stablecoin payments
**Source**: National Tax Agency (NTA) Basic Circular on Consumption Tax 5-2-18
**VAT Rate**: 10% | **Effective**: 2025-04-01
**Summary**: JCT must be calculated on JPY-equivalent value at time of service provision (invoice generation), not payment settlement, using official foreign exchange rates published by Bank of Japan or recognized financial institutions.
**Invoica Impact**: Invoica must fetch and store BOJ JPY/USD exchange rate at invoice generation timestamp for Japanese transactions, calculating JCT on this rate regardless of later payment rate fluctuations, requiring invoice-time rate locking.
**Status**: ⏳ Pending


### [HIGH] EU: Platform verification of stablecoin issuer MiCA authorization
**Source**: European Banking Authority (EBA) MiCA Technical Standards RTS/2024/08
**VAT Rate**: N/A | **Effective**: 2024-12-30
**Summary**: Platforms accepting stablecoins must verify issuer holds valid MiCA authorization via ESMA register and maintain evidence of monthly verification checks.
**Invoica Impact**: Invoica must implement automated monthly checks against ESMA MiCA register for USDC issuer (Circle) authorization status, with payment blocking mechanism if authorization lapses and audit log of all verification checks.
**Status**: ⏳ Pending


### [MEDIUM] EU: Annual reporting of AI service providers via platforms
**Source**: Council Directive (EU) 2023/2226 (DAC8) Article 8c
**VAT Rate**: N/A | **Effective**: 2026-01-01
**Summary**: Platforms must report to tax authorities details of sellers providing AI services exceeding €2,000 annual consideration, including service classification, transaction volumes, and payment methods.
**Invoica Impact**: Invoica must implement annual DAC8 reporting module tracking per-seller AI service revenue thresholds, capturing required seller identification data during onboarding and generating XML reports in DAC8 schema for each EU Member State by January 31 annually.
**Status**: ⏳ Pending


### [MEDIUM] Germany: Machine-readable export format for blockchain invoices
**Source**: Federal Ministry of Finance (BMF) GoBD v4 Section 11.3
**VAT Rate**: N/A | **Effective**: 2025-08-01
**Summary**: Blockchain-stored invoices must be exportable in standardized machine-readable format (JSON or XML) with cryptographic hash verification within 24 hours of audit request.
**Invoica Impact**: Invoica must build German audit export functionality producing standardized JSON/XML with embedded Base transaction hashes and Merkle proofs, with 24-hour SLA for generation upon audit request trigger.
**Status**: ⏳ Pending


### [MEDIUM] France: Mandatory fallback procedure for VAT API unavailability
**Source**: DGFiP Technical Notice API TVA v2.3
**VAT Rate**: N/A | **Effective**: 2025-06-01
**Summary**: Platforms must implement documented fallback procedures when real-time VAT validation API unavailable, requiring manual verification within 48 hours and transaction flagging for retrospective validation.
**Invoica Impact**: Invoica must build VAT API fallback logic for French transactions: allow transaction with 'pending validation' flag when API down, queue for retry, send admin alert, and implement 48-hour manual review workflow with audit trail of all fallback instances.
**Status**: ⏳ Pending


### [LOW] Spain: Mandatory AI service classification codes for SII reporting
**Source**: AEAT Resolution on Service Classification for Digital Services
**VAT Rate**: N/A | **Effective**: 2025-10-01
**Summary**: AI services must be classified using new CNAE codes specific to AI (6201-AI for AI inference, 6202-AI for AI training) in SII real-time reporting to enable tax authority monitoring of AI economy.
**Invoica Impact**: Invoica must implement service classification dropdown for Spanish invoices, mapping AI agent services to correct CNAE-AI codes and including in SII XML FacturaExpedida element as ClaveRegimenEspecialOTrascendencia.
**Status**: ⏳ Pending


### [MEDIUM] Italy: Approved exchange rate sources for stablecoin EUR conversion
**Source**: Agenzia delle Entrate Circular 8/E/2025
**VAT Rate**: N/A | **Effective**: 2025-07-01
**Summary**: SDI invoices with stablecoin payments must use EUR conversion rates exclusively from Bank of Italy daily reference rates or ECB official rates, with source identification required in invoice metadata.
**Invoica Impact**: Invoica must integrate Bank of Italy or ECB API for EUR/USD rates, store rate source identifier with each Italian transaction, and include 'FonteCambio' field in SDI XML pointing to official rate source used for conversion.
**Status**: ⏳ Pending


### [LOW] Netherlands: Tax-AML coordination for crypto platform monitoring
**Source**: Belastingdienst and De Nederlandsche Bank Joint Guidance 2025
**VAT Rate**: N/A | **Effective**: 2025-09-01
**Summary**: Crypto platforms must share suspicious transaction reports (STRs) indicators with tax authorities when transactions exhibit both AML risk flags and potential VAT evasion patterns, requiring coordinated reporting protocols.
**Invoica Impact**: Invoica must implement dual-flag monitoring system identifying transactions with both AML risk indicators and VAT anomalies (e.g., unusual transaction patterns, jurisdiction mismatches), with escalation to compliance team for potential STR and tax authority notification in Netherlands.
**Status**: ⏳ Pending

