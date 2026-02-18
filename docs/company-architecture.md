# Company Architecture — Autonomous AI Company

## Vision
An autonomous AI company that discovers business opportunities, assesses profitability,
builds products, and communicates publicly — all with minimal human intervention.

## Governance Model

### Human Owner (Final Authority)
- **Go/No-Go decisions** on new products and major strategy shifts
- CEO proposes strategy → Owner approves/rejects
- Budget allocation for new ventures
- Final say on public-facing company identity

### CEO Agent (Strategic Authority)
- Sets company vision, mission, and strategy
- Approves all agent proposals (CTO, CMO, BizDev)
- Creates and names products
- Manages all C-suite agents
- Reviews and approves communication plans
- Makes build-vs-buy decisions
- Names the company (with Owner approval)

### C-Suite Agents

#### CTO (Technology)
- Tech stack decisions and infrastructure
- Monitors ecosystem (OpenClaw, GitHub, strategic developers)
- Proposes technical improvements
- Post-sprint analysis and quality oversight

#### CMO (Marketing & Communications)
- Brand identity and guidelines
- Communication plan development
- X/Twitter strategy and content calendar
- Market intelligence and competitive analysis
- Manages X-Admin agent

#### CFO (Finance) — Future
- Cost tracking and optimization
- Revenue projections for new products
- Profitability assessment for opportunities
- Budget management

#### BizDev (Business Development)
- Market opportunity scanning
- Business case development (TAM/SAM/SOM)
- Competitive landscape analysis
- Profitability modeling
- Proposes new product ideas → CEO reviews → Owner Go/No-Go

### Operational Agents

#### X-Admin (Social Media)
- Autonomous X/Twitter posting under CMO instructions
- Content generation (text, images, memes, videos)
- Engagement management
- Uses best generation models for content
- Follows CMO communication plan strictly

#### Product Teams (Per Product)
- Each product gets its own agent team
- Invoica: Current 9-agent architecture (backend-core, frontend, etc.)
- Future products: CEO creates team structure based on BizDev proposal

## Decision Flow

### New Product Pipeline
1. **BizDev** scans market → identifies opportunity
2. **BizDev** builds business case (TAM, competition, profitability)
3. **CEO** reviews business case → approves/rejects
4. **Owner** receives CEO recommendation → Go/No-Go
5. If Go: **CEO** creates product team, allocates budget
6. **CTO** designs technical architecture
7. **Product team** builds autonomously via sprint pipeline

### Communication Pipeline
1. **CMO** develops communication plan
2. **CEO** reviews and approves plan
3. **CMO** creates content calendar
4. **X-Admin** executes posts autonomously
5. **CMO** reviews engagement metrics, adjusts strategy

### Tech Watch Pipeline
1. **CTO** monitors ecosystem daily (OpenClaw, GitHub, strategic devs)
2. **CTO** proposes improvements
3. **CEO** approves/rejects proposals
4. **Skills** implements approved changes

## Products
- **Invoica** (active) — x402 invoice middleware for AI agents
- Future products TBD via BizDev pipeline

## Confidentiality Rules
- Company public communications do NOT mention product names (Invoica)
- Public content focuses on: company structure, achievements, AI capabilities, team
- Product-specific marketing only after explicit Owner approval
