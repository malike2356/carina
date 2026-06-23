# 153 - Blog Content Carina Ingestion

**Source:** Xelox Properties blog post library (`xeloxproperties/blogPosts/`)
**Ingestion date:** 2026-05-21
**Total files ingested:** 274 markdown files

---

## What Was Ingested

### Category Breakdown

| Category | File Count | Source Directory | Masterbrain Destination |
|---|---|---|---|
| Calculation explainers | 174 | `Calculations/` (001.md to 173.md) | `calculators/articles/` |
| Getting started / introductory | 9 | `introductory/` (post-01 to post-09) | `getting_started/` |
| Deal sourcing | 9 | `yearScale/` (files 02-10) | `deal_sourcing/articles/` |
| Buy-to-let strategy | 10 | `yearScale/` (files 11-20) | `property_strategies/btl/` |
| Rent-to-rent strategy | 8 | `yearScale/` (files 21-28) | `property_strategies/r2r/` |
| Serviced accommodation | 10 | `yearScale/` (files 29-38) | `property_strategies/sa/` |
| Commercial property | 8 | `yearScale/` (files 39-46) | `property_strategies/commercial/` |
| Investor mindset and strategy | 10 | `yearScale/` (files 47-56) | `business_and_mindset/articles/` |
| Regional location guides | 9 | `yearScale/` (files 57-65) | `market_research/regional/` |
| Compliance and legal | 8 | `yearScale/` (files 66-73) | `compliance_and_regulation/articles/` |
| Finance and lending | 7 | `yearScale/` (files 74-80) | `finance_and_funding/articles/` |
| Portfolio, tax, and additional topics | 12 | `yearScale/` (files 81-92) | `portfolio_and_tax/articles/` |

**Total: 274 files**

Note: `yearScale/00-content-plan.md` is a content planning document, not a blog post, and was not ingested.

---

## Where Each Category Landed

### calculators/articles/ (174 files)
Full library of property investment calculation explainers numbered 001 to 173. Covers yield metrics (gross, net, net initial, reversionary, equivalent, running, true, NOI), return metrics (ROI, cash-on-cash, ROE, total return, annualised return, equity multiple), income and cost metrics (NOI, EGI, before-tax cash flow, monthly cashflow, void allowance), mortgage maths (repayment, interest-only, total cost), SDLT calculations, BTL stress tests, HMO calculations, R2R deal analysis, SA occupancy and ADR, development metrics (profit on cost, GDV, IRR, NPV), bridging loan costs, refinance calculations, BRR return metrics, and commercial property yields.

Each file explains one metric: the formula, worked examples with real numbers, and how to interpret the result.

### getting_started/ (9 files)
Introductory articles covering the fundamentals of UK property investment for new investors. Topics include what property sourcing is, why Portsmouth is underrated, BTL vs R2R comparison, finding BMV properties in Hampshire, AML compliance basics, common first-time investor mistakes, sourcing fees explained, Isle of Wight opportunities, and how to analyse an R2R deal quickly.

### deal_sourcing/articles/ (9 files)
In-depth articles on finding and sourcing deals. Covers how sourcing agents find off-market deals, BMV properties explained, sourcing fee structures, remote sourcing, managing multiple agents, sourcing agreement red flags, JV vs sourcing fee models, building agent relationships, and when to use a sourcing agent.

### property_strategies/btl/ (10 files)
Buy-to-let strategy articles. Covers BTL mortgage products, 2026 tax changes for landlords, portfolio landlord strategy, HMOs vs single lets, BTL yields on the South Coast, financing a first BTL, exit strategies, Section 24 and incorporation, limited company BTL, and refurbishment budgeting.

### property_strategies/r2r/ (8 files)
Rent-to-rent strategy articles. Covers R2R fundamentals, deal analysis, head lease negotiation, building landlord relationships, HMO licensing in R2R context, cash flow management, scaling an R2R portfolio, and legal agreement structures.

### property_strategies/sa/ (10 files)
Serviced accommodation strategy articles. Covers SA vs BTL comparison, Airbnb guest experience, dynamic pricing, SA regulations and licensing, property selection criteria, managing remote SA properties, furnishing and staging, review management, seasonal demand planning, and scaling an SA portfolio.

### property_strategies/commercial/ (8 files)
Commercial property investment articles for investors new to the asset class. Covers commercial property basics, commercial lease types, finding commercial deals, commercial valuation methods, mixed-use investment, commercial-to-residential conversion, commercial financing, and commercial property management.

### business_and_mindset/articles/ (10 files)
Investor mindset, strategy, and planning articles. Covers building an investment strategy, risk management, portfolio diversification, long-term vs short-term approaches, capital efficiency, avoiding imitation of others' strategies, building a property team, networking, setting goals and KPIs, and learning from mistakes.

### market_research/regional/ (9 files)
Location and market intelligence guides for South Coast UK markets. Covers Portsmouth, Southampton, Isle of Wight, Bournemouth, Hampshire overview, Waterlooville, Fareham and Gosport, Chichester, and Southampton Waterside. Each file contains market analysis, current yields, investment opportunities, and area-specific advice for 2026.

### compliance_and_regulation/articles/ (8 files)
UK landlord compliance articles. Covers AML requirements for property investors, HMO licensing, EPC requirements, gas and electrical safety compliance, Right to Rent checks, tenancy deposit schemes, property tax planning, and data protection obligations for landlords.

### finance_and_funding/articles/ (7 files)
Property finance articles. Covers bridging loans, development finance, refinancing strategies, raising private capital, investor mortgage guide, using pensions for property investment, and a property investment finance checklist.

### portfolio_and_tax/articles/ (12 files)
Portfolio management, tax, and additional specialist topics. Covers property auctions, leasehold vs freehold, stamp duty for investors in 2026, new build vs period property comparison, a step-by-step beginners guide to property investment, student property investment, holiday let investment, essential resources (books and podcasts), property market cycles, limited company vs sole trader structures, commercial permitted development rights, and rent guarantee insurance.

---

## How Carina Should Use Each Category

### Calculation explainers (calculators/articles/)
Use when answering questions about investment metrics, return calculations, or when a user asks Carina to explain a number from a deal analysis. These files contain the formulas, definitions, and worked examples behind every metric in the Propreneur calculator suite. When a user asks "what does NOI yield mean" or "how is cash-on-cash return calculated", retrieve from this category. Also use when generating calculator narratives in DealAnalysis.

### Getting started (getting_started/)
Use when onboarding new users or when Carina detects a user is unfamiliar with property investment basics. Covers foundational topics that connect to multiple modules: sourcing, R2R, BTL, AML compliance, and area research. Useful for first-session context building.

### Deal sourcing (deal_sourcing/articles/)
Use when users ask about finding deals, working with sourcing agents, off-market strategies, or BMV acquisition. Reinforces the Deal Engine module's sourcing criteria and area research tools. Cross-reference with `deal_sourcing/` existing knowledge when answering sourcing workflow questions.

### Buy-to-let strategy (property_strategies/btl/)
Use when users are analysing BTL deals, asking about mortgage structures, tax treatment, or portfolio strategy. The BTL calculator outputs in the Deal Engine module should be supplemented with these strategy articles when Carina explains results or recommends next steps.

### Rent-to-rent strategy (property_strategies/r2r/)
Use when users are working on R2R deals or when the R2R calculator is in use. The head lease negotiation and legal agreement content supports the compliance module. Cash flow management content supports accounting module responses.

### Serviced accommodation (property_strategies/sa/)
Use when the SA calculator is in use or when users ask about short-let strategy. Dynamic pricing and seasonal demand articles support Carina's SA deal narrative generation. Regulations content connects to the compliance module.

### Commercial property (property_strategies/commercial/)
Use when users are evaluating commercial deals or asking about commercial-to-residential conversion. The commercial valuation article explains the metrics used by the commercial calculator. Cross-reference with compliance for lease and planning content.

### Investor mindset and strategy (business_and_mindset/articles/)
Use when users ask strategy-level questions: whether to diversify, how to build a team, how to set goals. These are not deal-specific answers but portfolio-level guidance. Useful when Carina is in mentoring or coaching mode.

### Regional location guides (market_research/regional/)
Use when users mention or search for specific South Coast locations: Portsmouth, Southampton, Isle of Wight, Bournemouth, Hampshire, Waterlooville, Fareham, Gosport, Chichester. These guides provide area-specific yield benchmarks, market context, and investment angles that Carina can use to contextualise deal analysis outputs or answer area due diligence questions.

### Compliance and regulation (compliance_and_regulation/articles/)
Use when users ask compliance questions: HMO licensing, AML, safety certificates, deposit schemes, Right to Rent, data protection. These articles support the Propreneur compliance module and provide the background knowledge Carina needs to answer regulatory questions accurately. Always recommend professional legal advice on specific situations.

### Finance and lending (finance_and_funding/articles/)
Use when users ask about funding deals, refinancing, raising private finance, or using bridging loans. The bridging loan and development finance articles connect to the Deal Engine's bridging and development calculators. The private capital article supports investor relations use cases.

### Portfolio and tax (portfolio_and_tax/articles/)
Use when users ask about property structure decisions (limited company vs sole trader, leasehold vs freehold), auction purchases, stamp duty calculations, or specialist strategies (holiday lets, student property). The limited company and SDLT articles are frequently relevant to deal analysis outputs. Property market cycles article supports portfolio timing questions.

---

## Folder Index Files

Each new subdirectory contains a `_folder_index.txt` listing every filename and its H1 title. These index files are maintained alongside the content and can be used to quickly locate articles by topic without reading every file.

---

## Notes on Content Style

All 274 articles follow the Xelox Properties style guide:
- British English spelling throughout
- No emojis
- Direct, professional tone with no filler
- Practical examples using real numbers
- Focus on Portsmouth, Hampshire, Isle of Wight, and South Coast UK markets
- Sections marked with H2 headers
- Soft call to action at article end

This style is consistent with Propreneur's communication standards and Carina's output guidelines.
