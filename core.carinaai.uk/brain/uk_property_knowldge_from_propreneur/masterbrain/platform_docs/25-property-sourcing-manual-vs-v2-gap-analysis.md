# Property Sourcing Manual vs Propreneur v2 -- Gap Analysis

**Manual:** TENX Property Sourcing Manual (132 pages). **Corpus:** markdown extracts under `_ignore/06_training_corpus_valiant/valiant_education/MD Files/` (e.g. `property-sourcing-manual-full-docx.md`, `property-sourcing-comprehensive-manual-pdf-version.md`). Navigation hub: `_ignore/AGENT_INDEX.md`.
**Date:** 7 May 2026

---

## Manual Modules vs What v2 Has

### Module 1: Property Sourcing Overview
*What it covers:* What sourcing is, who customers are, how to monetise, getting started.

**v2 Status:** Mostly covered by knowledge docs (42, 43, 44, 46, 69). Carina can answer these. **No new code needed.**

---

### Module 2: Set Up & Compliance (The BIG one)
*What it covers:* LTD company setup, bank accounts, insurances, ICO data protection, Property Redress Scheme, AML registration/training/documentation, KYC (manual + online), invoicing, proof of funding.

**v2 Status: PARTIALLY BUILT.**

| Manual Item | v2 Status |
|---|---|
| LTD set up checklist | Knowledge doc only (51). No tracker. |
| Bank accounts (client holding, day-to-day) | Not tracked. |
| Insurances (PI, PL, EL, business car) | Not in system. |
| ICO registration tracking | Not in system. |
| Property Redress Scheme membership | Not in system. |
| AML registration & approval workflow | **InvestorKycWorkspaceService exists** but it's investor-facing, not sourcer-facing. |
| KYC manual verification | **InvestorKycWorkspaceService + Credas integration likely exists.** |
| Proof of funding verification | Not tracked. |
| Invoicing system | **Accounting module exists** but sourcer-specific invoicing not configured. |
| Compliance checklist (progress %) | Not built. |

**Gap:** A **Sourcer Compliance Dashboard** -- checklist with progress tracking, document upload, expiry alerts. The manual has a complete data model for this (companies house number, SIC code, PI cover amount, ICO reg, AML status, redress scheme). **Medium build (~2-3 days).**

---

### Module 3: Marketing Your Business
*What it covers:* Building authority, reputation, engagement, social media, video, Instagram Reels, giveaways, testimonials, artwork, marketing funnel.

**v2 Status:** Knowledge docs only (43, 48). Marketing Templates feature was identified as a gap in the Azu masterclass analysis but not built. **Low priority -- Carina can advise.**

---

### Module 4: Growing an Investors List
*What it covers:* Ideal client profile, market dominating position, networking events, 20-second pitch, investor journey, CRM system.

**v2 Status: MOSTLY BUILT.**

| Manual Item | v2 Status |
|---|---|
| Ideal client profile (ICP) | Not explicitly tracked in CRM. |
| Market dominating position | Knowledge doc only. |
| Networking events | Not in system (but IPN active). |
| 20-second pitch | Not in system. |
| Investor journey | **InvestorFunnelStageService exists** -- pipeline stages for investors. |
| CRM system | **Full CRM exists** with contacts, scoring, tags. |

**Gap:** An **ICP profile template** in CRM (tag/label that identifies ideal investor characteristics). Trivial.

---

### Module 5: Property Deals (Finding Them)
*What it covers:* Goldmine patch, types of deals, BTL, BRR/flip, HMO, 5-minute due diligence, valuing a property, good deal examples.

**v2 Status: MOSTLY BUILT.**

| Manual Item | v2 Status |
|---|---|
| Goldmine patch | **SourcingResearchLinkService exists.** Area profiles. |
| Deal types (BTL, BRR, HMO, flip) | **All 16 calculators exist.** |
| 5-minute due diligence | **PropertyDataDueDiligenceBundleService exists.** |
| Valuing a property | Calculators cover this + refurb catalogue. |
| Good deal examples | Knowledge docs (47). |

**Gap:** The manual has an explicit **"Goldmine Patch" research workflow** -- identifying target postcodes, driving them to find deals, tracking what you find. The tools exist but there's no guided **Goldmine workflow wizard** that walks a sourcer through: pick area -> research metrics -> drive streets -> log finds. Small build (~1 day).

---

### Module 6: Assessing Property
*What it covers:* Walk-through, damp checking, roof spaces, interior/exterior condition, structure, flooring/joists, windows/doors.

**v2 Status: NOT BUILT.** This is a **physical inspection checklist** -- currently done on paper or mental. No digital version exists. The manual has a structured assessment framework that could be a guided Carina workflow.

**Gap:** A **Property Inspection Checklist** -- guided assessment with photos, scores, and notes per room/area. Could be a Carina tool or a simple form. **Small build (~half day).**

---

### Module 7: Selling Your Deals
*What it covers:* Bespoke sourcing, staging/set up, deal packaging, creating the offer, sales call, getting paid, upselling.

**v2 Status: MOSTLY BUILT.**

| Manual Item | v2 Status |
|---|---|
| Bespoke sourcing | Not explicitly tracked. |
| Staging/set up | Not in system (ops workflow). |
| Deal packaging | **Knowledge doc (46).** Carina can create deal summaries. |
| Creating the offer | Not a structured workflow. |
| Sales call tracking | **CRM interaction log exists.** |
| Getting paid | **Invoicing/accounting module exists.** |
| Upselling | Not explicitly tracked. |

**Gap:** A **Deal Packaging Generator** -- Carina or a form that produces a professional deal pack PDF from the deal data (purchase price, refurb costs, GDV, rental income, comparable evidence). This is what Bernadette needed for her valuation appeal. **Small-medium build (~1-2 days).**

---

### Supporting Resources in the Manual Folder

| Resource | v2 Status | Action |
|---|---|---|
| `ROI & Refurb Calculators.xlsx` | **Calculators exist in code.** Manual's Excel is simpler. Already surpassed. | None |
| `Buy to SA.xlsx` (SA = Sourcing Agreement?) | Not checked. | Review. |
| `Template DD Pack.docx` | **PropertyDataDueDiligenceBundleService exists.** | Compare for gaps. |
| `Property Sourcing Customer Journey.pdf` | Knowledge doc only. | Could extract to Carina brain. |
| `Viewing Guide.pdf` (51 MB!) | Not ingested. | Extract for inspection checklist. |
| `the training provider Cashflow Forecast.xlsx` | **Accounting module exists.** | May not need. |
| `Property Entrepreneurship Training Sales Dashboard.xlsx` | Not checked. | Review. |
| Training compliance templates directory | Law docs & T&Cs. **Compliance module tracks expiries but doesn't store templates.** | Worth reviewing for template library. |
| Training T&C templates directory | Terms & Conditions, contract templates. | Worth reviewing. |
| `Example of a DD Pack/` | Due Diligence example. | Useful for Deal Packaging Generator. |

---

## Summary: What's Worth Building

| # | Feature | From Manual | Effort | Impact |
|---|---|---|---|---|
| 1 | **Sourcer Compliance Dashboard** | Module 2 (entirely) | Medium | High -- onboarding sourcers is a key workflow. Currently no compliance tracking for sourcers. |
| 2 | **Goldmine Patch Workflow** | Module 5.1 | Small | Medium -- guided area research for deal sourcing. |
| 3 | **Property Inspection Checklist** | Module 6 (entirely) | Small | Medium -- digitises a manual process. Could be a Carina tool. |
| 4 | **Deal Packaging Generator** | Module 7.3 + Bernadette's need | Medium | High -- produces professional deal packs for investors/lenders. Directly addresses valuation appeal pain point. |
| 5 | **Customer Journey / ICP Profiles** | Module 4.1, 4.5 | Small | Low -- nice to have. |

---

## Existing v2 Knowledge Docs from Manual

These 11 docs were extracted from this manual for Carina's brain:
42, 43, 44, 46, 47, 48, 50, 51, 53, 55, 69

They're already in `brain/knowledge/` and Carina can reference them. The **code** gaps are what needs building.
