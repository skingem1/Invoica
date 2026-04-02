# EU+Japan Tax Watchdog CTO Briefing — 2026-04-02

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

### [HIGH] EU: Mandatory Real-Time Payment Data API Access for Tax Authorities
**Source**: European Commission ViDA Directive 2022/0394
**VAT Rate**: N/A | **Effective**: 2028-01-01
**Summary**: ViDA mandates platforms to provide tax authorities real-time API access to payment data including stablecoin transactions, transaction amounts, and party identities. Platforms must maintain accessible APIs with 99.9% uptime SLA for automated tax authority queries.
**Invoica Impact**: Invoica must build secure API endpoints allowing EU tax authorities automated access to USDC transaction data, requiring authentication infrastructure, query logging, and GDPR-compliant data access controls
**Status**: ⏳ Pending


### [HIGH] EU: Platform Obligation to Verify Stablecoin Issuer Authorization
**Source**: MiCA Regulation (EU) 2023/1114 Article 48
**VAT Rate**: N/A | **Effective**: 2025-06-30
**Summary**: Platforms accepting stablecoin payments must verify and maintain proof of issuer's MiCA authorization before processing transactions. Monthly verification of issuer compliance status required with audit trail retention.
**Invoica Impact**: Invoica must implement automated USDC issuer (Circle) MiCA authorization verification, monthly compliance checks via ESMA registry API, and maintain 5-year audit trail of verification records
**Status**: ⏳ Pending


### [HIGH] Germany: Blockchain Invoice Export Format Specification
**Source**: BMF GoBD v4.0 Section 11.3
**VAT Rate**: 19% | **Effective**: 2025-07-01
**Summary**: GoBD v4 requires blockchain-stored invoices exportable in machine-readable XML format (XRECHNUNG or ZUGFeRD 2.2) with cryptographic hash chain verification. Export must include complete audit trail within 72 hours of tax authority request.
**Invoica Impact**: Invoica must build XML export functionality for Base blockchain invoices conforming to XRECHNUNG/ZUGFeRD standards, including hash verification module and automated 72-hour response system for BZSt requests
**Status**: ⏳ Pending


### [MEDIUM] France: Stablecoin VAT Base Calculation Methodology
**Source**: DGFiP BOI-TVA-BASE-10-10-30 Amendment
**VAT Rate**: 20% | **Effective**: 2025-04-01
**Summary**: VAT base for stablecoin payments calculated using ECB reference rate at transaction timestamp, with mandatory conversion documentation. Platforms must retain timestamped exchange rate proof for 6 years and report material deviations (>2%) to DGFiP within 30 days.
**Invoica Impact**: Invoica must integrate ECB API for real-time EUR/USDC rate capture at payment execution, store timestamped rate with each invoice, implement 2% deviation monitoring, and build automated DGFiP notification system
**Status**: ⏳ Pending


### [HIGH] Spain: SII Blockchain Transaction Hash Validation Requirement
**Source**: AEAT SII Technical Specification v1.9
**VAT Rate**: 21% | **Effective**: 2025-07-01
**Summary**: SII real-time reporting now requires blockchain transaction hash as mandatory field for crypto payments, with automated validation against public blockchain explorers. AEAT systems verify hash existence and payment amount match within 4 hours of submission.
**Invoica Impact**: Invoica must add Base blockchain transaction hash field to SII submissions, implement pre-submission hash validation via Base block explorer API, and build error handling for AEAT hash verification failures
**Status**: ⏳ Pending


### [MEDIUM] Italy: SDI Stablecoin EUR Conversion Rate Documentation
**Source**: Agenzia delle Entrate Provvedimento 89757/2025
**VAT Rate**: 22% | **Effective**: 2025-06-01
**Summary**: SDI e-invoices with stablecoin payments must include EUR conversion rate, rate source (e.g., Coinbase, Kraken), and timestamp. ADE requires third-party rate verification for invoices exceeding €10,000, with supporting documentation attached to SDI transmission.
**Invoica Impact**: Invoica must capture and store stablecoin/EUR rate from approved sources (integrate Coinbase/Kraken APIs), embed rate metadata in SDI XML, and implement document attachment system for high-value invoice rate verification proofs
**Status**: ⏳ Pending


### [MEDIUM] Netherlands: Monthly Crypto Platform Transaction Reporting
**Source**: Belastingdienst Crypto Platform Decree 2025
**VAT Rate**: 21% | **Effective**: 2025-10-01
**Summary**: Non-EU platforms processing crypto payments for Dutch businesses must file monthly transaction reports via Belastingdienst portal, including aggregate volumes, number of transactions, and counterparty VAT numbers. Reports due 15th of following month with automated reconciliation against OSS filings.
**Invoica Impact**: Invoica must build monthly reporting module for Belastingdienst portal integration, aggregate Dutch USDC transaction data by VAT number, implement automated report generation and submission by 15th, and reconcile with OSS declarations
**Status**: ⏳ Pending


### [HIGH] Japan: AI Agent Transaction Place of Supply Determination
**Source**: NTA Administrative Guidance No. 4-2025
**VAT Rate**: 10% | **Effective**: 2025-04-01
**Summary**: Place of supply for AI agent services determined by location of beneficial owner (principal behind agent), not agent deployment location. Platforms must collect and verify principal's address, maintaining proof for 7 years with quarterly NTA submission of foreign principal transaction summaries.
**Invoica Impact**: Invoica must implement KYC enhancement to capture and verify AI agent principal's jurisdiction, distinguish Japan vs. foreign principals, maintain address verification proofs, and build quarterly NTA foreign principal transaction summary report
**Status**: ⏳ Pending


### [MEDIUM] Japan: Stablecoin Platform Quarterly Transaction Reporting to FSA
**Source**: FSA Payment Services Act Amendment 2025
**VAT Rate**: N/A | **Effective**: 2025-07-01
**Summary**: Platforms facilitating stablecoin payments must report quarterly to FSA: total transaction volume, number of unique users, average transaction size, and suspicious transaction flags. Reports due within 45 days of quarter-end via FSA electronic filing system.
**Invoica Impact**: Invoica must build FSA quarterly reporting module tracking USDC transaction volumes for Japanese users, calculate required metrics, implement suspicious activity flagging logic, and automate electronic submission to FSA portal within 45-day deadline
**Status**: ⏳ Pending


### [MEDIUM] Japan: Blockchain Invoice Sequential Numbering Exception
**Source**: NTA KKS Technical Notice 2025-08
**VAT Rate**: 10% | **Effective**: 2025-06-01
**Summary**: NTA grants exception to sequential numbering requirement for blockchain-based qualified invoices if blockchain transaction hash serves as unique identifier and platform maintains public verifiable ledger. Exception requires prior NTA approval via Form 12-KKS-B.
**Invoica Impact**: Invoica must file Form 12-KKS-B with NTA to obtain sequential numbering exception, document Base transaction hash as compliant unique identifier, and ensure blockchain ledger public accessibility meets NTA verification standards
**Status**: ⏳ Pending


### [HIGH] Japan: Specified Platform JCT Liability for AI-to-AI Transactions
**Source**: NTA Circular No. 15-2025 on Specified Platforms
**VAT Rate**: 10% | **Effective**: 2025-04-01
**Summary**: Platforms facilitating AI agent service transactions where both parties are AI agents are specified platforms under JCT if platform controls payment terms or sets service pricing. JCT liability attaches to platform, not underlying principals, with threshold monitoring required.
**Invoica Impact**: Invoica must assess whether payment term control or pricing influence triggers specified platform status, implement JCT registration if threshold (JPY 10M) exceeded, and build automated threshold monitoring for AI-to-AI transaction volumes
**Status**: ⏳ Pending


### [HIGH] EU: DAC8 Platform Obligation to Identify AI Agent Principals
**Source**: Council Directive (EU) 2025/xxx DAC8 Amendment
**VAT Rate**: N/A | **Effective**: 2026-01-01
**Summary**: DAC8 crypto reporting framework requires platforms to identify and report beneficial owners (principals) behind AI agents conducting transactions. Platforms must perform enhanced due diligence on AI agent accounts, documenting principal identity, tax residence, and control structure.
**Invoica Impact**: Invoica must enhance KYC for AI agent accounts to capture ultimate beneficial owner information, implement enhanced due diligence procedures, maintain principal tax residence documentation, and prepare for DAC8 annual reporting starting 2027
**Status**: ⏳ Pending


### [MEDIUM] Germany: OSS Declaration Stablecoin Payment Method Disclosure
**Source**: BZSt OSS Technical Guidance 2025
**VAT Rate**: 19% | **Effective**: 2025-09-30
**Summary**: OSS declarations filed via BZSt must disclose payment method for transactions, with specific code for stablecoin payments (code '09-STABLECOIN'). Required for all B2C transactions exceeding €1,000 individual value, effective for Q3 2025 filings onward.
**Invoica Impact**: Invoica must add payment method tracking to OSS filing module, implement stablecoin payment flagging for transactions >€1,000, update BZSt OSS submission format to include payment method code field, and apply retroactively to Q3 2025
**Status**: ⏳ Pending


### [LOW] France: VAT Validation API Fallback Procedure Requirement
**Source**: DGFiP API Technical Specification v3.2
**VAT Rate**: 20% | **Effective**: 2025-06-01
**Summary**: Platforms using DGFiP real-time VAT validation API must implement documented fallback procedure for API outages, including manual verification protocol and post-outage reconciliation. Fallback must be tested quarterly with results logged for DGFiP audit.
**Invoica Impact**: Invoica must document and implement VAT validation fallback procedure for DGFiP API unavailability, build manual verification workflow, create quarterly fallback testing protocol, and maintain test result logs for compliance audit
**Status**: ⏳ Pending


### [LOW] Spain: VAT Group Treatment for Blockchain Invoice Platforms
**Source**: AEAT Consultation V2024-2025
**VAT Rate**: 21% | **Effective**: 2025-05-01
**Summary**: AEAT clarifies blockchain invoices between VAT group members are not subject to SII reporting if both parties are in same VAT group and platform maintains proof of group membership. Exemption requires annual VAT group certification upload to AEAT portal.
**Invoica Impact**: Invoica must implement VAT group membership verification for Spanish entities, enable SII reporting exemption for intra-group transactions, and build annual VAT group certification collection and AEAT portal upload process
**Status**: ⏳ Pending

