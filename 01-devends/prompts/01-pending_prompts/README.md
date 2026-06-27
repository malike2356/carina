# Active implementation prompts

**Updated:** 2026-06-27

`pending_prompts/` holds prompts that still need code or gap closure. Verified-complete
work lives under `archived_prompts/archives_from_pending_prompts/`.

## Active work

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
| `archived_prompts/archives_from_pending_prompts/security-tooling/` | Cyber tools API + `/security/tools` cheatsheet | 2026-06-26 |
| `archived_prompts/archives_from_pending_prompts/sso/` | Enterprise SSO module | 2026-06-26 |
| `archived_prompts/archives_from_pending_prompts/gtm-readiness/` | GTM-006, GTM-007 Aiva VA marketing | 2026-06-26 |
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
