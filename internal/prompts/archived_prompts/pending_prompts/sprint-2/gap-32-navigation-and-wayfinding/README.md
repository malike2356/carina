**Status: COMPLETED 2026-06-21**

**What was built:** Full NAV_ROUTES config, breadcrumb bar, sidebar nav groups (23 routes), command palette nav actions, settings API keys PageHeader.

# Gap 32: Navigation and Wayfinding

**Date:** 2026-06-21
**Status:** COMPLETED 2026-06-21
**Total Prompts:** 4
**Estimated Days:** 3-4 with 1 agent (Claude Code)

---

## Post-build (MANDATORY)

When all "Done When" criteria in this prompt are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file (use today's date).
2. Add a "**What was built:**" bullet list of key files or features shipped.
3. Move this file from `carina/internal/prompts/pending_prompts/` to `carina/internal/prompts/archived_prompts/pending_prompts/`, keeping the same relative path. Use `git mv` when possible.
4. If every prompt in this gap folder is COMPLETED, move the whole gap folder and update its `README.md` the same way.
5. Do not leave completed prompts in `pending_prompts/`; agents treat that folder as active work only.

Full checklist: `carina/internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`


## The Problem

The app at app.carinaai.uk has 23 distinct routes. Only 7 appear in the sidebar. The remaining
16 routes - billing, analytics, security, MCP servers, webhooks, logs, environment, files,
email, cron, scheduled, library, profiles, terminal, and all three settings sub-pages - exist
behind a single Settings page that doubles as a navigation hub.

This creates three concrete user experience failures:

**Users do not know features exist.** If you do not already know that `/cron` is for scheduled
automations or that `/mcp` connects tool servers, you will never find them. There is no menu
that shows you the full capability surface of the product.

**Users cannot tell where they are.** Open `/analytics`. Nothing in the sidebar lights up. The
page has a title but no indication of how it relates to the rest of the app. There is no way to
navigate "up" to a parent, no breadcrumb, no section label. You are stranded on an island.

**Backtracking is manual.** On `/settings/keys`, the only way back to settings is the browser
back button. On `/documents/abc123`, there is no "back to all documents" link. In a nested
session the sidebar does not consistently highlight the active entry.

---

## What Exists (Do Not Break)

- `src/lib/workspace-nav.ts` - `SIDEBAR_TOOLS`, `SETTINGS_SECTION_LINKS`, types
- `src/components/shell/AppSidebar.tsx` - full sidebar component (session list + 7 tools)
- `src/components/shell/CommandPalette.tsx` - Ctrl+K palette with ~10 static actions
- `src/(workspace)/layout.tsx` - workspace shell: sidebar + main + panels
- `src/app/globals.css` - Tailwind v4, CSS custom properties for theming
- All 23 page components under `src/app/(workspace)/`

---

## Prompt Order and Dependencies

```
Prompt 01: Navigation config as single source of truth
    - Extend workspace-nav.ts with full route inventory, groups,
      breadcrumb parents, and icons for every route
    - No UI changes yet. Purely additive to the config file.
    - No dependencies.

Prompt 02: Breadcrumb component and PageHeader component
    - Breadcrumb.tsx: derives trail from pathname using the config
    - PageHeader.tsx: consistent title + description + back + actions
    - Wire Breadcrumb into the workspace layout
    - Depends on Prompt 01.

Prompt 03: Sidebar nav groups redesign
    - Add collapsible nav group sections below the session list
    - All 23 routes are now visible in the sidebar
    - Active state highlights the current route at all times
    - Collapsed sidebar: group icons with tooltip flyouts
    - Depends on Prompt 01.

Prompt 04: Command palette full nav + settings sub-page back links
    - Add all 23 routes as navigable palette actions
    - Group them by section in the palette results
    - Add back-link navigation to settings sub-pages
    - Depends on Prompt 01.
```

---

## Acceptance Criteria (for the whole gap)

1. Open `/analytics`. The sidebar highlights "Analytics" in the Account section. A breadcrumb
   at the top reads "Account / Analytics". The page has a consistent title and description.

2. Open `/settings/keys`. A breadcrumb reads "Settings / API Keys". A back link or the
   breadcrumb allows one click back to `/settings`.

3. Open `/documents/abc123`. A breadcrumb reads "Documents / [document title]" with
   "Documents" as a clickable link back to `/documents`.

4. Open the command palette (Ctrl+K) and type "cron". The action "Open cron" appears
   immediately. Every route in the app is findable via the palette.

5. Collapse the sidebar. All nav groups are still accessible as icon buttons with tooltips.
   The active group's icon is highlighted in accent colour.

6. Open any route that previously had no header (e.g. `/files`, `/email`, `/cron`,
   `/library`). A PageHeader with a title and a one-line description is visible at the top.

7. Navigate from `/settings` to `/settings/pairing` and back. The breadcrumb works. There is
   no need to use the browser back button for in-app navigation.
