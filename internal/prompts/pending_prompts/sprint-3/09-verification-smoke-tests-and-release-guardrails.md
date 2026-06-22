# Prompt 09 - Verification, Smoke Tests, and Release Guardrails

## Objective

Add the verification layer that proves white-label Carina is actually safe to ship. This is the last prompt in the sprint and should fail the release if the white-label contract leaks across tenants or host stacks.

---

## Context

**Working areas:**

- `scripts/`
- `backends/admin/ops.carinaai.uk/lib/`
- `frontends/client-apps/app.carinaai.uk/scripts/`
- `backends/servers/core.carinaai.uk/scripts/`
- `frontends/marketing/docs.carinaai.uk/docs/`
- `internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`

The repo already has smoke tests and style checks. Extend those checks to cover the white-label boundary.

---

## Required Work

1. Add a white-label verification script that checks branding, domain, and tenant scope.
2. Add smoke tests for the branded app shell, login, workspace settings, and billing surfaces.
3. Add ops checks that prove the service list remains scoped to allowed projects.
4. Add a release guard for customer facing copy so the wrong brand does not leak into shipped text.
5. Add a smoke path for a demo tenant or sample reseller deployment.
6. Wire the new verification into the appropriate CI or local runbook scripts.

---

## Key Files to Update

- `scripts/`
- `backends/admin/ops.carinaai.uk/lib/server-services.test.ts`
- `backends/admin/ops.carinaai.uk/views/server/services.ejs`
- `frontends/client-apps/app.carinaai.uk/scripts/`
- `backends/servers/core.carinaai.uk/scripts/`
- `frontends/marketing/docs.carinaai.uk/docs/`

---

## Constraints

- Verify the current codebase, not the idealized plan.
- Smoke tests should cover real customer entry points, not only internal helpers.
- Do not let the white-label checks depend on secrets that are not already used by the app.
- Keep the guardrails maintainable so they do not become dead weight.

---

## Done When

- a verification script catches brand or tenant leakage
- app and ops smoke tests cover the white-label flow
- release scripts fail when the boundary is broken
- the sprint can be shipped with confidence

