# Deal calculators: v1 plus v2 parity plan (implementation)

**Updated:** 2026-05-03  
**Status:** Planning document (not all items are shipped).  
**Related:** `04-deals.md`, `29-deals-module-strategy.md`, `brain/prompts/10-deal-calculators.md` (prompt skeleton), legacy reference `../propreneur-v1/` (read-only).

## 1. Purpose

Deliver the **best of legacy v1 calculators** (breadth, workbook depth, UK-specific tools, postcode prefill, configurable defaults) **inside v2’s architecture** (single `DealCalculatorRegistry`, tenant JSON API, `deal_calculator_logs`, workbench embeds, Carina context) without reintroducing v1’s disadvantages (unbounded scope, untested one-off Blade stacks, opaque single lump sums for refurb).

This document is the **implementation plan**: phases, schema sketch, test bar, and governance rules.

## 2. Principles (non-negotiable)

1. **One registry:** Every runnable model is a slug in `DealCalculatorRegistry::STRATEGIES` (or an explicit appendix list if you split “tools” vs “strategies” in docs only). No orphan routes.
2. **Property or deal grounded:** Each new slug must answer: “Which `deal_analyses` / `properties` fields drive it?” If nothing drives it, it ships behind **`deal_calculator_labs`** (or similar) feature flag or not at all.
3. **Contract over UI:** Ship **Pest contracts** (inputs validation, stable output keys, golden JSON fixtures) before or with every slug change.
4. **Progressive disclosure:** Default UIs stay short; “Purchase stack”, “Refurb detail”, “Refinance assumptions” expand into the same API payload.
5. **Single refurb total:** Line items always **rollup** into `refurb_cost` / `renovation_cost` consumed by BRR, flip, sensitivity, and `metrics` (no parallel total in a second column without migration discipline).

## 3. Current v2 baseline (shipped)

- **Eight deal strategies:** `btl`, `brr`, `hmo`, `r2r`, `sa`, `flip`, `commercial`, `development` (commercial-to-residential; dedicated UI at `/deals/development-calculator`).
- **Six underwriting tools:** `npv_irr`, `dscr`, `income_multiples`, `coc_roe`, `ltv`, `breakeven_occupancy`.
- **HTTP:** `POST /deals/calculate/{slug}`, sensitivity for seven strategies, workbench at `/deals/calculators` with named iframe embeds.
- **Logging:** `DealCalculatorRunService` plus `deal_calculator_logs` when authenticated with optional `deal_analysis_id`.
- **Carina:** Deal threads and `deal_calculator` playground threads; system prompt references registry and optional `playground_last_run`.

## 4. v1 gaps to close (priority order)

High UK value and frequent v1 use:

| Priority | Capability | v1 reference | v2 target |
|----------|------------|--------------|-----------|
| P0 | **SDLT** standalone or folded into acquisition stack | `SdltCalculator`, `config/calculators.php` bands | New slug `sdlt` **or** explicit acquisition section on BTL/BRR with dedicated service; tenant defaults for bands where legal allows |
| P0 | **Bridging** | `BridgingCalculator` | New slug `bridging` (loan, rate, fees, term, exit) |
| P1 | **Mortgage** (repayment vs IO) | `MortgageCalculator` | New slug `mortgage` or expand BTL inputs with `payment_type` and amortisation in `BtlCalculator` |
| P1 | **BTL / single-let depth** | `SingleLetCalculator` fields | Extend `BtlCalculator` rules + UI: deposit %, legals, survey, utilities, council tax, management, voids (staged behind “Advanced”) |
| P2 | **Sourcing fee** | `SourcingFeeCalculator` | Slug `sourcing_fee` if still aligned with “deal economics”; else labs flag |
| P2 | **Portfolio rollup** | `PortfolioCalculator` | Slug `portfolio_cashflow` **only** if inputs are **workspace properties** (IDs or linked portfolio), not eternal freeform |
| P3 | **Area comparison** | `AreaComparisonCalculator` | Only with **stored postcode snapshots** and provenance; else defer |
| Omit | **Desk calculator** | `BasicMathCalculator` | Do not port; use spreadsheet export or optional tiny helper on numeric cells |

## 5. Turning stated cons into enforced advantages

### 5.1 Scope creep

- **Product gate:** One-line “driver field” rule in PR template (`instructions.md` or GitHub template).
- **Tiers:** `deal_engine` (core slugs) vs `deal_calculator_labs` feature flag for portfolio/areas/sourcing if needed.
- **Advantage:** Roadmap stays narratable: “Every calculator is deal or property native.”

### 5.2 Maintenance / regression

- **Per-slug Pest file** or single `DealCalculatorContractTest` with dataset provider: valid minimal input, expected output keys, one edge case per slug.
- **Golden fixtures:** `tests/Fixtures/deal-calculators/*.json` for SDLT edge (FTB, additional property), bridging zero exit fee, etc.
- **Advantage:** More models increase confidence; refactors become mechanical.

### 5.3 UX complexity

- **Shared Blade partials** for “purchase stack”, “refurb block”, “rent roll” used by **embed**, **create/edit**, and later pipeline cards.
- **Collapses** with `details`/`summary` or Alpine `x-collapse` already in stack; default closed except first visit cookie optional.
- **Advantage:** One mental model across surfaces.

### 5.4 Settings sprawl

- **Tenant table or JSON:** `workspace_calculator_defaults` (tenant settings row or `tenant_settings` key) with: default LTV, stress rate, SDLT profile (`individual` | `additional_property` | `first_time_buyer`), default contingency %, default management %.
- **Audit:** `updated_by`, `updated_at` on settings writes.
- **Advantage:** Workspaces own assumptions; support and Carina align to stored defaults.

## 6. Refurb: catalogue, lines, rollup (full design)

### 6.1 Problem

Today v2 uses a **single** `renovation_cost` / `refurb_cost` number. That hides **what** makes up refurb, blocks audit, and cannot prefill from a standard list.

### 6.2 Schema (tenant DB)

**A. Catalogue templates (workspace defaults)**

- `refurb_catalogue_items`: `id`, `workspace_id` nullable if global seeds exist, `code` (string, unique per workspace), `label`, `category` (enum: `structure`, `mep`, `finishes`, `compliance`, `fees`, `external`, `other`), `default_unit_cost` (decimal), `default_quantity` (decimal default 1), `unit` (enum: `each`, `sqm`, `room`, `job`), `sort_order`, `is_active`, timestamps.
- Seed **Verlox baseline pack** (20 to 40 lines) via migration seeder; tenants can duplicate or edit costs.

**B. Deal analysis lines**

- `deal_refurb_lines`: `id`, `deal_analysis_id` FK, `catalogue_item_id` nullable FK, `description` (required), `quantity`, `unit_cost`, `line_total` (generated or app-maintained), `vat_mode` (`exempt` | `ex_vat` | `inc_vat`), `sort_order`, timestamps.
- **Constraint:** `deal_analysis_id` must belong to tenant (existing tenancy).

**C. Rollup**

- Service `DealRefurbRollupService::totalForDealAnalysis(DealAnalysis $deal): string` (decimal as string for money) sums lines; writes to `metrics.renovation_cost` or canonical field used by forms, **or** keeps lines authoritative and `renovation_cost` denormalised on save (document single source in `DealAnalysisService`).

### 6.3 API (tenant JSON)

- `GET /api/deals/{deal}/refurb-lines` (or nested under deal analysis if multiple analyses per deal later: prefer **`deal_analysis` scoped**).
- `POST` create line, `PATCH` line, `DELETE` line.
- `POST /api/deals/{deal}/refurb-lines/apply-catalogue` body: `{ "item_ids": [1,2,3] }` appends rows with default costs editable.
- `POST .../import-csv` optional: CSV columns `description,quantity,unit_cost,vat_mode`.

### 6.4 UI

- **Deal create/edit:** section “Refurb schedule” above financial summary: table, add row, pick from catalogue modal, CSV import/export, live total, “Sync to calculator fields” button if not auto-sync.
- **Workbench embed (BRR/flip):** same partial in embed view when `deal_analysis_id` query param present **or** read-only total + link “Edit on deal” if anonymous playground.

### 6.5 Carina

- Extend deal context with `refurb_lines_summary`: array of `{ category, subtotal }` plus grand total; instruction to prefer over a lone `renovation_cost` when both exist.

### 6.6 Tests

- Model factory for lines; rollup sums VAT modes correctly (at least one test per mode).
- API auth: only `created_by` or tenant admin can mutate lines.

## 7. Phased implementation roadmap

### Phase 0 (foundation, 1 to 2 weeks)

- [ ] Add **calculator contract** Pest suite covering all **current** 13 slugs (minimal happy path plus one edge per slug).
- [ ] Add **golden JSON** fixtures directory and one CI job step (already `php artisan test`).
- [ ] Document **slug addition checklist** in `instructions.md` (validation rules, registry, embed partial, `page-inputs`, Carina `04-deals.md` list, contract test).

### Phase 1 (tenant calculator defaults, 1 week)

- [ ] Migration + model for workspace calculator defaults (or `tenant_settings` JSON schema with validation).
- [ ] Tenant UI: **Workspace settings** subsection “Deal calculators” (or under Deal Engine settings) with LTV, stress rate, SDLT profile, contingency %, management %.
- [ ] Wire defaults into `PropertyFinancialService` / calculators where applicable (read with fallback to `config`).

### Phase 2 (SDLT plus bridging, 2 to 3 weeks)

- [ ] `SdltCalculator` (or service) + slug `sdlt`; rules for bands; tests from HMRC-aligned examples (use v1 `SdltCalculator` as maths reference, **do not copy** code verbatim if licence unclear; reimplement).
- [ ] `BridgingCalculator` + slug `bridging`.
- [ ] Registry, `page-inputs`, embed, workbench nav, `04-deals.md`, Carina prompt nudge.
- [ ] Sensitivity: only if product wants bridging stress (defer default).

### Phase 3 (BTL depth, 2 weeks)

- [ ] Extend `BtlCalculator` inputs and assumptions list; keep **backward compatible** defaults for missing new fields.
- [ ] UI: advanced collapses; same fields on deal form and embed.
- [ ] Contract tests for legacy payload (only old fields still valid).

### Phase 4 (mortgage slug or BTL merge, 1 week)

- [ ] Decision: standalone `mortgage` vs BTL extension; implement and test.

### Phase 5 (refurb lines plus catalogue, 3 to 4 weeks)

- [ ] Migrations A and B; seed catalogue.
- [ ] `DealRefurbRollupService`; integrate into `StoreDealAnalysisRequest` / update flow.
- [ ] API routes + controller thin + service.
- [ ] Blade partial + embed hook + CSV import.
- [ ] Carina deal context extension.
- [ ] Feature flag `deal_refurb_schedule` optional for gradual rollout.

### Phase 6 (labs: sourcing, portfolio, areas, 4 plus weeks, optional)

- [ ] Each behind `deal_calculator_labs`; separate product sign-off per slug.
- [ ] Portfolio: inputs from `properties` query only.
- [ ] Areas: stored snapshots + provenance model.

### Phase 7 (prefill, 2 weeks)

- [ ] Reuse existing postcode or listing endpoints: “Prefill from postcode” on deal and embed forms; map into calculator inputs where safe.
- [ ] Rate limit and log prefill calls.

## 8. Deliverables checklist (per slug or per feature)

- [ ] `DealCalculatorRegistry` entry, `rulesFor`, `get()` binding.
- [ ] Calculator class implementing `DealCalculatorInterface`.
- [ ] `page-inputs` partial fragment for embed and deal form reuse.
- [ ] `DealCalculatorController` already generic; extend if new sensitivity patterns.
- [ ] Pest: contract + edge.
- [ ] `brain/knowledge/04-deals.md` numbered list update.
- [ ] `CarinaService` context line if new user-facing path strings change.

## 9. Risks and mitigations

| Risk | Mitigation |
|------|------------|
| HMRC SDLT law changes | Externalise bands in tenant defaults + migration seed; version `sdlt_rules_version` in outputs |
| Money precision | Use decimal string or integer minor units consistently in new services (match existing `PropertyFinancialService` pattern) |
| Iframe plus auth for refurb API | Same-session cookies; CSRF on mutating routes; optional `deal_analysis_id` on embed for logged-in only |
| Large HTML partials | Split by concern; lazy-load catalogue modal |

## 10. What stakeholders should expect

- **Users:** More accuracy and transparency (especially refurb and SDLT); slightly longer forms unless they stay collapsed.
- **Engineering:** Every phase is shippable behind flags; contracts prevent silent maths drift.
- **Product:** Clear tiering between “core UK MIS” and “labs”; narrative stays property-first.

## 11. Success metrics (6 months)

- Calculator API **error rate** stable or down after new slugs (monitoring).
- **Percentage of deals** with non-zero refurb lines once Phase 5 ships.
- **Support tickets** about “where did this number come from?” down for BRR/flip.
- **Carina** deal threads cite `calculator_last` and refurb category summary when present.

---

**End state:** v2 remains the **single engine** for calculators, gains **v1’s high-value UK tools and workbook depth**, adds an **auditable refurb composition**, and uses **tests plus gates** so breadth becomes a strength instead of a maintenance tax.
