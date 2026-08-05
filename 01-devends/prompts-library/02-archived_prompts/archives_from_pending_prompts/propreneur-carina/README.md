# Propreneur Carina Prompt Pack

**Status: COMPLETED 2026-07-26**

**What was built:**
- Implemented and archived

This folder contains the implementation prompts for adding Carina-led property operations inside Propreneur. The prompts are not standalone copy/paste instructions. They are sprint briefs that must be adapted to the current Propreneur Laravel codebase.

## Canonical Target

Work in:

```bash
/opt/lampp/htdocs/verlox/propreneur/propreneur-v2
```

Do not use the old uppercase `VERLOX` path.

## Execution Order

Run the prompts in this order so dependencies are available before later sprint work starts:

| Order | Prompt file | Purpose |
| --- | --- | --- |
| 1 | `sprint-carina-document-upload.md` | Attach documents from chat and update compliance records. |
| 2 | `sprint-carina-tenant-communication.md` | Draft, approve, send, and log tenant messages. |
| 3 | `sprint-carina-property-operations.md` | Query and update properties, tenants, payments, notes, and portfolio summaries. |
| 4 | `sprint-carina-deal-analysis.md` | Analyse investment deals, yields, cash flow, ROI, and floor plans. |
| 5 | `sprint-carina-email-actions.md` | Classify inbound emails, file attachments, flag legal items, and produce digests. |
| 6 | `sprint-carina-maintenance-lifecycle.md` | Manage maintenance requests, contractors, jobs, status changes, and invoices. |
| 7 | `sprint-carina-tenant-onboarding.md` | Move applicants through enquiry, referencing, right to rent, deposit, and approval. |
| 8 | `sprint-carina-insurance-hmo-compliance.md` | Track insurance, HMO licensing, compliance gaps, and renewal alerts. |
| 9 | `sprint-carina-batch-calendar-reports.md` | Add batch operations, landlord calendar events, reports, and health scoring. |
| 10 | `sprint-carina-sourcing-tax-intelligence.md` | Add sourcing CRM, expenses, tax summaries, and portfolio intelligence. |
| 11 | `sprint-carina-admin-billing-team.md` | Add billing, subscription, and team administration tools. |

## Shared Rules For Every Sprint

- Inspect the existing Propreneur models, migrations, services, routes, policies, events, jobs, and tests before editing.
- Treat embedded PHP snippets as sketches. Prefer the current application patterns over the snippet when they differ.
- Do not create duplicate models, tables, routes, service classes, or prompt registries if an equivalent already exists.
- Preserve tenant isolation. Every query must be scoped to the authenticated landlord, workspace, tenant, or account boundary already used by Propreneur.
- Keep approval gates for risky actions. Sending messages, taking payment or billing actions, legal/compliance responses, and contractor instructions must require explicit human approval unless the action is read-only or draft-only.
- Do not auto-action solicitor, legal, eviction, HMO, insurance claim, mortgage, or regulatory messages. Flag them for review.
- Register tools in the existing Carina dispatcher and prompt registry after verifying their real paths. The paths named in each sprint are expected locations, not proof they exist.
- Add tests for handler routing, tenant scoping, validation failures, approval gates, and successful tool execution.
- Avoid dashboard rewrites unless the sprint explicitly requires a minimal supporting view.

## Required Preflight

From the Propreneur app root, run discovery before implementation:

```bash
pwd
php artisan about
php artisan route:list
find app -maxdepth 4 -type f | sort | sed -n '1,200p'
find database -maxdepth 3 -type f | sort | sed -n '1,200p'
rg -n "Carina|ToolHandler|ToolResult|Conversation|Property|Tenant|Compliance|Stripe|Billing" app database routes config
```

Use the output to align each prompt with the real code. If a named class or file is missing, search for the closest equivalent and adapt the implementation.

## Required Verification

Before marking a sprint done:

```bash
php artisan test
php artisan route:list
```

Also run targeted tests for any files changed. If the app has PHPStan, Pint, Pest, PHPUnit, or frontend checks configured, run the package-local command that already exists in the project.

## Corrections Applied

- Replaced the legacy uppercase Propreneur path with the canonical lowercase path.
- Removed forbidden non-ASCII punctuation from the prompt pack.
- Added a shared preflight warning to each sprint file.
- Documented the dependency order for all eleven prompt files.
- Added safety rules around tenant isolation, approvals, legal/compliance handling, and dispatcher registration.
