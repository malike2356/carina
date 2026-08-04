# Propreneur v2 (Business Edition) - Business Journey Framework & Build Corrections

**Merged analysis:** DeepSeek Claw (2026-05-14) + Claude (2026-05-13)
**Purpose:** Canonical guide for menu organisation, module dependencies, UX decisions, and build priorities.

---

## Executive Summary

Propreneur v2 is a **property operating system**, not a feature assembly. The current sidebar is organised by engineering modules (CRM, Deals, Accounting, etc.) when it should be organised by **business milestones**. A beginner doesn't wake up thinking "I need a CRM" - they think "I want to buy my first property, what do I do?"

Both analyses converge on the same fundamental thesis and the same critical gaps. This document merges the strengths of both into a single actionable framework.

---

## The 10-Phase Chronological Journey

### Phase 0: Foundation & Strategy

**What actually happens:** The user decides what type of investor they are. BTL, HMO, BRR, R2R, SA, Flip, or Commercial. Each strategy has completely different numbers, risks, cash requirements, and team members. They set up their Ltd company, business bank, understand legal obligations (AML, KYC, data protection), and define target area and criteria.

**What Propreneur v2 has:** First-login **workspace wizard** (`/onboarding`) captures workspace name, **primary investment strategy** (BTL, HMO, BRR, and four other slugs aligned with sourcing), optional target postcodes, profile, and timezone; on launch it can seed a starter **sourcing criterion** and stores `workspace_primary_strategy` in tenant settings. The dashboard **Getting started** checklist nudges setup, contacts, deal analysis, acquisitions board, portfolio, and mail.

**Gap (narrowed):** There is still no multi-question **strategy quiz**, no Carina-led conversational onboarding, and no mandatory **first saved deal** step inside the wizard. Deep orientation and calculator defaults keyed off strategy are follow-ups.

**Specific fix still valuable:**
- Strategy quiz (5 questions: goal, budget, time, risk, experience) → recommends a path
- Extend checklist / wizard: explicit first deal save and calculator defaults from `workspace_primary_strategy`
- Carina should drive parts of this conversationally


### Phase 1: Learning & Mentorship

**What actually happens:** The user learns their chosen strategy through structured content, mentorship, and community. For many users this runs alongside Phases 0-3.

**What Propreneur v2 has:** Mentoring OS (full, shipped), LMS/Courses, Community modules. **This is the strongest feature set in the system** - ironically more complete than the core investment workflow.

**Key tension:** For a beginner, mentoring is learning (Phase 1). For a power user, it's an education business (Phase 10). The nav should show it as Phase 1 for beginners and let power users move it.

**Gap:** None from a features perspective. The gap is **positioning** - these features dominate the nav when a beginner just wants to buy their first deal.


### Phase 2: Deal Sourcing & Lead Generation

**What actually happens:** The user defines what they're looking for (price ceiling, area codes, property type, min yield, condition). Then they hunt: Rightmove/Zoopla daily, agent relationships, direct-to-vendor letters, auctions, deal sourcers, networking. They capture every lead that vaguely fits because 95% get binned.

**What Propreneur v2 has:** Deals > Sourcing (manual entry, URL import from portals, match inbox, sourcing criteria/profiles). CRM (contacts - agents, vendors, professionals). Speed-to-lead engine.

**Gaps:**
- No email/postal campaign tool for direct-to-vendor marketing
- Marketing funnel builder (landing pages, lead magnets, lead capture) does not exist as a module - only as a knowledge doc (100)
- Lead nurture campaigns not wired to Comms Engine (31)
- Lead qualification (three-bucket model from knowledge doc 72) needs a first-class UI surface


### Phase 3: Deal Analysis

**What actually happens:** For each captured deal the user runs the numbers against their strategy. Does the BTL yield hit 7%? Does the HMO cash-on-cash beat 15%? What's the BMV? Can you BRR and pull most money out? Estimate refurb cost, SDLT, legal fees, bridging costs, mortgage product. If it passes, it moves forward. If not, archived.

**What Propreneur v2 has:** Deal calculators (7 strategies), refurb catalogue, SDLT tool, bridging/mortgage estimates, sensitivity analysis, Carina narrative. **Strongest part of the system.**

**Critical gap - Deal analysis and Pipeline are disconnected silos.** When a deal passes analysis and the user decides to pursue it, there is **no automatic "promote this deal to pipeline" action.** The user has to go to a completely separate Kanban board and manually create a card. The deal they spent time analysing has no direct link to the pipeline card tracking the acquisition. These two modules think they are independent products when they are the same workflow.

**Specific fix needed:** A **"Promote to acquisition board" button** on a deal analysis - creates a pipeline card pre-populated with the deal reference, address, asking price, and strategy. Closes the biggest workflow gap with minimal build.

**Other gaps:**
- Refurb cost estimation exists but no project/timeline view
- Viewing checklist exists as a knowledge doc (85) but not as a mobile app
- Area due diligence flow is operational but not surfaced as a guided workflow


### Phase 4: Investor Matching & Funding

**What actually happens:** If the deal needs JV money, bridging, or investor equity, the user needs to know who in their network has capital, what they invest in, and whether they're KYC'd. They prepare a deal teaser, reach out, have calls, follow up, match the right investor to the right deal.

**What Propreneur v2 has:** Investor Hub (CRM filtered to type=investor), lead funnel, investor scoring (partial), investor pipeline board, power team, investor report, investor portal.

**Gaps:**
- **No deal-to-investor matching workflow.** A deal needs £120k JV capital at 12% return. Who in the investor CRM has that amount, invests in BTL in that geography, and is currently warm? The scoring module is partially built but the "match this deal to these investors" UX does not exist.
- **No investment pack generator.** In practice you produce a PDF with property address, photos, numbers, projected returns, exit strategy. Carina can narrate but there is no "generate investment pack" button.
- **CRM and Investor Hub are the same people split into two nav groups.** Investors are a contact type. Having separate CRM and Investor modules confuses the navigation.
- No JV agreement templates.


### Phase 5: Acquisition Execution

**What actually happens:** Offer made → accepted. Solicitors instructed on both sides. Mortgage/bridging broker instructed. Survey booked. The user manages a chain of professionals all needing documents and chasing. This stage takes 6-16 weeks of constant follow-up.

**What Propreneur v2 has:** Pipeline Kanban board (deal stage tracking). Power team contacts in Investor Hub. Compliance module (partial).

**Gaps:**
- **No document vault.** Exchange and completion generate a mountain of paper: title register, mortgage offer, survey report, buildings insurance, completion statement, SDLT return, TR1 form. None of this can be stored against the deal or property. This is **regulatory and operational necessity**, not optional.
- **Compliance is a flat list, not deal/property triggered.** AML checks, source of funds, legal pack review are tied to a specific deal. Right now compliance is a standalone module with no contextual link.
- No "Promote to portfolio" button when a deal completes on the pipeline board - the user has to manually add the property to the Portfolio module.


### Phase 6: Refurbishment & Projects

**What actually happens:** If the property needs work (essential for BRR, HMO conversion, below-market purchases), the user manages a building project. Scope of works, contractor quotes, scheduling trades, tracking spend against budget, snagging, sign-off. **Operationally the most complex stage and where most investors lose money through poor tracking.**

**What Propreneur v2 has:** Refurb calculator (estimates cost only).

**Critical gap:** **No project management module.** Without it, every BRR or HMO investor using the system manages their refurb in a spreadsheet or WhatsApp while using Propreneur for everything else. The system breaks down at the most expensive and risky stage of the business.

**Specific fix needed:** A project management view with:
- Timeline/Gantt for trades
- Contractor contacts and quotes (linked to CRM)
- Budget tracking vs actuals
- Snagging list with status tracking
- Photo upload per room/stage
- Completion sign-off


### Phase 7: Portfolio & Tenancy Operations

**What actually happens:** The property is tenanted. The user manages rent collection, arrears, maintenance requests, contractor call-outs, inventory checks, renewals, and compliance certificates (gas safety annual, EPC, EICR every 5 years, HMO licence). Continuous - generates the cashflow the user has been building towards.

**What Propreneur v2 has:** Properties module (portfolio hub). Tenancies (minimal). Compliance (flat checklist). Accounting (tracks rent income and expenses). Document vault (per-property only).

**Gaps:**
- **Tenancy management is skeletal.** Rent collection tracking, arrears workflow, maintenance request logging, contractor dispatch, certificate expiry alerts not fully built out.
- **Maintenance module does not exist.** Repair requests, contractor dispatch, service history, cost tracking. Noted in IPN feedback (knowledge doc 79).
- **No property inspection module.** Periodic inspections with photo capture, reports, scorecards.
- **No compliance auto-renewal alerts** with notification escalation for expiring certificates.
- **Document vault is per-property only** - should also be accessible cross-cutting from any module.
- The boundary between "investor OS" and "property management system" is unclear to users and there's nothing pointing them to tools that fill the gap.


### Phase 8: Financial Management

**What actually happens:** The user needs to know: what did I spend, what did I earn, what is my P&L per property, what is my portfolio yield, what does my accountant need at year-end? Reconcile bank statements against rent and expenses.

**What Propreneur v2 has:** Double-entry accounting (GL accounts, journal entries, journal lines), chart of accounts, P&L per property, trial balance, CSV exports, VAT treatment per line.

**Critical gap - the UX is built for accountants, not investors.** The accounting is technically correct (double-entry, proper journal entries) but **no beginner knows what a journal entry is.** The UX for a non-accountant entering a plumber's invoice or a mortgage interest payment is painful.

**Specific fix needed:**
- Simplified income/expense capture: "Record an expense" form (paid to, category, amount, property, receipt upload) → auto-creates the journal entry behind the scenes
- "Record rent received" form per property/tenancy
- Dashboard showing: rent in, mortgage out, net per property (without opening the accounting module)
- **Bank reconciliation / transaction import does not exist.** No bank feed, no CSV statement import, no smart categorisation.
- No VAT return module. Property VAT (option to tax, construction VAT, commercial VAT) is complex and common in UK property businesses - not in scope yet but worth naming.


### Phase 9: Portfolio Financial Modelling (Not Yet Built)

**What actually happens:** The experienced user needs to know portfolio yield across 20 properties. Prepare investor reports for 8 JV partners. Model refinancing scenarios. Model: "if I refinance property 3 in month 18 and redeploy into two more BRRs, what is my projected portfolio value in 3 years?"

**What Propreneur v2 has:** Analytics/Reporting hub (cohorts, funnel, pipeline velocity), single-deal calculators, investor reports, Carina AI with RAG.

**Critical gap:** **No portfolio-level financial modelling.** Individual deal calculators exist. But "what is my total invested capital, total annual cashflow, LTV across all properties, refinancing scenarios" does not exist. This is where experienced investors spend their analytical time.

**Specific fix needed:** A portfolio modelling view that aggregates:
- Total invested capital across all properties
- Total debt / LTV / equity
- Monthly cashflow (aggregate)
- Per-property yields sorted by performance
- Refinancing scenario modelling (what if I refi property A and redeploy into deal B?)
- Investor-ready portfolio report (PDF export)


### Phase 10: Education Business (If Applicable)

**What actually happens:** Many successful investors monetise their knowledge through courses, 1-2-1 mentoring, group programmes, masterclasses, communities.

**What Propreneur v2 has:** Mentoring OS (full, shipped), LMS/Courses, Community. Strongest feature set in the system.

**Gap:** These features are top-heavy in the nav relative to the core investment workflow. A beginner who just wants to buy their first deal sees the same number of nav items for mentoring (which they don't have yet) as for deal sourcing. The sidebar is balanced when the business is not.

**Fix:** Group education features under a single "Education" collapsible section in the nav. Only expand by default for users on education-tier plans or who have set up a programme.


### Cross-Cutting Services (Always Available)

These are not phases - they're OS-level services accessible from everywhere.

| Service | Role in Journey | Status |
|---------|----------------|--------|
| Carina (AI Assistant) | Answer questions at any stage. RAG knowledge base. Strategy guidance, deal narrative, compliance help, accounting queries, onboarding guide. | EXISTS |
| Calendar / VCal | Schedule viewings, compliance renewals, mentor sessions, pipeline milestones, rent due dates. Context-aware across all modules. | EXISTS |
| Dashboard | Landing page. KPIs change based on user's phase. Beginner sees onboarding progress. Veteran sees portfolio metrics. | EXISTS |
| Notifications & Comms | Alerts across all phases: new lead, compliance expiry, rent due, pipeline stage change, mentor check-in. | PARTIAL |
| Global Search | Find anything across any module - properties, contacts, deals, documents. | EXISTS |
| Document Vault | Central document store. Accessible from compliance, properties, pipeline, tenant onboarding. | PARTIAL (per-property only) |

---

## Navigation Reorganisation

### Current Sidebar (What a beginner sees today)

```
Dashboard
Portfolio ← Stage 7 (you don't have a portfolio yet)
Deals ← Stage 2-3 (correct position, wrong child ordering)
CRM ← Stage 4-5
Investors ← Stage 4 (duplicate of CRM conceptually)
Pipeline ← Stage 5 (acquisition execution)
Compliance ← Stage 5-6
Accounting ← Stage 8
viCal ← Stage 4 and 10
[Mentoring group] ← Stage 10 (education business)
Community ← Stage 10
Marketing intake ← Stage 4
Communications ← Stage 4 and 10
Market Intelligence ← Stage 1 and 9
Carina AI ← All stages
Analytics ← Stage 9
Settings
```

A beginner reads this and concludes: first set up my portfolio, then do deals, then CRM, then pipeline, then compliance, then accounting, then calendar, then mentoring. That's backwards at almost every step.

### Proposed Sidebar (Organised by Business Milestones)

```
DASHBOARD ← Landing page, cross-cutting overview
---
START HERE ← Phase 0: New users only
  Goal & Setup → Onboarding wizard, strategy, business setup
---
LEARN ← Phase 1 + Phase 10
  Mentoring → Mentor pairing, goals, milestones, sessions
  Courses → Learning paths, course modules
  Community → Peer discussion, group cohorts
---
FIND & ANALYSE ← Phase 2 + Phase 3
  Deal Sourcing → Sourcing criteria, lead inbox, URL import
  Deal Calculator → BTL, BRR, HMO, SA, Flip, R2R calculators
  Deal Workspace → Saved analyses, shortlists, Carina narratives
---
BUILD YOUR TEAM ← Phase 2 + Phase 4
  Contacts → All contacts unified: agents, investors, solicitors, brokers, contractors
  Investors → Investor CRM, deal matching (subset of Contacts with investor filter)
  Power Team → Your go-to professionals
---
FUND & CLOSE ← Phase 4 + Phase 5
  Acquisitions Board → Pipeline Kanban (rename from "Pipeline" - less software jargon)
  Deal Packs → Investment pack generator
  Compliance → Per-deal compliance checklist, document tracking
---
MANAGE ASSETS ← Phase 6 + Phase 7
  Portfolio → Properties hub
  Tenancies → Tenant management, rent collection, maintenance
  Projects → Refurb project management (NOT BUILT YET)
  Documents → Document vault (per property + cross-cutting)
---
FINANCE ← Phase 8
  Income & Expenses → Simplified recording (NOT BUILT YET - replace for non-accountants)
  Accounting (Advanced) → Journal entries, trial balance, GL (for accountants/power users)
  P&L Reports → Per-property profit & loss, portfolio overview
---
INTELLIGENCE ← Phase 9
  Analytics → Portfolio metrics, pipeline velocity, cohort analysis
  Market Intel → Area research, PropertyData integration
  Portfolio Modelling → Scenario planning, refi modelling (NOT BUILT YET)
---
CARINA ← Cross-cutting AI assistant
  Chat → Always-available Carina widget
  Ask About This Page → Context-aware assistant
---
SETTINGS ← Account, workspace, billing
```

Key changes explained:
- "Pipeline" → "Acquisitions Board" (business language, not software language)
- CRM and Investors merged into "Build Your Team" with Investor as a filtered view
- Accounting split: simplified "Income & Expenses" for most users, "Accounting (Advanced)" for accountants
- New group: "FUND & CLOSE" - compliance now lives here contextually (per-deal), not as a standalone module
- Deal Analysis renamed "Deal Calculator" and "Deal Workspace" - clearer intent
- "Portfolio Modelling" called out as the missing Phase 9 feature
- Education features grouped under "LEARN" - collapsible for focus

---

## Comprehensive Gap Analysis

### Critical Gaps (Block the beginner journey - must fix)

| # | Gap | Blocks Phase | Source |
|---|-----|-------------|--------|
| 1 | Onboarding OS incomplete (workspace wizard captures strategy + seeds starter sourcing; no quiz, Carina guide, or mandatory first deal) | Phase 0 - every new user | Both |
| 2 | Deal analysis and Pipeline are disconnected | Phase 3 → Phase 5 - every deal | Claude (specific fix: "Promote to acquisition board" button) |
| 3 | No document vault | Phase 5 - every acquisition | Both |
| 4 | No project management module | Phase 6 - every BRR/HMO | Both |
| 5 | Accounting UX built for accountants, not investors | Phase 8 - every user | Claude (sharpest critique) |
| 6 | No bank reconciliation / transaction import | Phase 8 - every user | Claude |
| 7 | No deal-to-investor matching workflow | Phase 4 - capital raising | Claude |
| 8 | Navigation order contradicts business sequence | All phases - first impression | Both |

### Important Gaps (Complete the journey)

| # | Gap | Blocks Phase | Source |
|---|-----|-------------|--------|
| 9 | No marketing funnel builder (landing pages, lead magnets, capture) | Phase 2 | Both |
| 10 | No direct-to-vendor campaign tool (letter/postcard) | Phase 2 | Claude |
| 11 | No lead nurture campaign engine (email sequences wired to Comms Engine) | Phase 2 | Both |
| 12 | Lead scoring/qualification has no first-class UI (algorithm exists) | Phase 2 | Both |
| 13 | Compliance not contextual - no deal/property link | Phase 5 | Claude |
| 14 | No promote-to-portfolio on pipeline board completion | Phase 5 → Phase 6 | Malike |
| 15 | No investment pack / deal teaser generator | Phase 4 | Claude |
| 16 | CRM and Investor Hub are duplicate concepts in the nav | Phase 4 | Claude |
| 17 | No portfolio-level financial modelling | Phase 9 | Both |
| 18 | No maintenance module (repairs, contractor dispatch) | Phase 7 | Both |
| 19 | No property inspection module | Phase 7 | Malike |
| 20 | No JV template library | Phase 4 | Malike |
| 21 | Business setup toolkit (company formation, bank, AML guidance) not built | Phase 0 | Malike |
| 22 | No compliance auto-renewal alerts with escalation | Phase 7 | Both |

### Enhancement Opportunities

| # | Enhancement | Phase | Source |
|---|-------------|-------|--------|
| 23 | Carina as the onboarding guide (conversational wizard) | Phase 0 | Malike |
| 24 | Phase-specific dashboard (beginner vs veteran views) | Cross | Malike |
| 25 | Mobile viewing app (inspection checklist with camera, GPS, notes) | Phase 3 | Malike |
| 26 | Empty states that teach ("No properties yet - complete an acquisition first") | All | Malike |
| 27 | Strategy recommendation engine (not just onboarding - Carina-powered quiz) | Phase 0 | Malike |
| 28 | Education business over-represented in nav for beginners | Phase 1/10 | Claude |
| 29 | Rent collection / arrears workflow | Phase 7 | Both |
| 30 | VAT return module (option to tax, construction VAT) | Phase 8 | Claude |

---

## Critical Cross-Module Connections (The Workflow Glue)

These are the specific UX integrations that make the system feel like one OS instead of assembled parts:

| From | To | What Should Happen | Priority |
|------|----|--------------------|----------|
| Deal Analysis (Phase 3) | Acquisitions Board (Phase 5) | "Promote to acquisition board" button - creates a pipeline card pre-populated with deal reference, address, asking price, strategy | #1 - closes the biggest workflow gap |
| Deal Analysis (Phase 3) | Investor Hub (Phase 4) | "Find matching investors" button - shows investors whose criteria match this deal's capital requirement, geography, and returns | #2 |
| Deal Analysis (Phase 3) | Refurb (Phase 6) | "Create refurb plan" button - creates a project with the estimated refurb budget from the calculator | #3 |
| Acquisitions Board (Phase 5) | Portfolio (Phase 6) | "Add to portfolio" on a Completed pipeline card - auto-creates the Property record with address, purchase price, strategy | #4 |
| Acquisitions Board (Phase 5) | Documents (Phase 5) | "Upload documents" per pipeline stage - store offer letter, survey, mortgage offer, completion statement against the deal | #5 |
| Portfolio (Phase 6) | Compliance (Phase 6) | "Set up compliance" on new property - pre-populate required certificates based on property type and strategy | #6 |
| Tenancy (Phase 7) | Accounting (Phase 8) | "Record rent as income" - create journal entry from a rent received record | #7 |
| Portfolio (Phase 6) | Accounting (Phase 8) | "View P&L" on any property - deep link from property show page to the P&L report for that property | EXISTS |
| Any Phase | Carina | Context-aware Carina - Carina knows what page/phase the user is on and answers accordingly | EXISTS |

---

## Design Principles for All Future Development

1. **Journey over features.** Every new feature must map to a phase. If it doesn't fit, question whether it belongs.

2. **No module is an island.** Every module must communicate with adjacent phases. A deal should know about its pipeline card. A property should link to its accounting P&L. Compliance should know which deal triggered it.

3. **The menu is the map.** A user should be able to navigate the entire business journey from the sidebar. No submenu nesting deeper than 2 levels.

4. **Carina everywhere.** Every page should have a Carina widget that understands the current context. A user on the BTL calculator should be able to ask "What yield should I target in Manchester?"

5. **Beginner-first, expert-flexible.** Default views assume a beginner. Power users can rearrange, hide phases, and access advanced features (like double-entry accounting).

6. **Empty states teach.** When a module has no data, show the user what to do next. "No properties yet - complete an acquisition first." "No contacts yet - add your first estate agent."

7. **Phase 0 should feel mandatory.** New users should complete workspace setup (including strategy) before treating the app as "open for business." A future strategy **quiz** plus checklist nudges (deal saved, criteria tuned) tighten this further.

8. **Progress is measurable.** Every user should be able to see their phase progression. "You're in Phase 3 - Deal Analysis. You've completed 4/5 steps in this phase. Next step: analyse your first deal."

9. **Don't let education features dominate the nav for non-education users.** Group or collapse education sections for beginners on investment-only plans.

10. **Reduce conceptual duplication.** Investors are contacts with a type filter. Don't maintain separate modules that show the same people.

---

## Recommended Build Sequence

### Immediate (Week 1 - changes first impression, low build cost)

1. Restructure the navigation to follow the business lifecycle groups above. No new code - just sidebar reorganisation in layouts/app.blade.php and TenantNavModuleAccess. Changes the entire first impression. *Note: this touches layouts, permissions, feature flags, and tests. It's a week of careful work, not a day.*

2. Add the "Promote to acquisition board" button on a deal analysis. Creates a pipeline card pre-populated with deal reference, address, asking price. The single most impactful UX fix - closes the biggest workflow gap with minimal build.

3. **Deepen onboarding** - wizard already includes strategy and starter sourcing; add first-deal step, calculator defaults from `workspace_primary_strategy`, and optional strategy quiz. **Getting started** on the dashboard already follows lifecycle order (setup → contacts → analysis → acquisitions → portfolio → mail).

### Short-term (Weeks 2-4 - structural necessity)

4. Split the Accounting UI into two surfaces:
   - "Income & Expenses" - simplified record-keeping (record rent received, record expense paid, receipt upload, per-property net position). No journal entries visible.
   - "Accounting (Advanced)" - existing double-entry GL, trial balance, journals. For accountants and power users.

5. Build the Document Vault. Central document store accessible from acquisitions, compliance, properties, and tenancies. Upload, tag, search, expiry alerts.

6. Connect the remaining cross-module links from the table above (find investors for deal, add to portfolio on completion, set up compliance on new property).

### Medium-term (Month 2 - completes the journey)

7. Build the Project Management module for refurb and project tracking. Timeline, contractors, budget vs actuals, snagging, photos.

8. Build the Marketing Funnel module - landing pages, lead magnets, email capture, wired to CRM and Comms Engine.

9. Build portfolio-level financial modelling - aggregate invested capital, LTV, cashflow, refinancing scenarios.

10. Add bank reconciliation - CSV statement import, smart categorisation, matching to existing journal entries.

### Long-term (Month 3+ - enhancement)

11. Maintenance module (repair requests, contractor dispatch, cost tracking)
12. Property inspection module (mobile app with camera, GPS, scorecards)
13. VAT return module
14. Investment pack auto-generation (PDF from deal analysis + property data)
15. Deal-to-investor matching UI
16. Compliance auto-renewal alerts with escalation workflow

---

## Appendix: Phase Dependency Graph

```
Phase 0 (Foundation & Strategy)
 ├──→ Phase 1 (Learning & Mentorship) - strategy choice determines learning path
 ├──→ Phase 2 (Deal Sourcing & Leads) - strategy determines what to source
 │   └──→ Phase 3 (Deal Analysis) - need a lead to analyse
 │       ├──→ Phase 4 (Investor Matching & Funding) - need a vetted deal to fund
 │       └──→ Phase 5 (Acquisition Execution) - need a funded deal in progress
 │           ├──→ Phase 6 (Refurbishment) - need owned property needing work
 │           └──→ Phase 7 (Portfolio & Tenancy) - need owned property
 │               └──→ Phase 8 (Financial Management) - meaningful from here
 └──────────────────────────────────────→ Phase 9 (Portfolio Modelling) - need data from multiple properties
(Phase 10 - Education - is a parallel business, not a linear phase)
```

No module should appear in the menu before its dependencies are satisfied. A new user with no data sees only Phases 0-2. Green dots, progress bars, and "complete Phase X to unlock Phase Y" signals guide them forward.

---

*This document is the merged analysis of two independent assessments (DeepSeek Claw, 2026-05-14 and Claude, 2026-05-13). It supersedes both as the canonical reference for Propreneur v2 Business Edition's user journey, navigation architecture, gap analysis, and build priorities.*
