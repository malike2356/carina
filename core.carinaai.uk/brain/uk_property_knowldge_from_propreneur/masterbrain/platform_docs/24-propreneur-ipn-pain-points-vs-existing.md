# Bernadette Pain Points vs Propreneur: Build / Adapt / Skip

**Date:** 7 May 2026
**Context:** Analysis after IPN event -- what Bernadette's talk revealed vs what Propreneur already has.

---

## Current Propreneur Feature Map (v2)

| Module | Status | What it covers |
|---|---|---|
| Deal Engine | Shipped | 16 calculators: BTL, BRR, HMO, flip, bridging, SDLT, commercial, DSCR, NPV/IRR, income multiples, CoC/ROE, LTV, breakeven occupancy, R2R, SA, mortgage |
| CRM / Contacts | Shipped | Contact types: investor, sourcer, vendor, agent, mentee, other |
| Pipeline Kanban | Shipped | Pipeline cards, stages, drag-and-drop |
| Compliance | Shipped | Gas safety, EICR, EPC, fire alarm tracking, expiry warnings |
| Carina AI | Shipped | Multi-provider BYOK, RAG, streaming, assistant mode |
| Carina Agent | Shipped | 12 tools: calculator, contacts, deals, pipeline, properties, compliance, sessions, destructive tools |
| Property Portfolio | Shipped | Properties, tenancies, refurb catalogue (165 items) |
| Mentoring OS | Shipped | Dashboard, LMS, courses, quizzes, community |
| Multi-Property | Shipped | Unlimited properties (Operator plan+) |
| viCal Booking | Shipped | Calendar, scheduling, event types |
| Accounting | Shipped | Invoices, expenses |
| Integrations | Shipped | External connections |
| Reporting | Shipped | Reports, intelligence |

---

## Bernadette's 9 Pain Points -- Compared

### 1. Development Deal Calculator
**Pain:** Modelled GDV shortfall, interest rate decisions, build-cost phasing manually. Different lenders had wildly different terms.

**Propreneur today:** BTL/BRR/HMO calculators exist but **no development finance calculator** with drawdown schedules, interest accrual during build, GDV scenarios, or lender comparison.

**Advice: BUILD.** This is the single highest-impact addition. Unlocks developers as a new user segment. Development deals are larger -- users with development portfolios have higher willingness to pay. Can be built as a new CalculatorConfig + Calculator class following existing patterns (~2-3 days).

### 2. Contractor Management Module
**Pain:** Managed 10+ contractors across multiple sites. Used Excel for quotes, tracking, invoices. Had to fire contractors mid-project. Caught snagging issues by being on-site daily.

**Propreneur today:** CRM has contact types but **no contractor-specific fields** (trade, insurance, rating, quote management, snagging, site diary, budget vs actual tracking).

**Advice: BUILD (phased).** This is a major differentiator -- no property software does this well. But it's a large build. Suggest:
- Phase 1 (quick win): Add `trade`, `insurance_expiry`, `rating` fields to contacts. Add `contractor` contact type.
- Phase 2: Quote comparison (structured itemised quotes, side-by-side).
- Phase 3: Project budget vs actual, snagging/defect list, site diary.

### 3. Valuation Evidence Hub
**Pain:** Lender valued at £725k. She knew it was worth more. Had no direct comparable stored. Had to appeal manually.

**Propreneur today:** Properties have purchase price, current value fields. **No comparables document store** or valuation appeal workflow.

**Advice: BUILD (quick win).** Just a per-property document store with "valuation" tag. Allow uploading RedBook assessments, comparable evidence, lender valuation reports. Add valuation timeline (initial -> appeal -> final). Estimated effort: ~half day.

### 4. Cross-Collateralisation Warning
**Pain:** A development lender tried to take security across all her assets. She refused. One SPV per deal, no exceptions.

**Propreneur today:** Properties can be organised but **no SPV/company mapping** and **no cross-collateral warning** when financing a deal.

**Advice: BUILD (fits existing architecture).** Add a `company` / `spv` field to properties. Create an asset register view showing which lender has security over which assets. Before marking a deal as "financed", check: "This lender would have security over [N] other properties in this entity." Small effort, big trust builder.

### 5. Neighbour Engagement Tracker
**Pain:** Won planning by talking to neighbour first, adjusting plans. Neighbour could have appealed.

**Propreneur today:** **Nothing related.** No planning tracking or neighbour communication log.

**Advice: SKIP for now.** Niche -- only relevant to planning-heavy users. Low frequency of use. Can be added later as a "planning" extension when developer segment is established.

### 6. Multi-Project Developer Dashboard
**Pain:** Multiple projects at different stages simultaneously. "There's never a point where this phase is finished and I'm moving to the next one."

**Propreneur today:** Pipeline Kanban exists but **no time-in-phase tracking**, **no developer-specific pipeline stages** (Under Offer -> Planning -> Financing -> Build -> Let/Sell).

**Advice: ADAPT.** Extend the existing Pipeline module with a "Development" pipeline preset. Columns: Lead > Under Offer > Planning > Financing > Build Phase 1 > Build Phase 2 > Letting / Sold. Add time-in-phase flagging. Reuse existing Kanban code. Estimated: ~1 day.

### 7. Lender Relationship Log
**Pain:** Approached 4 lenders with different terms. Had to go over valuer's head to head of lending to appeal.

**Propreneur today:** **Nothing for lender tracking.**

**Advice: BUILD (small).** Per-deal lender register. Track which lenders contacted, terms offered (rate, fee, LTV), decision, notes. Links to existing deal/calculator data. Estimated: ~half day.

### 8. Compliance Dispatch / S21 Serving (Jeff's Pain)
**Pain:** Landlords need to serve How to Rent, gas safety, EPC, EICR. Most get it wrong. Need timestamped proof.

**Propreneur today:** Compliance tracks expiry but **no document serving workflow**. No N215-style declaration generation.

**Advice: BUILD (medium effort).** Generate property-specific email alias for serving documents. Auto-reply to landlord's real inbox. Generate timestamped N215 declaration. Store in compliance log. Ties directly into existing Compliance module. Estimated: ~2-3 days.

### 9. Health / Workload Carina Feature
**Pain:** Had a health crisis from overwork. "I had no time for myself. I was really ill."

**Propreneur today:** Carina can act but **has no awareness of user workload**.

**Advice: LOWEST PRIORITY.** Nice differentiator but not a revenue driver. Keep in backlog. Can be a single Carina tool call that checks today's activity volume and responds accordingly.

---

## Build Order Recommendation

| Priority | Feature | Effort | Why |
|---|---|---|---|
| 1 | **Development calculator** | Medium | Unlocks developer segment. Larger deals = higher willingness to pay. |
| 2 | **Lender log + cross-collateral warning** | Small | Fits existing loan/deal flow. Builds trust. Quick wins. |
| 3 | **Contractor management (Phase 1)** | Small | Just add `trade`/`contractor` contact type + rating fields. |
| 4 | **Developer pipeline preset** | Small | Reuse existing Kanban code. Different stage columns. |
| 5 | **Valuation evidence hub** | Small | Document store per property. Half day build. |
| 6 | **Compliance dispatch / S21** | Medium | Ties into existing Compliance. Direct landlord pain. |
| 7 | **Contractor management (Phase 2-3)** | Large | Quotes, snagging, site diary. Major differentiator. |
| 8 | **Neighbour engagement** | Small | Only for planning users. Defer. |
| 9 | **Carina workload health** | Small | Nice-to-have. Defer. |

---

## Quick Wins You Can Start Tomorrow

1. **Developer pipeline preset** -- New stage columns in existing pipeline. Just config + migration.
2. **Contractor contact type** -- Add `trade` enum to contacts, `contractor` to type array. Extend Carina's `CreateContactTool`.
3. **Valuation folder on property** -- Document upload with "valuation" tag. Use existing PropertyDocumentVaultService.
