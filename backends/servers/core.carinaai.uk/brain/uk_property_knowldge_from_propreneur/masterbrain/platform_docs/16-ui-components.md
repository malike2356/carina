# UI Components & Layout

## Overview

**Updated 2026-05-01:** Propreneur v2 uses Laravel Blade with **Tailwind CSS v4**, **design tokens** in `resources/css/app.css` (`--text-primary`, `--surface-base`, `--border-default`, `--color-primary`, etc.), and **Alpine.js** for interactive primitives (modals, drawers, toasts, command palette, dark mode, tables). Vite bundles Alpine from `resources/js/app.js` and `resources/js/alpine/*.js`.

Shared runtime CSS variables and client JSON are injected via `resources/views/partials/ui-runtime.blade.php` and `App\View\Composers\LayoutComposer` (`uiThemeCss`, `uiThemeClient`, `searchEndpoint`, `hydrateToasts`).

Reusable Blade pieces:

- `resources/views/components/ui/` - buttons, cards, modals, tabs, toast container, command palette, breadcrumbs, etc.
- `resources/views/components/forms/` - form field wrappers, inputs, selects aligned with `.form-input` / `.form-label` in CSS.
- `resources/views/components/portal/` - tenant dashboard widgets (deal cards, kanban, etc.).

For search UX, permission-gated command palette, and middleware-driven layout behaviour, see `brain/knowledge/16-global-search-and-ui-runtime.md`.

### Platform configuration tabs (central admin)

Pages under typed settings and platform AI keys share a horizontal tab strip: `.tab-pill-group` / `.tab-pill-active` / `.tab-pill-inactive` from `resources/css/app.css`, rendered by `resources/views/components/admin/platform-configuration-tabs.blade.php`. Link definitions live in `resources/views/partials/admin/platform-configuration-links.blade.php` (routes `admin.settings.*`, `admin.platform-settings.*`, `admin.ai.*`, `admin.setting-definitions.*`). See `brain/knowledge/15-platform-admin.md` ("Platform configuration").

**Do not** document legacy `bg-gray-50` / `text-gray-900` as the default pattern for new screens; prefer **tokens** (`text-[rgb(var(--text-primary))]`, `border-[rgb(var(--border-default))]`, `bg-[rgb(var(--surface-base))]`) and shared classes `.card`, `.btn`, `.btn-primary`, `.nav-link` defined in `resources/css/app.css`.

## Layout files (authoritative)

| Layout | Path | Used for |
|--------|------|----------|
| Tenant app | `resources/views/layouts/app.blade.php` | Workspace UI after login (sidebar + main; `nav-link`, dark sidebar). |
| Tenant public (guest) | `resources/views/layouts/public-tenant.blade.php` | Guest-safe tenant host pages (e.g. viCal public book and thanks): tokens + theme toggle + sign-in link; no sidebar or profile dropdown. |
| Platform admin | `resources/views/layouts/admin.blade.php` | Central `/admin/*` (dark chrome `bg-slate-950`, nav built in-file with feature + **platform permission** gates). |
| Auth / onboarding | `resources/views/layouts/auth.blade.php`, `layouts/onboarding.blade.php` | Login, invitations, onboarding. |

There is **no** standalone `resources/views/components/sidebar.blade.php` as the primary nav; navigation lives inside each layout.

### Tenant layout header pattern

- Sticky top bar: `page-title` from `@section('page-title')`, optional `@section('header-actions')`, `<x-ui.theme-toggle />`, `<x-nav.top-profile-menu />` (tenant variant renders **Workspace sign in** when guest; do not rely on `layouts.app` for unauthenticated tenant pages that must never call `abort(403)`).
- Optional `<x-ui.command-palette />` when `LayoutComposer` sets `searchEndpoint` (tenant search requires feature `tenant_global_search`).

### Platform admin layout

- Sidebar links are assembled in `layouts/admin.blade.php` from **feature flags** and **`PlatformUser::hasAnyPlatformPermission(...)`** (see `brain/knowledge/15-platform-admin.md`).
- Main column: `@yield('page-title')`, `@yield('header-actions')`, `@yield('content')`.
- `<x-ui.toast-container />` at end of body; Alpine toast store hydrates from session flashes.

## Component conventions

### Card

Use the `.card` utility (CSS `@layer components` in `app.css`) or the Blade component `x-ui.card` with optional `$title` and slots. Cards use `rgb(var(--surface-base))` and `border-[rgb(var(--border-subtle))]` semantics via the `.card` class.

### Tables (index pages)

Prefer token-based borders and surfaces:

- Wrapper: `card overflow-hidden` or `rounded-xl border border-[rgb(var(--border-default))] bg-[rgb(var(--surface-base))]`.
- Header row: `bg-[rgb(var(--surface-muted))]`, header text `text-[rgb(var(--text-muted))]`.
- Body: `divide-y divide-[rgb(var(--border-subtle))]`, row hover `hover:bg-[rgb(var(--surface-subtle))]`.

### Forms

Use CSS classes from `app.css`:

- `.form-label`, `.form-input`, `.form-error`, `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-danger`.

Where Blade components exist (`x-forms.input`, etc.), prefer them for consistency.

### Buttons

Primary actions: `.btn.btn-primary` (maps to `--color-primary`). Secondary: `.btn.btn-secondary`. Tenant accents often use indigo/violet in product screens; platform admin uses violet in several places; both should remain readable in dark mode.

### Empty states

Centered copy with `text-[rgb(var(--text-muted))]` and a primary CTA using `.btn.btn-primary` or `route()` to create flow.

## Pagination

Use Laravel paginator `links()` inside a footer strip with `border-t border-[rgb(var(--border-subtle))]` and padding consistent with tables.

## Vite

Entry points: `resources/css/app.css`, `resources/js/app.js` (see project root `vite.config.js` / Laravel Vite plugin).

## Responsive behaviour

Desktop-first. Tenant `layouts/app` uses a collapsible sidebar pattern (`lg:translate-x-0`, overlay on small screens). Platform admin sidebar is fixed width `w-60`.

## Related references

- Theme tokens: `config/theme_tokens.php`. Central **theme and workspace presets** hub: `/admin/ui/theme` (`admin.ui.theme`) when `admin_design_system_lab` is on; preset CRUD routes remain under `admin.theme.presets.*`. Details: `brain/knowledge/15-platform-admin.md`, `16-global-search-and-ui-runtime.md`.
- **Toggles:** `<x-forms.switch>` uses a button plus hidden `0`/`1` input for POST bodies (see component source); Light/Dark/System uses `<x-ui.theme-toggle>` and `Alpine.store('darkMode')` only (no Alpine `dark` class binding on `<html>`).
- Route names for links: `brain/knowledge/13-routes.md`, live files `routes/web.php`, `routes/tenant.php`.
