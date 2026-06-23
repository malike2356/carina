# COMPLETED

## What was built

- Core `brand-glossary.ts` and `brand-compat.ts` with legacy alias stripping, `resolveBrandedProductSurface()`, and `resolveAgentDisplayName()`.
- Wired into `web-context.ts`, `system-prompt.ts`, `identity-defaults.ts`, and `workspace-chrome.ts` (`injectChatShellBranding` brand override).
- App `brand-compat.ts`, workspace settings strip on save, `useBrandedTranslation()` hook, chat i18n `{agentName}` placeholders (all locales).
- Planning: `internal/planning/strategy/BRAND_GLOSSARY.md`; PRODUCT_BIBLE glossary entries for platform vs customer brand.
- Tests: `brand-compat.test.ts` (core + app), `workspace-chrome.test.ts` chat shell branding case.

---

# Prompt 08 - Brand Migration, Defaults, and Compatibility

## Objective

Migrate the current Carina surfaces toward a white-label ready naming model without breaking existing installs. This prompt handles defaults, compatibility aliases, glossary updates, and any user facing naming cleanup that must happen before release.

---

## Context

**Working areas:**

- `internal/planning/product/PRODUCT_BIBLE.md`
- `internal/planning/product/WHAT_IS_CARINA.md`
- `internal/planning/product/CARINA_CATEGORY.md`
- `internal/planning/strategy/COOKBOOK_TO_PLAYBOOK_ROADMAP.md`
- `backends/servers/core.carinaai.uk/src/agents/system-prompt.ts`
- `backends/servers/core.carinaai.uk/src/gateway/web-context.ts`
- `frontends/client-apps/app.carinaai.uk/src/lib/workspace-nav.ts`
- `frontends/client-apps/app.carinaai.uk/src/i18n/`

This prompt is not about deleting Carina. It is about making the platform ready to be branded by others while keeping Carina as the canonical internal product name.

---

## Required Work

1. Add a glossary or label mapping for platform brand versus customer brand.
2. Update user facing copy that should be customer specific, not platform specific.
3. Add compatibility aliases where old Carina names must still exist for a while.
4. Keep internal kernel names stable where the codebase depends on them.
5. Update any default metadata, page titles, or helper text that should no longer assume one global brand.
6. Add tests that verify customer brand fallback does not break ordinary Carina installs.

---

## Key Files to Update

- `internal/planning/product/PRODUCT_BIBLE.md`
- `internal/planning/strategy/`
- `backends/servers/core.carinaai.uk/src/agents/system-prompt.ts`
- `backends/servers/core.carinaai.uk/src/gateway/web-context.ts`
- `frontends/client-apps/app.carinaai.uk/src/lib/workspace-nav.ts`
- `frontends/client-apps/app.carinaai.uk/src/i18n/`
- `backends/servers/core.carinaai.uk/packages/web/src/workspace-chrome.ts`

---

## Constraints

- Do not remove Carina branding from internal documentation that needs it.
- Do not rename kernel files unless a separate migration prompt explicitly asks for it.
- Preserve current end user behavior while brand support is introduced.
- Avoid expanding the brand system beyond what prompt 01 defines.

---

## Done When

- user facing default values are white-label aware
- compatibility aliases are documented and tested
- glossary and product docs reflect the platform versus customer split
- no ordinary Carina install regresses
