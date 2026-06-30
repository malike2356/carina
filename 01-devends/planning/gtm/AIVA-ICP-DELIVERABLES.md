# Aiva ICP and positioning deliverables

**Strategy prompt:** `aiva-icp-and-positioning.md` (archived 2026-06-30)

**Authoritative pricing:** `01-devends/prompts/01-pending_prompts/pricing-strategy.md`

---

## Deliverables status

| Deliverable | Location | Status |
| --- | --- | --- |
| Landing page (compliance-first ICP) | `03-frontends/marketing/carinaai.uk/aiva/index.html` | Done 2026-06-30 |
| Compliance one-pager (PDF-ready) | `03-frontends/marketing/carinaai.uk/aiva/compliance/index.html` | Done 2026-06-30 |
| Property sector page | `03-frontends/marketing/carinaai.uk/aiva/property/index.html` | Done 2026-06-30 |
| 5-minute sales demo script | `01-devends/planning/gtm/aiva-sales-demo-script.md` | Done 2026-06-30 |
| Pricing API fallbacks (£149 / £349) | `02-backends/core.carinaai.uk/src/api/public-pricing.ts` | Done 2026-06-30 |
| Ops pricing store defaults | `02-backends/admin/ops.carinaai.uk/lib/pricing-store.ts` | Done 2026-06-30 |

---

## Acceptance criteria (from strategy prompt)

| Criterion | Met? | Notes |
| --- | --- | --- |
| Landing visitor can state who it is for and what it replaces in one sentence | Yes | Hero + ICP sector grid + labour pricing anchor |
| Demo script under 5 minutes with approval action | Yes | `aiva-sales-demo-script.md`; onboarding tab is default on landing page |
| Pricing anchored vs human VA, not SaaS | Yes | Labour anchor block on pricing section |
| Compliance officer can say "I can work with this" | Yes | `/aiva/compliance/` one-pager |

---

## Pricing reconciliation (review 2026-06-30)

| Item | Authoritative value | Was (stale) | Action |
| --- | --- | --- | --- |
| Starter plan | £149/mo, 1 AI Employee | £49 on marketing + API | Updated marketing + API fallbacks |
| Growth plan | £349/mo, 5 employees | £99 "Team" | Renamed to Growth in UI; `aiva_team` key kept for billing compat |
| Enterprise | Custom | £299 "Business" | Replaced with contact sales |
| Extra seat | £49/mo each | Unclear in ICP doc | Clarified in ICP archive + labour anchor |
| Scout Govern bundle | Included free; do not advertise £79 saving | N/A | Honoured in copy |

**Still pending (not in this sprint):**

- [ ] Stripe products via `scripts/stripe-setup-aiva.ts` at new prices (founder sign-off)
- [ ] `platform_pricing` DB rows on production (migration seed exists; run on deploy)
- [ ] `carinaai.uk/pricing/index.html` Aiva section (still shows legacy £49 tiers)
- [ ] `hireaiva/index.html` sync with `carinaai.uk/aiva/index.html` if both are deployed
- [ ] Billing plan gates in app (`plan=team` vs `plan=growth` register URLs)

---

## Sector priority (refined)

1. **Property management** (first GTM vertical): lowest compliance overhead vs IFA/legal; high admin volume; partnership path via Reapit/Fixflo.
2. **Financial services** (IFA, mortgage, accountancy): high willingness to pay; longer compliance review cycle.
3. **Legal** (SRA): strongest governance need; slowest sales cycle.
4. **HR / recruitment**: high email volume; moderate compliance sensitivity.

**Not for:** Tech-first firms with internal AI teams (Mutant), solo freelancers, buyers who reject kill switch / approval concepts.

---

## GTM channel order (unchanged from strategy)

1. Direct outreach via PIMFA, ARLA Propertymark, ICAEW
2. Compliance-angle content (case studies)
3. Practice management software partnerships
4. Mutant community (12-18 month funnel)

---

## Related pending work

- `scout-bundling-and-ai-employee.md` (product build; billing still says 2 employees in spec vs 1 in pricing-strategy)
- `aiva-launch-readiness.md` (legal, Stripe, Scout provisioning gate)
- `legal-acceptance-gate.md`
