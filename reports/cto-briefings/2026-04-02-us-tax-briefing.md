# US Tax Watchdog CTO Briefing — 2026-04-02

## Summary
US tax landscape for Invoica remains fragmented with high compliance complexity. The IRS has delayed digital asset broker reporting to January 2026, giving Invoica 8 months to implement Form 1099-DA systems for USDC transactions. No federal or state authority has issued specific guidance for AI agent autonomous commerce, leaving Invoica to apply general income tax principles. States continue exploring digital services taxes, but no new enactments affect Invoica's core invoicing business. Cryptocurrency property treatment creates state-by-state sales tax analysis requirements.

## Invoica Impact
Invoica faces three immediate technical compliance gaps: (1) No Form 1099-DA reporting infrastructure for USDC transactions required by January 1, 2026; (2) No systematic state-by-state sales tax determination engine for cryptocurrency payment settlements; (3) No legal framework documentation for how AI agent transactions are characterized under IRC Section 61 income rules. The regulatory grey area around AI agent commerce provides operational flexibility but creates audit risk if IRS or states retroactively assert facilitator liability.

## Compliance Gaps (Product Action Required)
1. No Form 1099-DA reporting system for USDC transactions (required by January 1, 2026)
2. No fair market value tracking and basis calculation for each USDC payment settlement
3. No state-by-state sales tax determination for cryptocurrency-settled transactions across 10 priority states
4. No documented tax position on AI agent transaction characterization (income, facilitator liability, agent legal status)
5. No monitoring system for state legislative activity on AI commerce taxation (CA, NY priority)
6. No gross proceeds tracking infrastructure for broker reporting requirements under IRC Section 6045
7. No user communication plan for 1099-DA tax form distribution before 2026 tax year

## Priority Actions for CTO
1. URGENT: Implement Form 1099-DA reporting system for USDC transactions by Q3 2026 (8-month runway before January 1, 2026 effective date) - requires engineering build for transaction tracking, FMV calculation, user TIN collection, and IRS filing integration
2. HIGH: Conduct state-by-state sales tax analysis for cryptocurrency settlements across CA, NY, TX, FL, WA, IL, MA, NJ, PA, CO - determine if transaction fees or underlying services trigger sales tax nexus and collection obligations
3. HIGH: Develop and document tax position on AI agent transaction characterization with external tax counsel - establish whether Invoica is facilitator, broker, or payment processor for IRS purposes and what records satisfy IRC Section 61 income reporting
4. MEDIUM: Establish legislative monitoring protocol for California and New York AI commerce taxation proposals - set up quarterly review process with tax counsel to assess proposed bills
5. MEDIUM: Assess Maryland Digital Advertising Tax applicability if Invoica expands into advertising or promotional services for AI agents - determine revenue threshold exposure
6. LOW: Monitor federal Digital Services Tax proposals in Congress - no immediate compliance action required but assess potential revenue impact if enacted at 2-5% of platform gross revenue

## New Regulatory Entries

### Federal: Digital Asset Broker Reporting Delayed to 2026 [HIGH]
**Source**: IRS
**Summary**: IRS delayed implementation of IRC Section 6045 broker reporting requirements for digital assets from January 1, 2023 to January 1, 2026. This requires platforms facilitating cryptocurrency transactions to issue Form 1099-DA reporting gross proceeds, with basis reporting requirements phasing in over subsequent years.
**Invoica Impact**: Invoica processes USDC payments and may be classified as a broker under these rules. Starting January 1, 2026, Invoica must implement systems to issue Form 1099-DA to users for all USDC transactions, tracking gross proceeds, fair market value at time of transaction, and potentially cost basis. This requires significant technical infrastructure for tax reporting before 2026.


### Federal: IRS 2023-2027 Strategic Plan - Emerging Technology Focus [MEDIUM]
**Source**: IRS
**Summary**: IRS Strategic Operating Plan (April 2023) signals increased focus on digital assets and emerging technologies including AI-driven commerce, though no specific AI transaction guidance has been issued. General income tax principles under IRC Section 61 apply to all AI agent transactions.
**Invoica Impact**: Invoica must treat all AI agent-to-agent transactions as taxable events under existing income tax rules despite lack of specific guidance. This creates regulatory uncertainty around whether Invoica has facilitator liability, how to characterize autonomous agent payments, and what records must be maintained. Invoica should monitor IRS guidance pipeline for AI-specific rules.


### Multistate: State-Level AI Agent Commerce Taxation - No Enacted Rules [MEDIUM]
**Source**: Multistate Tax Commission / State Tax Authorities
**Summary**: No US state has enacted specific taxation rules for AI agent autonomous transactions as of Q4 2025. California and New York are exploring digital economy frameworks that could encompass AI-driven commerce, but no bills have been enacted. States are monitoring AI transaction volumes before establishing nexus or taxation standards.
**Invoica Impact**: Invoica operates in regulatory grey area at state level for AI agent transactions. Without clear guidance, Invoica must apply existing economic nexus standards from Wayfair to determine state tax obligations. As AI transaction volumes grow, states may retroactively assert nexus or impose new taxes. Invoica should establish presence monitoring in CA and NY legislative pipelines.


### Federal: Federal Digital Services Tax Proposals - Not Enacted [LOW]
**Source**: US Congress
**Summary**: Multiple bills proposed in Congress (including Digital Economy Tax Fairness Act) aim to establish federal digital services tax on platform revenue, but none have been enacted as of Q4 2025. Proposals typically target platforms with significant revenue thresholds ($100M+ globally) from digital services.
**Invoica Impact**: If enacted, federal DST could tax Invoica's platform revenue from AI agent payment processing, potentially at 2-5% of gross revenue. Invoica should monitor congressional activity and assess revenue threshold exposure. Current non-enactment means no immediate compliance requirement, but potential future liability exists.


### Maryland: Maryland Digital Advertising Tax - Applicability Assessment [LOW]
**Source**: Maryland Comptroller
**Summary**: Maryland's Digital Advertising Services Tax (effective January 1, 2021) imposes 2.5%-10% tax on annual gross revenues from digital advertising for companies with $100M+ global revenue. Tax is assessed based on Maryland-attributed digital ad revenue.
**Invoica Impact**: Invoica's core business is invoicing/payment processing, not digital advertising. This tax likely does not apply unless Invoica generates advertising revenue. However, if Invoica implements any advertising or promotional services for AI agents within Maryland, revenue threshold and tax applicability must be assessed. Current impact: minimal unless business model expands.


### Multistate: State Treatment of Cryptocurrency Payments - Property Standard [HIGH]
**Source**: Multistate Tax Commission / State Tax Authorities
**Summary**: Most states follow federal IRS treatment of cryptocurrency as property under Notice 2014-21. This means USDC payments are treated as property exchanges, not currency, for state tax purposes. However, specific sales tax treatment varies: some states exempt property-to-property exchanges, while others assess sales tax on the underlying transaction value.
**Invoica Impact**: Invoica must determine state-by-state whether USDC payment settlement triggers sales tax obligations distinct from the underlying service being invoiced. In states that tax the exchange itself, Invoica may need to collect sales tax on transaction fees. This creates fragmented compliance requirements across 10 priority states (CA, NY, TX, FL, WA, IL, MA, NJ, PA, CO).

