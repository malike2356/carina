# Sprint 3: White-Label Carina

**Date:** 2026-06-22
**Status:** PROMPTS WRITTEN - Ready for implementation
**Total Prompts:** 9
**Primary agent:** Cursor

This sprint turns Carina into a white-label platform that agencies, consultancies, and niche operators can resell under their own brand. The prompts are written against the current codebase, not a hypothetical rewrite. Use the existing hosted workspace, billing, tenant, theme, docs, and Docker infrastructure as the base.

The target shape is:

- Carina stays the kernel and control plane
- customers own the brand, domain, and commercial packaging
- partner accounts can resell branded workspaces
- tenant isolation stays explicit and Docker-first
- customer-facing surfaces stop assuming one global Carina brand

---

## Post-build (MANDATORY)

When a prompt is complete:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of the prompt file.
2. Add a short `What was built:` list.
3. Move the prompt file from `pending_prompts/` to `archived_prompts/pending_prompts/` keeping the same relative path. Use `git mv` when possible.
4. If the whole sprint is complete, move this README the same way.
5. Do not leave completed prompts in `pending_prompts/`.

Full checklist: `carina/internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`

---

## Working Rules

- Treat `frontends/client-apps/app.carinaai.uk/` as the customer workspace surface.
- Treat `backends/servers/core.carinaai.uk/` as the kernel and hosted engine.
- Treat `backends/admin/ops.carinaai.uk/` as private internal operations, not white-label customer UI.
- Do not create a parallel app if the existing app can be extended.
- Preserve current tenant isolation, hosted mode, and billing contracts unless a prompt explicitly changes them.
- Write customer-facing copy in Carina voice, but allow customer brand names at the outer edge.

---

## Prompt Inventory

| # | File | Focus | Agent | Depends On |
|---|------|-------|-------|------------|
| 01 | `01-white-label-foundation-and-tenant-model.md` | Brand config, tenant model, data contract, platform boundaries | Cursor | nothing |
| 02 | `02-branding-shell-theme-and-ui-surface.md` | App shell, login, navigation, theme, logo, favicon, brand injection | Cursor | 01 |
| 03 | `03-custom-domains-email-and-public-facing-surface.md` | Custom domains, sender identity, public pages, cert and route plumbing | Cursor | 01 |
| 04 | `04-billing-plans-reseller-and-partner-mode.md` | Plans, usage, reseller accounts, partner pricing, billing UI | Cursor | 01 |
| 05 | `05-packs-marketplace-and-vertical-templates.md` | Vertical bundles, marketplace, starter packs, workspace templates | Cursor | 01, 02 |
| 06 | `06-docker-deploy-isolation-and-ops-scoping.md` | Per-tenant deploys, stack isolation, envs, networks, ops panel scoping | Cursor | 01 |
| 07 | `07-docs-onboarding-and-customer-handoff.md` | Docs, onboarding, support, customer handoff, white-label help copy | Cursor | 02, 03, 04 |
| 08 | `08-brand-migration-defaults-and-compatibility.md` | Carina defaults, naming migration, compatibility aliases, glossary | Cursor | 01, 02, 07 |
| 09 | `09-verification-smoke-tests-and-release-guardrails.md` | Tests, smoke checks, CI guards, release gates, demo tenant validation | Cursor | 01-08 |

---

## Execution Order

Start with 01. Then run 02, 03, and 04 in parallel if the branch shape allows it. 05 depends on the branding surface from 02. 06 can run alongside 02 and 03 if the deploy work is isolated. 07 and 08 should wait for the customer-facing surfaces to settle. 09 is the last gate.

