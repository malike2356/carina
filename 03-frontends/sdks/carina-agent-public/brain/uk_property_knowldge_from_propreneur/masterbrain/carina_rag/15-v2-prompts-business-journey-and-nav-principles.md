# Business journey and navigation principles (from `brain/prompts/50-propreneur-workflow-correction-deepseekclaw.md`)

**Source:** `brain/prompts/50-propreneur-workflow-correction-deepseekclaw.md` (merged DeepSeek + Claude, 2026-05-14). Earlier hub-level scratch files `propreneur-workflow_correction.md` and `propreneur-workflow_correction_by_deepseekClaw.md` (sibling of `propreneur-v2/`) were folded into that prompt and removed from disk so this file and **`50`** stay the single sources of truth.  
**Purpose:** Carina should explain Propreneur as a **property operating system** ordered by milestones, not as a flat list of engineering modules.

## Core thesis

Beginners think in milestones (strategy, sourcing, analysis, funding, acquisition, refurb, let, scale), not in product nouns ("open CRM first"). Help text and suggestions should map features to **where the user is in the journey**.

## Ten-phase journey (condensed)

1. **Foundation and strategy** - Choose strategies (BTL, HMO, BRR, R2R, SA, flip, commercial). Set legal and banking basics and criteria. Workspace onboarding captures primary strategy; deeper "onboarding OS" (quiz, mandatory first deal, calculator defaults from strategy) may still land over time.
2. **Learning and mentorship** - Courses, community, mentoring. Strong in the product; position as learning for beginners so it does not overwhelm acquisition tasks.
3. **Deal sourcing and lead generation** - Criteria, portals, match inbox, CRM for agents/vendors. Lead funnel and speed-to-lead align here.
4. **Deal analysis** - Calculators, refurb, SDLT, bridging, Carina narrative. Historically the strongest pillar. Pipeline should feel like the **next step** after analysis (promote-to-board behaviour is a key workflow link).
5. **Investor matching and funding** - Investor contacts, scoring, hub, portal. Deal-investor matching and packs are high-value differentiators vs generic CRMs.
6. **Acquisition execution** - Kanban pipeline, power team, compliance, documents. Vault and deal-scoped compliance are operational necessities at scale.
7. **Refurbishment and projects** - Spend, contractors, timelines; project module maturity varies.
8. **Lettings and operations** - Tenancies, rent, compliance renewals.
9. **Portfolio and finance** - Accounting, cashflow, reporting, tax prep handoff.
10. **Scale and education business** - Mentoring as a revenue line, repeatable systems.

## Product rules Carina must respect

- **Property-native automations:** If an automation cannot cite a property, deal, compliance, or investor fact, it is out of scope versus generic marketing stacks.
- **Investors are contacts** - CRM and investor hub share one people model; avoid implying duplicate databases.
- **Scheduling:** viCal is the **only** first-party scheduling stack on v2 (no Cal.com-style third-party product inside this OS narrative).
- **Carina context:** Baseline workspace context is always merged by `CarinaBaselineContextService`. **Systematic per-page `CarinaContext` (route + model + visible fields)** is a documented future improvement (gap 48); until then, use explicit deep links and hubs (accounting, vCal, etc.) where implemented.

## Known workflow gaps (check shipped status before asserting)

Treat statements about missing UX as **hypotheses** unless confirmed in `memory.md` or `brain/knowledge/`: several OS-audit gaps (accounting UX, deal-investor matching, lead triggers, portfolio model, bank reconciliation) were closed in **2026-05-14** stage log entries. If unsure, say what exists and point the user to the relevant hub route.
