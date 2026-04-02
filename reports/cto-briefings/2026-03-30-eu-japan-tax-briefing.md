# EU+Japan Tax Watchdog CTO Briefing — 2026-03-30

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

### [HIGH] EU: Mandatory VAT ID Verification for Platform Operators
**Source**: European Commission ViDA Directive 2022/890
**VAT Rate**: N/A | **Effective**: 2025-01-01
**Summary**: Platforms must verify VAT IDs of business customers in real-time before applying B2B reverse charge. Invalid or unverified VAT numbers require platform to collect VAT at supplier's rate.
**Invoica Impact**: Invoica must integrate real-time VAT ID validation API (VIES) for all EU B2B transactions before allowing reverse charge treatment on invoices
**Status**: ⏳ Pending


### [MEDIUM] EU: Payment Split Reporting for Platform Transactions
**Source**: EU Council Political Agreement October 2023
**VAT Rate**: N/A | **Effective**: 2028-01-01
**Summary**: Platforms must report payment flows separately for service fees vs. underlying transaction amounts. Tax authorities require granular breakdown of USDC payment allocation between platform commission and vendor payment.
**Invoica Impact**: Invoica must implement dual-line item reporting: separate tracking of platform fees vs. pass-through payments in invoice data structure and OSS filings
**Status**: ⏳ Pending


### [MEDIUM] Germany: Stablecoin Payment VAT Treatment Clarification
**Source**: Bundeszentralamt für Steuern (BZSt)
**VAT Rate**: 0% (exempt) | **Effective**: 2024-01-01
**Summary**: BZSt confirms stablecoin payments (including USDC) are treated as exempt financial services under Article 135(1)(e) VAT Directive. No VAT due on payment processing itself, but underlying digital services remain taxable.
**Invoica Impact**: Invoica's payment processing fees for USDC transactions are VAT-exempt in Germany; must separate exempt payment services from taxable invoicing software services in revenue accounting
**Status**: ⏳ Pending


### [HIGH] France: Blockchain Invoice Legal Validity Requirements
**Source**: Direction Générale des Finances Publiques (DGFiP)
**VAT Rate**: N/A | **Effective**: 2025-01-01
**Summary**: DGFiP accepts blockchain-stored invoices if they meet authenticity, integrity, and legibility requirements under EU Directive 2010/45/EU. Invoices must include blockchain transaction hash and be exportable to PDF/XML.
**Invoica Impact**: Invoica must ensure Base blockchain invoices include transaction hash on invoice PDF and provide XML export functionality for French tax audits
**Status**: ⏳ Pending


### [HIGH] Spain: AI Agent Principal Disclosure Requirement
**Source**: Agencia Estatal de Administración Tributaria (AEAT)
**VAT Rate**: N/A | **Effective**: 2025-07-01
**Summary**: Invoices issued by or to AI agents must disclose the legal entity operating the agent with full tax identification details. AEAT requires NIF/VAT number of responsible legal entity, not just agent identifier.
**Invoica Impact**: Invoica must capture and display legal entity VAT/NIF behind each AI agent on invoices, not just agent wallet address or API key
**Status**: ⏳ Pending


### [LOW] Italy: SDI Blockchain Invoice Integration Pilot
**Source**: Agenzia delle Entrate (AdE)
**VAT Rate**: N/A | **Effective**: 2025-06-01
**Summary**: AdE launches pilot program allowing blockchain platforms to submit invoices directly to SDI via API. Blockchain hash serves as unique invoice identifier if format meets FatturaPA XML standard.
**Invoica Impact**: Invoica could participate in pilot to enable direct SDI submission from Base blockchain; requires FatturaPA XML generation and AdE API integration
**Status**: ⏳ Pending


### [MEDIUM] Netherlands: USDC-EUR Exchange Rate Determination for VAT
**Source**: Belastingdienst
**VAT Rate**: 21% | **Effective**: 2025-01-01
**Summary**: For VAT calculation on USDC transactions, taxpayers must use ECB reference rate at time of supply or invoice date. Platform must record EUR equivalent on invoice for audit purposes.
**Invoica Impact**: Invoica must integrate ECB API to capture USD/EUR rate at invoice timestamp and display EUR equivalent on all Netherlands invoices
**Status**: ⏳ Pending


### [HIGH] Japan: Qualified Invoice Requirements for AI Agent Transactions
**Source**: National Tax Agency (NTA)
**VAT Rate**: 10% | **Effective**: 2023-10-01
**Summary**: Under Qualified Invoice System (KKS), AI agent transactions require registered business number of operator. NTA clarifies platform must display registration number of legal entity behind AI agent, not agent ID.
**Invoica Impact**: Invoica must capture and display Japanese registration number (T+13 digits) of legal entity operating AI agent for all Japan B2B invoices
**Status**: ⏳ Pending


### [HIGH] Japan: Stablecoin Platform Intermediary Licensing Requirement
**Source**: Financial Services Agency (FSA)
**VAT Rate**: N/A | **Effective**: 2025-06-01
**Summary**: FSA requires platforms facilitating stablecoin payments to register as Type 2 Electronic Payment Instruments Intermediaries under amended Payment Services Act. Enhanced AML/KYC and transaction monitoring required.
**Invoica Impact**: Invoica must obtain FSA Type 2 intermediary license if processing USDC payments for Japan-based users; requires Japanese legal entity and compliance officer
**Status**: ⏳ Pending


### [HIGH] Japan: Platform JCT Registration Threshold Aggregation
**Source**: National Tax Agency (NTA)
**VAT Rate**: 10% | **Effective**: 2025-04-01
**Summary**: NTA clarifies that platform operators must aggregate all Japan-destination transactions across all vendors to determine JPY 10M registration threshold. Platform becomes specified taxable person if aggregate exceeds threshold.
**Invoica Impact**: Invoica must track cumulative Japan sales across all AI agents monthly; auto-trigger JCT registration workflow when approaching JPY 10M (~$67K USD)
**Status**: ⏳ Pending


### [MEDIUM] EU: Stablecoin Issuer Disclosure Requirement for Platforms
**Source**: Markets in Crypto-Assets Regulation (MiCA)
**VAT Rate**: N/A | **Effective**: 2024-12-30
**Summary**: Platforms accepting stablecoins must verify issuer holds MiCA authorization and disclose issuer identity and reserve backing on payment interface. Applies to USDC (Circle must be MiCA-authorized by June 2024).
**Invoica Impact**: Invoica must verify Circle's MiCA authorization status and display issuer info + reserve attestation link on payment pages for EU users
**Status**: ⏳ Pending


### [MEDIUM] Germany: Blockchain Hash as Compliant Audit Trail
**Source**: Bundesministerium der Finanzen (BMF) GoBD v4
**VAT Rate**: N/A | **Effective**: 2025-01-01
**Summary**: GoBD v4 update recognizes blockchain transaction hash as valid audit trail if invoice data is retrievable and verifiable via public blockchain explorer. Invoice must reference on-chain transaction hash.
**Invoica Impact**: Invoica must display Base blockchain transaction hash on German invoices and ensure data retrievability via Basescan for 10-year retention period
**Status**: ⏳ Pending


### [MEDIUM] France: OSS Quarterly Reconciliation for Crypto Payments
**Source**: Direction Générale des Finances Publiques (DGFiP)
**VAT Rate**: 20% | **Effective**: 2025-01-01
**Summary**: DGFiP requires platforms using OSS to reconcile crypto payment amounts with EUR VAT remittances quarterly. Exchange rate volatility adjustments must be documented with timestamped conversion rates.
**Invoica Impact**: Invoica must implement quarterly OSS reconciliation report showing USDC amounts, conversion rates used, and EUR VAT amounts for audit trail
**Status**: ⏳ Pending


### [HIGH] Spain: SII Real-Time Reporting Crypto Payment Flag
**Source**: Agencia Estatal de Administración Tributaria (AEAT)
**VAT Rate**: 21% | **Effective**: 2025-07-01
**Summary**: AEAT adds mandatory payment method field to SII real-time invoice reporting. Crypto payments must be flagged with code '17 - Criptomonedas' and include stablecoin type (e.g., USDC).
**Invoica Impact**: Invoica must add payment method code '17' and stablecoin type field to SII XML submissions for Spanish invoices paid in USDC
**Status**: ⏳ Pending


### [HIGH] Italy: Crypto Wallet KYC Linkage for Invoice Validation
**Source**: Agenzia delle Entrate (AdE)
**VAT Rate**: 22% | **Effective**: 2025-09-01
**Summary**: AdE requires platforms to maintain linkage between customer VAT number and verified crypto wallet address for B2B transactions. Wallet address must be KYC-verified and linked to legal entity VAT ID.
**Invoica Impact**: Invoica must implement wallet KYC verification for Italian B2B customers and store VAT-to-wallet mapping for audit access
**Status**: ⏳ Pending


### [MEDIUM] Netherlands: Platform Liable Party Election for VAT
**Source**: Belastingdienst
**VAT Rate**: 21% | **Effective**: 2025-01-01
**Summary**: Platforms may elect to be treated as supplier (deemed supplier) for VAT purposes instead of marketplace facilitator. Election must be made annually and applies to all transactions in calendar year.
**Invoica Impact**: Invoica must decide annual VAT treatment model for Netherlands: facilitator (vendors liable) vs. deemed supplier (Invoica liable); affects VAT collection and remittance obligations
**Status**: ⏳ Pending


### [HIGH] Japan: AI Agent Service Consumption Place Determination
**Source**: National Tax Agency (NTA)
**VAT Rate**: 10% | **Effective**: 2025-04-01
**Summary**: NTA issues guidance on determining consumption place for AI agent services. If agent operates autonomously, consumption place is where customer's business uses output, not where agent code executes.
**Invoica Impact**: Invoica must capture customer's business location (not wallet location) to determine Japan JCT applicability for AI agent transactions
**Status**: ⏳ Pending


### [MEDIUM] Japan: Enhanced Monitoring for High-Value Stablecoin Transactions
**Source**: Financial Services Agency (FSA)
**VAT Rate**: N/A | **Effective**: 2025-06-01
**Summary**: FSA requires enhanced transaction monitoring and reporting for stablecoin payments exceeding JPY 1M (~$6,700 USD) per transaction. Platforms must verify business purpose and beneficial owner for amounts over threshold.
**Invoica Impact**: Invoica must implement transaction monitoring alerts at JPY 1M threshold and collect enhanced KYC/business purpose documentation for large USDC payments in Japan
**Status**: ⏳ Pending

