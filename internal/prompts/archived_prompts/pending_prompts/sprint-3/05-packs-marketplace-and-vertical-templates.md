# COMPLETED

## What was built

- Core pack ownership model (`pack-ownership.ts`), vertical templates (`vertical-templates.ts`), and storefront builder (`pack-storefront.ts`) with Vitest coverage.
- Hosted `partner_accounts.pack_catalog` migration and `partner-pack-catalog.ts` service.
- Core APIs: `/api/marketplace/storefront`, `/api/carina-ops/packs/storefront`, catalog PUT, template install, pack toggle.
- Cloud app: migration `0011_pack_catalog.sql`, `/packs` storefront page, marketplace API routes, nav/settings/library/skills links.
- Docs: `frontends/marketing/docs.carinaai.uk/docs/user/white-label-skill-packs.md`.

---

# Prompt 05 - Packs, Marketplace, and Vertical Templates

## Objective

Make the commercial product layer about selling vertical agent packs and templates, not just a generic chat app. White-label buyers should be able to ship their own version of Carina with their own workflows.

---

## Context

**Working areas:**

- `backends/servers/core.carinaai.uk/src/skills/`
- `backends/servers/core.carinaai.uk/packages/packs/`
- `backends/servers/core.carinaai.uk/src/plugin-sdk/`
- `backends/servers/core.carinaai.uk/src/agents/`
- `frontends/client-apps/app.carinaai.uk/src/app/(workspace)/library/page.tsx`
- `frontends/client-apps/app.carinaai.uk/src/app/(workspace)/dashboard/page.tsx`
- `frontends/client-apps/app.carinaai.uk/src/components/panels/`
- `frontends/marketing/docs.carinaai.uk/docs/user/`

The codebase already has packs, skills, workspace views, and hosted management. This prompt should connect them into a white-label marketplace and template system.

---

## Required Work

1. Define tenant level pack templates for common verticals.
2. Add a storefront or library flow that can present partner packs under the customer brand.
3. Support vertical specific starter bundles such as property, legal, finance, recruitment, healthcare, and support.
4. Add the ability to mark certain packs as platform owned, reseller owned, or customer owned.
5. Wire pack install, update, and visibility rules to workspace and partner context.
6. Add tests for pack ownership, visibility, and template loading.

---

## Key Files to Update

- `backends/servers/core.carinaai.uk/src/skills/hub/`
- `backends/servers/core.carinaai.uk/packages/packs/`
- `backends/servers/core.carinaai.uk/src/plugin-sdk/`
- `frontends/client-apps/app.carinaai.uk/src/app/(workspace)/library/page.tsx`
- `frontends/client-apps/app.carinaai.uk/src/app/(workspace)/settings/page.tsx`
- `frontends/client-apps/app.carinaai.uk/src/components/panels/SkillsPanel.tsx`
- `frontends/marketing/docs.carinaai.uk/docs/user/skills/`

---

## Constraints

- Do not let customer packs break the kernel pack format.
- Do not force a marketplace if the deployment is single customer and self-hosted.
- Keep customer-owned packs separate from platform default packs.
- Preserve the existing skills and packs install flows.

---

## Done When

- vertical template bundles can be represented and installed
- pack ownership is tracked at the right layer
- white-label workspaces can show partner or customer packs cleanly
- tests cover install, visibility, and ownership behavior
