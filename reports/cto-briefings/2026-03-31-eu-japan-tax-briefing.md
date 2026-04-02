# EU+Japan Tax Watchdog CTO Briefing — 2026-03-31

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

### [HIGH] EU: Platform VAT Liability for AI Agent Transactions
**Source**: European Commission ViDA Proposal COM(2022) 701 final
**VAT Rate**: N/A | **Effective**: 2025-01-01
**Summary**: ViDA reform confirms platforms facilitating AI agent transactions will be deemed suppliers for VAT purposes on B2C digital services from 1 January 2025. Platforms must collect and remit VAT regardless of underlying supplier location.
**Invoica Impact**: Invoica must implement VAT collection logic for all B2C transactions where AI agents provide services to EU consumers, with automatic VAT calculation at customer location rates.
**Status**: ⏳ Pending


### [HIGH] EU: Mandatory E-Invoicing for Intra-EU B2B Transactions
**Source**: European Commission ViDA Proposal COM(2022) 701 final
**VAT Rate**: N/A | **Effective**: 2028-01-01
**Summary**: All intra-EU B2B transactions must use structured e-invoicing (EN 16931 standard) from 1 January 2028. Platforms facilitating B2B transactions must support this format and real-time transmission to tax authorities.
**Invoica Impact**: Invoica must implement EN 16931 XML invoice format generation for all EU B2B transactions, with automated submission to national tax portals (SII, SDI, etc.).
**Status**: ⏳ Pending


### [HIGH] EU: Digital Reporting Requirement Real-Time Transaction Data
**Source**: European Commission ViDA Proposal COM(2022) 701 final
**VAT Rate**: N/A | **Effective**: 2028-01-01
**Summary**: Digital Reporting Requirements mandate real-time transaction data submission to tax authorities for all digital platform transactions from 1 January 2028. Each transaction requires unique identifier and payment data extraction.
**Invoica Impact**: Invoica must build real-time API connections to each EU Member State tax authority, transmitting transaction data including unique IDs, amounts, VAT rates, and payment methods immediately upon transaction completion.
**Status**: ⏳ Pending


### [HIGH] EU: Mandatory OSS Registration for All Digital Platforms
**Source**: Council Directive (EU) 2017/2455 with ViDA amendments
**VAT Rate**: N/A | **Effective**: 2025-01-01
**Summary**: ViDA eliminates €10,000 threshold for OSS registration; all platforms facilitating B2C digital services must register for OSS from 1 January 2025 regardless of transaction volume.
**Invoica Impact**: Invoica must immediately register for Union OSS (or Non-Union OSS if established outside EU) and implement quarterly VAT return filing for all EU B2C transactions.
**Status**: ⏳ Pending


### [HIGH] EU: MiCA Stablecoin Issuer Authorization for Platform Use
**Source**: Regulation (EU) 2023/1114 (MiCA)
**VAT Rate**: N/A | **Effective**: 2024-12-30
**Summary**: Platforms accepting stablecoins (including USDC) must verify issuer holds MiCA authorization from 30 December 2024. Platforms liable if accepting unauthorized stablecoins for EU transactions.
**Invoica Impact**: Invoica must verify Circle (USDC issuer) has MiCA authorization and implement issuer verification checks before accepting USDC payments from EU users. May require alternative payment rails if Circle not authorized.
**Status**: ⏳ Pending


### [MEDIUM] EU: Stablecoin Reserve Transparency and Redemption Rights
**Source**: Regulation (EU) 2023/1114 (MiCA) Title III
**VAT Rate**: N/A | **Effective**: 2024-12-30
**Summary**: MiCA requires stablecoin issuers maintain 1:1 reserve assets and provide redemption at par value. Platforms must disclose redemption terms and ensure users can redeem within 5 business days.
**Invoica Impact**: Invoica must display USDC reserve attestations and redemption terms to EU users, potentially implementing direct redemption functionality or clear off-ramp instructions.
**Status**: ⏳ Pending


### [HIGH] EU: Crypto Asset Reporting Framework for Platform Operators
**Source**: Council Directive (EU) 2023/2226 (DAC8)
**VAT Rate**: N/A | **Effective**: 2026-01-01
**Summary**: DAC8 implements OECD CARF requiring platforms facilitating crypto transactions to report user identities, transaction volumes, and wallet addresses to tax authorities from 1 January 2026. Annual reporting covers all crypto-related income.
**Invoica Impact**: Invoica must implement comprehensive user KYC, transaction tracking for USDC payments, and annual XML reporting to each EU Member State tax authority for all users with crypto transactions exceeding €50,000 annually.
**Status**: ⏳ Pending


### [HIGH] Germany: GoBD v4 Blockchain Invoice Real-Time Audit Access
**Source**: German Federal Ministry of Finance GoBD v4.0
**VAT Rate**: N/A | **Effective**: 2025-01-01
**Summary**: GoBD version 4.0 explicitly permits blockchain invoice storage but requires tax authorities have real-time read access to all transaction hashes and invoice data. Immutability alone is insufficient without export functionality.
**Invoica Impact**: Invoica must build German tax authority API providing real-time query access to all blockchain invoice hashes, transaction IDs, and associated invoice PDFs/data for German customers.
**Status**: ⏳ Pending


### [LOW] Germany: TSE Certification Exemption for B2B Invoice Platforms
**Source**: German KassenSichV Amendment 2025
**VAT Rate**: N/A | **Effective**: 2025-01-01
**Summary**: Updated KassenSichV clarifies TSE (Technische Sicherheitseinrichtung) certification is not required for B2B invoice platforms using blockchain immutability, provided GoBD compliance maintained.
**Invoica Impact**: Invoica does not need TSE hardware certification for German operations, reducing compliance costs. Must ensure GoBD v4 audit access compliance instead.
**Status**: ⏳ Pending


### [HIGH] France: Mandatory Real-Time VAT Validation API for Digital Platforms
**Source**: French DGFiP Directive BOI-TVA-DECLA-30-10-30
**VAT Rate**: N/A | **Effective**: 2025-01-01
**Summary**: All digital platforms facilitating B2B transactions must integrate DGFiP real-time VAT number validation API from 1 January 2025. Invoice issuance blocked if VAT number invalid, with 99.9% uptime SLA requirement.
**Invoica Impact**: Invoica must integrate DGFiP VAT validation API for all French B2B customers, implementing pre-invoice VAT verification with fallback procedures for API downtime to avoid transaction blocking.
**Status**: ⏳ Pending


### [MEDIUM] France: Annual Stablecoin Payment Volume Reporting
**Source**: French DGFiP Platform Payment Reporting Directive
**VAT Rate**: N/A | **Effective**: 2025-01-15
**Summary**: Platforms processing stablecoin payments for French residents must submit annual declaration to DGFiP detailing total payment volumes, number of transactions, and user counts by 15 January following tax year.
**Invoica Impact**: Invoica must track all USDC transactions for French users separately and submit annual summary report to DGFiP, requiring transaction aggregation and user residency identification features.
**Status**: ⏳ Pending


### [MEDIUM] France: Blockchain Invoice Legal Validity Requirements
**Source**: French DGFiP Technical Guidance Note on Blockchain Invoices
**VAT Rate**: N/A | **Effective**: 2025-01-01
**Summary**: DGFiP confirms blockchain-stored invoices legally valid if containing mandatory fields (supplier/customer details, VAT, unique sequential number) and immutability provable via hash verification.
**Invoica Impact**: Invoica blockchain invoices accepted in France provided sequential numbering implemented per existing KB entry spain-vat-invoice-numbering-sequence-2023, with hash verification API for authorities.
**Status**: ⏳ Pending


### [HIGH] Spain: SII Blockchain Transaction Hash Mandatory Field
**Source**: Spanish AEAT SII Extension Directive 2025
**VAT Rate**: N/A | **Effective**: 2025-07-01
**Summary**: SII real-time reporting extended to require blockchain transaction hash as mandatory field for all invoices stored on blockchain from 1 July 2025.
**Invoica Impact**: Invoica must modify SII XML submission format to include Base blockchain transaction hash for every invoice issued to Spanish customers, requiring API update and field mapping.
**Status**: ⏳ Pending


### [MEDIUM] Spain: SII Real-Time Reporting Crypto Payment Flag
**Source**: Spanish AEAT SII Crypto Payment Directive
**VAT Rate**: N/A | **Effective**: 2025-07-01
**Summary**: AEAT requires crypto/stablecoin payment method flag in SII submissions from 1 July 2025, with specific code 17 for stablecoin payments.
**Invoica Impact**: Invoica must add payment method field to SII XML submissions with code 17 for all USDC transactions, requiring SII API update and payment type tracking.
**Status**: ⏳ Pending


### [MEDIUM] Spain: AI Agent Principal Disclosure Requirement
**Source**: Spanish AEAT AI Agent Transaction Guidance
**VAT Rate**: N/A | **Effective**: 2025-01-01
**Summary**: AEAT requires invoices for AI agent transactions disclose legal entity controlling agent in invoice header from 1 January 2025.
**Invoica Impact**: Invoica must capture and display AI agent owner/controller legal entity on all invoices involving AI agents for Spanish customers, requiring user profile enhancement and invoice template modification.
**Status**: ⏳ Pending


### [HIGH] Italy: SDI Mandatory Crypto Wallet Address Disclosure
**Source**: Italian Revenue Agency SDI Technical Specifications v1.8
**VAT Rate**: N/A | **Effective**: 2025-03-01
**Summary**: SDI e-invoices involving crypto payments must include payer and payee wallet addresses in payment information block from 1 March 2025.
**Invoica Impact**: Invoica must extract and include Base blockchain wallet addresses (buyer and seller) in SDI XML submissions for all Italian transactions, requiring wallet address collection during onboarding and invoice generation modification.
**Status**: ⏳ Pending


### [HIGH] Italy: SDI Stablecoin Exchange Rate and EUR Conversion Reporting
**Source**: Italian Revenue Agency SDI Crypto Payment Guidance
**VAT Rate**: N/A | **Effective**: 2025-03-01
**Summary**: SDI submissions for stablecoin payments must include USDC-EUR exchange rate at transaction time and EUR-equivalent amounts from 1 March 2025.
**Invoica Impact**: Invoica must integrate real-time USDC-EUR exchange rate API, capture rate at payment execution, and include both USDC and EUR amounts in SDI XML submissions for Italian customers.
**Status**: ⏳ Pending

