# Active implementation prompts

**Updated:** 2026-06-30

`pending_prompts/` holds prompts that still need code or gap closure. Verified-complete
work lives under `archived_prompts/archives_from_pending_prompts/`.

## Active work

### ICP and GTM (COMPLETED 2026-06-30)

Strategy and marketing deliverables shipped. Tracker: `01-devends/planning/gtm/AIVA-ICP-DELIVERABLES.md`.
Archived prompt: `archived_prompts/archives_from_pending_prompts/gtm-readiness/aiva-icp-and-positioning.COMPLETED.md`.

Remaining from that sprint: Stripe price sync, `carinaai.uk/pricing/` Aiva section update, `hireaiva` mirror deploy.

### Pricing and billing (PENDING)

| Prompt | What it does | Status |
|--------|-------------|--------|
| `pricing-strategy.md` | Authoritative prices for Scout, Aiva, Mutant keys, and Petraclus. Unit economics review. Stripe setup scripts. | RECOMMENDED - run scripts in test mode; founder sign-off before live |
| `scout-bundling-and-ai-employee.md` | Scout Govern bundled on Aiva; AI Employee schema and seat billing (£49/mo add-on) | PENDING BUILD |

Stripe setup:
- Aiva: `aiva/02-backends/core.carinaai.uk/scripts/stripe-setup-aiva.ts`
- Mutant keys + Petraclus: `carina/keys-server/scripts/stripe-setup-keys-products.py`
- Webhooks: Aiva on `core.carinaai.uk`; keys on `keys.carinaai.uk`

### Legal documents and acceptance gate (PENDING)

| Prompt / File | What it is | Status |
|---------------|-----------|--------|
| `aiva/legal/TERMS_OF_SERVICE.md` | Terms of Service v1.0 (Verlox Ltd, England and Wales) | DRAFT - needs solicitor review |
| `aiva/legal/PRIVACY_POLICY.md` | UK GDPR Privacy Policy v1.0 | DRAFT - needs solicitor review |
| `aiva/legal/DATA_PROCESSING_AGREEMENT.md` | UK GDPR Article 28 DPA v1.0 with TOMs and sub-processor schedule | DRAFT - needs solicitor review |
| `legal-acceptance-gate.md` | In-app acceptance gate: DB schema, API, middleware, onboarding UI, re-acceptance flow, public legal pages | PENDING BUILD |

Build order: get solicitor sign-off on the three legal documents first, then build the
acceptance gate. The gate implementation does not depend on the exact content of the
documents, only on the version strings and URLs.

Before going live:
- Insert company number and registered address into all three documents.
- Confirm ICO registration number and insert it into the Privacy Policy.
- Confirm email provider sub-processor and add to Privacy Policy and DPA Schedule 3.
- Set `effective_date` in all three documents.
- Have a UK-qualified solicitor review all three before publishing.

### Cyber toolset cleanup (PENDING)

| Prompt | What it does | Status |
|--------|-------------|--------|
| `aiva-cyber-toolset-cleanup.md` | Remove offensive cyber tools from Aiva. Keep blue_team and compliance. Rename registry, update API route, update frontend cheatsheet. | PENDING |

This closes the product separation decision made 2026-06-30: active/offensive tools live
only in Petraclus. Aiva retains enterprise SOC, SIEM at scale, and org compliance only.

### Tollbooth platform sprint (TB-001 through TB-007)

Master plan: `01-devends/planning/strategy/TOLLBOOTH_PLATFORM_PLAN.md`

| Prompt | What it builds | Phase | Status |
|--------|---------------|-------|--------|
| `tollbooth/TB-001-canonical-event-schema.md` | `platform_events` table + emitter | 1 | COMPLETED 2026-06-26 |
| `tollbooth/TB-002-partner-api-keys.md` | `partner_api_keys` table + key service | 1 | COMPLETED 2026-06-26 |
| `tollbooth/TB-003-platform-api-gateway.md` | `api.carinaai.uk` gateway routes | 2 | COMPLETED 2026-06-26 |
| `tollbooth/TB-004-stripe-metered-billing.md` | Stripe usage records per event | 2 | COMPLETED 2026-06-26 |
| `tollbooth/TB-005-partner-analytics-api.md` | Usage, trends, compliance export | 2 | COMPLETED 2026-06-26 |
| `tollbooth/TB-006-skills-marketplace-submission.md` | Pack submission, approval, payout | 3 | COMPLETED 2026-06-26 |
| `tollbooth/TB-007-status-page-and-sla.md` | `status.carinaai.uk` + SLA credits | 3 | COMPLETED 2026-06-26 |

Execute in order: TB-001 and TB-002 can run in parallel. TB-003, TB-004, TB-005 require both.
TB-006 and TB-007 are Phase 3 and should only start after at least one partner is live on TB-003.

## Recently archived

| Folder / file | What it did | Completed |
|---------------|-------------|-----------|
| `archived_prompts/archives_from_pending_prompts/rag-upload/` | RAG knowledge upload API, `/knowledge` UI, `carina rag` CLI | 2026-06-26 |
| `archived_prompts/archives_from_pending_prompts/tollbooth-ui/UI-001-*.md` | Partner self-service API key CRUD in app.carinaai.uk | 2026-06-26 |
| `archived_prompts/archives_from_pending_prompts/tollbooth-ui/UI-002-*.md` | Partner usage dashboard + CSV export in app.carinaai.uk | 2026-06-26 |
| `archived_prompts/archives_from_pending_prompts/tollbooth-ui/UI-003-*.md` | Marketplace submission review queue in admin.carinaai.uk | 2026-06-26 |
| `archived_prompts/archives_from_pending_prompts/tollbooth-ui/UI-004-*.md` | Partner accounts admin (list, detail, suspend, key revoke) in admin.carinaai.uk | 2026-06-26 |
| `archived_prompts/archives_from_pending_prompts/security-patches/` | SEC-04 worker isolation, SEC-07 RASP correlation, SEC-08 pentest harness (verified 2026-07-19) | 2026-06-30 |
| `archived_prompts/archives_from_pending_prompts/security-tooling/` | Cyber tools API + `/security/tools` cheatsheet | 2026-06-26 |
| `archived_prompts/archives_from_pending_prompts/sso/` | Enterprise SSO module | 2026-06-26 |
| `archived_prompts/archives_from_pending_prompts/gtm-readiness/` | GTM-006, GTM-007 Aiva VA marketing | 2026-06-26 |
| `archived_prompts/archives_from_pending_prompts/gtm-readiness/aiva-icp-and-positioning.COMPLETED.md` | ICP positioning, landing page, compliance one-pager, property sector, demo script | 2026-06-30 |
| `archived_prompts/archives_from_pending_prompts/sprint-7-customer-onboarding-wizard.md` | Customer onboarding wizard | 2026-06-25 |
| `archived_prompts/archives_from_pending_prompts/sprint-7-admin-va-setup-wizard.md` | Admin VA setup wizard | 2026-06-25 |

Sprint-4 action backlog (29 prompts) is fully archived.

For new work, add a prompt here or under `01-devends/planning/`. VPS operator steps for
security hardening: `02-backends/core.carinaai.uk/docker/docs/VPS-SECURITY-CLOSEOUT.md`.

Checklist: `01-devends/planning/operations/CARINA_PROPRENEUR_CONVERGENCE_CHECKLIST.md`

Index: `sprint-4-action-README.md` (all 29 COMPLETED)

## Agent workflow

1. **Before you start:** Read `PATH-MAP.md`. Check `02-archived_prompts/` for COMPLETED copies.
2. **While building:** Follow `REUSE-RULES.md` for Carina voice and naming.
3. **Production deploy:** Docker Compose only (see archived Action 01). No PM2 or host nginx for Carina.
4. **When finished:** Follow `POST-BUILD-CHECKLIST.md`, then commit.

## Archive layout

```
archived_prompts/archives_from_pending_prompts/
├── rag-upload/        Knowledge upload API, UI, CLI (COMPLETED 2026-06-26)
├── security-patches/  SEC-04, SEC-07, SEC-08 (COMPLETED 2026-06-30; verified 2026-07-19)
├── security-tooling/  Cyber tools API + cheatsheet (COMPLETED 2026-06-26)
├── sprint-4/          Aiva platform (prompts 01, 05-29 except 02-04)
├── sprint-5/          aiva-billing (22, 24)
├── sprint-7/          infra (02-04)
├── sprint-7-*.md      customer onboarding + admin VA setup wizards (root of archives_from_pending_prompts/)
├── sprint-6/          Carina + Propreneur convergence (COMPLETED)
├── sprint-6-research/ Research app integration (COMPLETED)
├── sso/               Enterprise SSO module (COMPLETED 2026-06-26)
├── _reference/        audit snapshots
└── ...
```

## Agent reference

| Agent | Best for |
|-------|----------|
| **Cursor** | React/TSX, admin UI, rich components |
| **Claude Code** | TypeScript systems, backend wiring, architecture |
| **Codex** | Boilerplate, config, shell scripts, adapters |
