# Prompt 02 - Branding Shell, Theme, and UI Surface

**Status: COMPLETED 2026-06-22**

**What was built:**
- `BrandProvider`, `BrandMark`, and `GET /api/brand` for runtime brand loading without rebuild
- Dynamic `generateMetadata`, PWA manifest, favicon, and title from resolved brand
- `ThemeProvider` applies workspace brand color tokens on top of preset themes
- `AppSidebar`, login, and register pages use `BrandMark` and `useBrand()`
- `workspace-chrome.ts` accepts optional brand overrides for logo, name, and accent CSS
- Shell tests in `brand-shell.test.ts` and extended `workspace-chrome.test.ts`

## Objective

Make the browser app present the correct brand per tenant and per workspace. This prompt updates the shell, login, navigation, favicon, titles, and theme behavior so the customer sees their brand first.

---

## Context

**Working areas:**

- `frontends/client-apps/app.carinaai.uk/src/app/layout.tsx`
- `frontends/client-apps/app.carinaai.uk/src/app/(auth)/login/page.tsx`
- `frontends/client-apps/app.carinaai.uk/src/app/(auth)/register/page.tsx`
- `frontends/client-apps/app.carinaai.uk/src/app/(workspace)/layout.tsx`
- `frontends/client-apps/app.carinaai.uk/src/components/shell/AppSidebar.tsx`
- `frontends/client-apps/app.carinaai.uk/src/components/shell/ThemeProvider.tsx`
- `frontends/client-apps/app.carinaai.uk/src/lib/themes.ts`
- `frontends/client-apps/app.carinaai.uk/src/lib/appearance.ts`
- `backends/servers/core.carinaai.uk/packages/web/src/workspace-chrome.ts`
- `backends/servers/core.carinaai.uk/packages/web/src/web-server.ts`

The app already supports theme selection and workspace appearance. Build on that instead of replacing it.

---

## Required Work

1. Add brand-aware metadata for the root layout and auth pages.
2. Make the app shell read brand config and display the correct product name, logo, and helper text.
3. Add tenant-specific theme tokens or brand overrides without breaking existing themes.
4. Support customer logos and favicons in the browser workspace and hosted chrome surface.
5. Make the sidebar, header, and shell labels use brand values when available.
6. Keep the theme selector and appearance settings working for unbranded installs.
7. Add tests for branded versus default rendering.

---

## Key Files to Update

- `frontends/client-apps/app.carinaai.uk/src/app/layout.tsx`
- `frontends/client-apps/app.carinaai.uk/src/app/(workspace)/layout.tsx`
- `frontends/client-apps/app.carinaai.uk/src/components/shell/AppSidebar.tsx`
- `frontends/client-apps/app.carinaai.uk/src/components/settings/AppearanceSettings.tsx`
- `frontends/client-apps/app.carinaai.uk/src/components/shell/ThemeProvider.tsx`
- `frontends/client-apps/app.carinaai.uk/src/components/shell/CoreSurfaceBanner.tsx`
- `backends/servers/core.carinaai.uk/packages/web/src/workspace-chrome.ts`
- `backends/servers/core.carinaai.uk/packages/web/src/workspace-chrome.test.ts`

---

## Constraints

- Do not break the current dark, light, midnight, or forest themes.
- Do not introduce a second settings system for brand and theme if the existing workspace settings can carry the data.
- Do not hardcode customer names into the app.
- Keep the default Carina look intact for installations that have no white-label data.

---

## Done When

- root layout title and metadata can reflect customer brand
- login and workspace surfaces can show customer branding
- theme and appearance still work for ordinary Carina installs
- the shell has tests for default and branded cases
- favicon and logo swapping works without a rebuild per tenant

