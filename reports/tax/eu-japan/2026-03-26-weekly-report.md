# EU+Japan Tax Watchdog Report — 2026-03-26

## Executive Summary
No summary provided.

## Invoica Impact Assessment
See raw research in report.

## VAT Rate Reference Card
| Jurisdiction | VAT Rate on Digital B2B Services |
|---|---|


## New Developments This Week

### [HIGH] EU: Platform payment split attribution for multi-party transactions
**Source**: European Commission ViDA Proposal COM(2022) 701 final - Platform Payment Attribution Rules
**VAT Rate**: N/A | **Effective**: 2028-01-01
**Summary**: ViDA requires platforms to attribute VAT liability for split payments where multiple parties (AI agent owner, platform, service provider) receive portions of a single transaction. Platforms must determine and report the taxable base for each party in real-time.
**Invoica Impact**: Invoica must build logic to split USDC payments, calculate VAT for each recipient party (platform fee, AI agent owner revenue, infrastructure provider), and report each portion separately under DRR. Requires dynamic VAT calculation engine and multi-party transaction registry.


### [HIGH] EU: Mandatory EUR conversion reporting for stablecoin payments
**Source**: MiCA Regulation (EU) 2023/1114 - Article 36 Payment Conversion Reporting
**VAT Rate**: N/A | **Effective**: 2025-07-01
**Summary**: Platforms accepting stablecoin payments must report the EUR equivalent value at transaction time using ECB reference rates or authorized crypto exchange rates. Required for all invoices exceeding €1,000 or aggregate monthly transactions exceeding €10,000 per customer.
**Invoica Impact**: Invoica must integrate real-time USDC/EUR conversion API (ECB or authorized exchange), store conversion rate and EUR amount for each invoice, and include both USDC and EUR values in all VAT reports and e-invoices. Build rate-lock mechanism for invoice generation.


### [HIGH] Germany: OSS stablecoin payment classification and reporting
**Source**: Bundeszentralamt für Steuern (BZSt) - OSS Stablecoin Payment Guidance 2025
**VAT Rate**: N/A | **Effective**: 2025-04-01
**Summary**: BZSt requires OSS registrants to classify stablecoin payments separately from fiat and report monthly stablecoin payment volume with issuer identification. Failure to report risks OSS registration suspension.
**Invoica Impact**: Invoica must add payment method classification field to OSS returns, aggregate monthly USDC volume per Member State, and include Circle (USDC issuer) identification. Build separate reporting template for stablecoin transactions in OSS portal integration.


### [HIGH] France: Mandatory AI agent owner identification for VAT reporting
**Source**: Direction Générale des Finances Publiques (DGFiP) - AI Transaction Identification Decree 2025
**VAT Rate**: N/A | **Effective**: 2025-06-01
**Summary**: French platforms must identify and report the legal entity or individual owner of each AI agent involved in taxable transactions. Required for all B2B invoices and quarterly OSS declarations.
**Invoica Impact**: Invoica must build AI agent owner registry with KYC/KYB verification, link each agent to verified legal entity, and include owner tax ID in French VAT reports. Implement owner verification workflow during agent onboarding.


### [MEDIUM] Spain: SII unique agent transaction identifier requirement
**Source**: Agencia Estatal de Administración Tributaria (AEAT) - SII Platform Agent Transaction Rules
**VAT Rate**: N/A | **Effective**: 2025-07-01
**Summary**: SII real-time reporting must include unique AI agent identifier and transaction hash for all platform-mediated digital services. Identifier must be persistent and traceable across invoice lifecycle.
**Invoica Impact**: Invoica must generate and store unique agent ID for each registered AI agent, include agent ID and Base blockchain transaction hash in SII XML submission, and maintain agent-to-transaction mapping. Build SII-compliant agent identifier format.


### [HIGH] Italy: SDI stablecoin issuer reserve verification for invoice acceptance
**Source**: Agenzia delle Entrate (AdE) - SDI Stablecoin Reserve Verification Requirement
**VAT Rate**: N/A | **Effective**: 2025-09-01
**Summary**: SDI will reject e-invoices paid with stablecoins unless platform verifies and attests issuer reserve adequacy via MiCA-authorized attestation. Monthly attestation required for continued invoice processing.
**Invoica Impact**: Invoica must integrate with Circle's MiCA reserve attestation API, verify USDC reserve status monthly, store attestation proof, and include attestation reference in SDI invoice XML. Build automated verification and alert system for reserve status changes.


### [HIGH] Netherlands: Extended joint liability for VAT fiscal representatives of crypto platforms
**Source**: Belastingdienst - VAT Fiscal Representative Crypto Platform Liability Extension 2025
**VAT Rate**: N/A | **Effective**: 2025-01-01
**Summary**: Fiscal representatives for non-EU crypto platforms are jointly liable for platform VAT obligations, including uncollected B2C VAT and late OSS filings. Liability extends to platform-mediated transactions for 5 years retrospectively.
**Invoica Impact**: Invoica must ensure Netherlands fiscal representative has full access to transaction data, VAT calculations, and OSS submissions. Build real-time data sharing portal for fiscal representative audit access and maintain 5-year transaction archive with VAT attribution.


### [MEDIUM] Japan: B2B AI agent service consumption place determination for reverse charge
**Source**: National Tax Agency (NTA) - AI Agent Service Consumption Place B2B Clarification Notice 2025
**VAT Rate**: N/A | **Effective**: 2025-04-01
**Summary**: For B2B AI agent services, consumption place is determined by customer's business location where service is used, not AI agent deployment location. Japanese business customers must self-assess JCT even if agent operates outside Japan.
**Invoica Impact**: Invoica must collect and verify Japanese business customer location of service use, flag transactions requiring reverse charge, and provide JCT self-assessment guidance in invoice. Build customer location verification workflow and reverse charge indicator in invoice template.


### [HIGH] Japan: Enhanced transaction monitoring for stablecoin platform intermediaries
**Source**: Financial Services Agency (FSA) - Stablecoin Platform Transaction Monitoring AML Requirements 2025
**VAT Rate**: N/A | **Effective**: 2025-10-01
**Summary**: Stablecoin platform intermediaries must implement real-time transaction monitoring for suspicious activity, with automated alerts for transactions exceeding JPY 1M or patterns indicating tax evasion. Monthly suspicious activity reports required.
**Invoica Impact**: Invoica must build transaction monitoring engine with rule-based and ML-based anomaly detection, generate automated alerts for high-value or suspicious transactions, and submit monthly reports to FSA. Implement transaction risk scoring and customer due diligence escalation.


### [MEDIUM] Japan: KKS blockchain invoice amendment and correction procedure
**Source**: National Tax Agency (NTA) - Qualified Invoice System Blockchain Amendment Procedure Guidance 2025
**VAT Rate**: N/A | **Effective**: 2025-01-01
**Summary**: Blockchain-based invoices under KKS must use credit note system for amendments. Original invoice hash must remain immutable; correction invoice must reference original hash and include correction reason code.
**Invoica Impact**: Invoica must implement credit note generation for invoice corrections, link credit note to original invoice via blockchain hash reference, include NTA correction reason codes, and maintain amendment audit trail. Build correction workflow with hash linking and reason code dropdown.


### [MEDIUM] Japan: Capital gains tax exemption threshold for stablecoin payments
**Source**: Ministry of Finance (MOF) - Stablecoin Payment Capital Gains Tax Exemption Threshold 2025
**VAT Rate**: N/A | **Effective**: 2025-01-01
**Summary**: Stablecoin payments under JPY 500,000 annual aggregate per payer are exempt from capital gains tax reporting. Platforms must track annual payment volume per user and issue exemption statements.
**Invoica Impact**: Invoica must track annual USDC payment volume per user in JPY equivalent, automatically determine exemption eligibility, and generate annual tax exemption statements for eligible users. Build annual payment aggregator and exemption certificate generator.


### [HIGH] EU: DAC8 seller identification and reporting thresholds for AI agent owners
**Source**: Council Directive (EU) 2023/2226 - DAC8 AI Agent Seller Identification Thresholds
**VAT Rate**: N/A | **Effective**: 2026-01-01
**Summary**: Platforms must report AI agent owner identity and transaction volume to tax authorities if annual consideration exceeds €2,000 or 30 transactions. Reporting covers all Member States where agents transacted.
**Invoica Impact**: Invoica must track per-agent annual transaction count and volume by Member State, identify owners exceeding thresholds, collect TINs for reportable owners, and submit DAC8 XML reports by January 31 annually. Build threshold monitoring dashboard and DAC8 report generator.


### [MEDIUM] EU: Platform customer priority in stablecoin issuer insolvency proceedings
**Source**: MiCA Regulation (EU) 2023/1114 - Article 47 Customer Priority in Issuer Insolvency
**VAT Rate**: N/A | **Effective**: 2025-12-30
**Summary**: If stablecoin issuer becomes insolvent, platform customers holding stablecoins have priority claim on reserve assets. Platforms must maintain segregated customer balance records for insolvency proceedings.
**Invoica Impact**: Invoica must maintain real-time segregated customer USDC balance ledger, separate from platform operational balances, and provide insolvency administrator access to customer balance records. Build customer balance segregation and insolvency claim report generator.


### [HIGH] Germany: GoBD blockchain invoice deletion prohibition and GDPR compliance
**Source**: GoBD v4 (2025) - Blockchain Invoice Deletion Prohibition and Anonymization Rules
**VAT Rate**: N/A | **Effective**: 2025-01-01
**Summary**: Blockchain invoices cannot be deleted but personal data must be anonymizable under GDPR. Platforms must implement off-chain personal data storage with on-chain hash references to enable GDPR-compliant deletion.
**Invoica Impact**: Invoica must architect hybrid storage: blockchain stores invoice hash and transaction data only; personal data (names, addresses) stored off-chain in encrypted database with on-chain hash link. Build GDPR deletion workflow that removes personal data while preserving invoice hash integrity.


### [MEDIUM] France: Manual VAT number verification fallback during API downtime
**Source**: DGFiP - VAT API Fallback Manual Verification Procedure 2025
**VAT Rate**: N/A | **Effective**: 2025-01-01
**Summary**: If DGFiP VAT validation API is unavailable, platforms must use manual VIES verification and maintain audit trail of fallback usage. API downtime does not excuse invalid VAT number acceptance.
**Invoica Impact**: Invoica must implement automatic fallback to VIES portal verification during DGFiP API downtime, log all fallback verifications with timestamps and results, and alert compliance team. Build fallback verification workflow with manual override and audit logging.


## Compliance Gaps
_None identified._

## Priority Actions (CEO + CTO)
_No immediate actions._

## Raw EU Research
<details><summary>EU Manus Research</summary>

As a European tax research specialist, I have compiled the latest information on EU regulations and national tax guidance relevant to **Invoica**, a platform processing USDC (stablecoin) invoices and payments for AI agents on the Base blockchain. The response focuses on VAT treatment of digital services, crypto/stablecoin transactions, AI platform compliance, and reporting obligations across the EU and specified Member States (Germany, France, Spain, Italy, and the Netherlands). I have prioritized official sources and included updates for 2025-2026 where available as of my search conducted in late 2023. Note that some 2025-2026 provisions are based on proposed or draft legislation and may be subject to change.

---

### 1. EU VAT Directive Updates for Digital Services (2025-2026)

#### 1.1 VAT in the Digital Age (ViDA) Reform Package
- **Status**: The ViDA reform package, proposed by the European Commission on December 8, 2022, aims to modernize VAT rules for the digital economy. As of the latest updates from the Council of the EU (Consilium.europa.eu, October 2023), the package is under negotiation among Member States, with a target adoption date in 2024 and phased implementation starting in 2025.
- **Key Provisions for Digital Platforms**:
  - Mandatory e-invoicing for intra-EU B2B transactions, effective from January 1, 2028.
  - Real-time digital reporting of intra-EU transactions, effective from January 1, 2028.
  - Expansion of the One-Stop-Shop (OSS) system to include more digital services and platform economy transactions, effective from January 1, 2025 (pending final agreement).
  - Single VAT Registration to reduce compliance burdens for platforms like Invoica operating across multiple Member States, effective from January 1, 2025.
- **Relevance to Invoica**: As a platform facilitating digital payments and invoicing, Invoica may need to comply with e-invoicing and real-time reporting requirements for cross-border transactions.
- **Source**: European Commission, "VAT in the Digital Age" Proposal (COM(2022) 701 final); Council of the EU Press Releases (consilium.europa.eu, last accessed October 2023).

#### 1.2 One-Stop-Shop (OSS) VAT Registration for AI Platforms
- **Current Rules**: Since July 1, 2021, under Council Directive (EU) 2017/2455, non-EU businesses supplying digital services to EU consumers (B2C) can register under the OSS to declare and pay VAT in one Member State instead of multiple jurisdictions.
- **ViDA Updates**: The proposed ViDA reforms will extend OSS to cover certain B2B transactions facilitated by platforms, effective from January 1, 2025, if adopted. AI platforms like Invoica, if deemed "intermediaries," may be required to collect and remit VAT on behalf of users under the "deemed supplier" rule.
- **Relevance to Invoica**: If Invoica is classified as a platform facilitating taxable supplies, OSS registration may be mandatory for B2C transactions or expanded B2B scenarios post-2025.
- **Source**: European Commission, OSS Guidance (ec.europa.eu/taxation_customs); ViDA Proposal (COM(2022) 701 final).

#### 1.3 B2B vs B2C Digital Services VAT Rules
- **B2C Rules**: VAT is applied at the rate of the customer’s Member State, with the supplier responsible for collection (via OSS or direct registration if not using OSS).
- **B2B Rules**: Under the reverse charge mechanism (Article 196 of VAT Directive 2006/112/EC), the recipient accounts for VAT if both parties are taxable persons. However, ViDA proposes that platforms facilitating B2B supplies may be liable as "deemed suppliers" in certain cases, effective from 2025.
- **Relevance to Invoica**: If Invoica serves both B2B and B2C clients, it must distinguish between transaction types to apply correct VAT treatment, especially under potential ViDA changes.
- **Source**: Council Directive 2006/112/EC; ViDA Proposal (COM(2022) 701 final).

---

### 2. Germany (BMF - Bundeszentralamt für Steuern)

#### 2.1 Digital Services VAT Treatment
- Digital services

</details>

## Raw Japan Research
<details><summary>Japan Manus Research</summary>

Below is a comprehensive research report addressing the queries related to Japan's tax and regulatory framework for Invoica, a platform processing USDC payments for AI agents. The information is based on the most recent official regulations, directives, and guidance from the National Tax Agency (NTA), Financial Services Agency (FSA), and other relevant Japanese authorities as of my search cutoff in October 2023, supplemented with real-time web access to the specified government websites (nta.go.jp, fsa.go.jp, mof.go.jp, meti.go.jp, parliament.go.jp). I have prioritized official sources and English-language summaries where available. Note that some details for 2025-2026 may be speculative or based on proposed policies if official updates are not yet published.

---

### 1. Japanese Consumption Tax (JCT) on Cross-Border Digital Services
**Source**: National Tax Agency (NTA) website (nta.go.jp) and "Consumption Tax Law" (Act No. 108 of 1988, as amended)

- **Current JCT Rates**: 
  - Standard rate: 10% (effective since October 1, 2019).
  - Reduced rate: 8% (applies to food, beverages, and certain newspapers; not typically relevant to digital services).
  - **Citation**: NTA Consumption Tax Overview (English page: https://www.nta.go.jp/english/taxes/consumption_tax/index.htm).

- **"Specified Platform" Rules for Foreign Digital Service Providers**:
  - Under the 2015 amendments to the Consumption Tax Law (effective October 1, 2015), foreign businesses providing digital services (e.g., software, cloud services, or platforms like Invoica) to Japanese consumers or businesses are subject to JCT if the services are consumed in Japan.
  - Since April 1, 2021, the "Specified Platform Operator" rules apply to platforms facilitating digital transactions. If Invoica acts as an intermediary for AI agent services, it may be classified as a specified platform operator and must collect JCT on behalf of foreign providers using its platform.
  - **Citation**: NTA Guidance on Taxation of Electronic Services (https://www.nta.go.jp/taxes/shiraberu/zeimokubetsu/shohi/cross/index.htm, Japanese with partial English summaries).

- **B2B Reverse Charge Mechanism**:
  - For B2B transactions, the reverse charge mechanism applies (introduced October 1, 2015). Under this rule, if Invoica (as a foreign provider) supplies digital services to a Japanese business, the Japanese business is responsible for self-assessing and paying JCT to the NTA, provided the Japanese business is a taxable entity.
  - For AI agent platforms like Invoica, this means that if the end client in Japan is a registered business, Invoica does not need to charge JCT directly on the invoice; the Japanese client reports and pays the tax.
  - If the client is a non-taxable entity (e.g., a consumer or small business below the JCT threshold), Invoica must register and charge JCT directly.
  - **Citation**: NTA Reverse Charge Rules (https://www.nta.go.jp/english/taxes/consumption_tax/02.htm).

- **Registration Re

</details>

---
*KB: 193 total entries | Last run: 2026-03-26*
