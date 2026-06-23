# COMPLETED

## What was built

- White-label docs hub under `docs/user/white-label/` (getting started, branding, domains, packs, billing, partner/reseller, handoff, support/troubleshooting).
- Sidebar, footer, getting-started, carina-cloud, troubleshooting, and onboarding cross-links.
- Core `README.md` and `README.cli.md` pointers; `carinaai.uk/partners` link to operator guide.
- App: **Settings > Brand** (`BrandSettings.tsx`), launcher setup checklist (`WorkspaceOnboardingCard.tsx`), branded login/home copy, `workspace-onboarding.ts` tests.

---

# Prompt 07 - Docs, Onboarding, and Customer Handoff

## Objective

Write the customer facing documentation and onboarding flow for white-label Carina. Buyers should know how to launch, brand, hand off, support, and resell the product without reading internal notes.

---

## Context

**Working areas:**

- `frontends/marketing/docs.carinaai.uk/`
- `frontends/marketing/carinaai.uk/`
- `frontends/client-apps/app.carinaai.uk/src/app/(workspace)/settings/`
- `backends/servers/core.carinaai.uk/docs/`
- `backends/servers/core.carinaai.uk/README.cli.md`
- `backends/servers/core.carinaai.uk/README.md`
- `internal/planning/white-label-plan/01-white-label.md`

The repo already has user docs, self-host docs, and product docs. This prompt should produce white-label specific guidance that fits the current documentation system.

---

## Required Work

1. Add a white-label getting started path for agencies and partner operators.
2. Explain branding, domain binding, billing, and workspace setup in customer terms.
3. Add support and handoff docs that explain what the customer controls and what Carina controls.
4. Add reseller and partner documentation that explains how to onboard client workspaces.
5. Update onboarding copy in app and docs so the branding language is consistent.
6. Add FAQ and troubleshooting entries for white-label installs.

---

## Key Files to Update

- `frontends/marketing/docs.carinaai.uk/docs/`
- `frontends/marketing/carinaai.uk/`
- `backends/servers/core.carinaai.uk/docs/`
- `backends/servers/core.carinaai.uk/README.cli.md`
- `backends/servers/core.carinaai.uk/README.md`
- `frontends/client-apps/app.carinaai.uk/src/app/(workspace)/settings/page.tsx`
- `frontends/client-apps/app.carinaai.uk/src/components/settings/`

---

## Constraints

- Customer docs should not leak internal implementation names unless the reader is an operator.
- Keep the language commercial, clear, and direct.
- Do not describe features the codebase cannot yet provide.
- Make the docs useful for both self-hosted and managed white-label customers.

---

## Done When

- there is a clear white-label onboarding path in docs
- reseller handoff guidance exists
- support and troubleshooting content is written for branded deployments
- app onboarding copy matches the docs
