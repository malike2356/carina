# Carina Ops Build Prompts

Action prompts for productizing Carina Ops per `instructions/strategy/CARINA_OPS_IMPLEMENTATION_PLAN.md`.

Each file is a self-contained Cursor task. Run in order; dependencies are listed in each prompt.

## Important naming note

`core.carinaai.uk/src/api/ops-routes.ts` is the **operator machine API** (`CARINA_OPS_TOKEN`, skill packs, secrets reload). Do not extend it for the customer product.

Customer Carina Ops uses:

- UI: `src/gateway/web/ops/`
- API: `src/api/carina-ops-routes.ts` mounted at `/api/carina-ops/*`

Private VERLOX back office stays in `ops.carinaai.uk/`.

## Build order

| # | File | Sprint | Depends on |
|---|------|--------|------------|
| 00 | `00-lock-spec-and-boundaries.md` | 0 | None |
| 01 | `01-org-migrations-schema.md` | 1 | 00 |
| 02 | `02-register-creates-org.md` | 1 | 01 |
| 03 | `03-rbac-module.md` | 1 | 01 |
| 04 | `04-org-member-middleware.md` | 1 | 02, 03 |
| 05 | `05-org-invites-endpoints.md` | 1 | 03, 04 |
| 06 | `06-tenant-backfill-cli.md` | 1 | 01, 02 |
| 07 | `07-rbac-tests.md` | 1 | 03, 04, 05 |
| 08 | `08-org-context-helper.md` | 2 | 04 |
| 09 | `09-scope-billing-byok-queries.md` | 2 | 08 |
| 10 | `10-product-audit-log.md` | 2 | 08 |
| 11 | `11-ops-support-tenant-scoping.md` | 2 | 08, 10 |
| 12 | `12-tenant-isolation-tests.md` | 2 | 09, 10 |
| 13 | `13-plan-gates-module.md` | 3 | 03, 08 |
| 14 | `14-ops-static-shell.md` | 3 | 13 |
| 15 | `15-carina-ops-api-router.md` | 3 | 04, 13 |
| 16 | `16-ops-routing-upgrade-cta.md` | 3 | 14, 15 |
| 17 | `17-ai-platform-migrations-core.md` | 4 | 01, 08 |
| 18 | `18-ops-models-api.md` | 4 | 15, 17 |
| 19 | `19-ops-vault-api.md` | 4 | 09, 10, 15 |
| 20 | `20-ops-workbench-api.md` | 4 | 17, 19 |
| 21 | `21-ops-usage-credits-api.md` | 4 | 09, 15 |
| 22 | `22-ops-audit-log-api.md` | 4 | 10, 15 |
| 23 | `23-ops-deployments-environments-api.md` | 4 | 17, 13, 15 |
| 24 | `24-billing-plan-ids.md` | 5 | 00, 13 |
| 25 | `25-stripe-checkout-portal-ops.md` | 5 | 24, 04 |
| 26 | `26-stripe-webhook-plan-sync.md` | 5 | 24, 25 |
| 27 | `27-usage-limits-warnings.md` | 5 | 24, 21, 26 |
| 28 | `28-ops-billing-page-ui.md` | 5 | 14, 25, 26 |
| 29 | `29-trial-support.md` | 5 | 24, 26 |
| 30 | `30-onboarding-checklist-api.md` | 6 | 19, 20, 22 |
| 31 | `31-onboarding-wizard-ui.md` | 6 | 14, 30 |
| 32 | `32-audit-usage-exports.md` | 6 | 21, 22, 13 |
| 33 | `33-email-invite-flow.md` | 6 | 05 |
| 34 | `34-support-impersonation.md` | 6 | 11 |
| 35 | `35-secret-redaction-audit.md` | 6 | 10, 19 |
| 36 | `36-marketing-pricing-page.md` | 7 | 24 |
| 37 | `37-docs-getting-started.md` | 7 | 31 |
| 38 | `38-launch-checklist-runbook.md` | 7 | 12, 26, 36 |

## Validation commands (after each sprint)

```bash
cd core.carinaai.uk && pnpm test && pnpm typecheck
cd ops.carinaai.uk && pnpm test && pnpm typecheck
```

## Reference docs

- Strategy: `instructions/strategy/productizing_and_commercializing_Carina_OPS_Dashboard.md`
- Plan: `instructions/strategy/CARINA_OPS_IMPLEMENTATION_PLAN.md`
- Hosted wiring: `core.carinaai.uk/prompts/hosted-saas-multitenancy.md`
- AI Platform prototype: `ops.carinaai.uk/lib/ai-platform.ts`
