# UI Components & Layout

**Last updated:** 2026-05-16

## Overview
Propreneur uses Laravel Blade templates with Tailwind CSS v4 and Alpine.js for interactivity. Design tokens are CSS custom properties managed via `CssVariableService`. The layout includes a collapsible sidebar, top navigation, and content area.

## Core Layout

`resources/views/layouts/app.blade.php` - shared layout for all tenant pages.

**Sections:**
- `title` - page title
- `page-title` - heading in the content header
- `content` - main page content
- `scripts` - page-specific JS via `@push('scripts')`

**Components:**
- **Left sidebar:** collapsible navigation with module links, gated by `TenantNavModuleAccess` (subscription + feature flag checks)
- **Top bar:** workspace branding, global search, user menu
- **Main content:** padded container for page content
- **Floating Carina widget:** bottom-right chat panel (lazy-loaded via `GET /carina/widget/bootstrap`)
- **Toast notifications:** Alpine store `window.Alpine.store('toast')`

## Design Tokens

Defined in `config/theme_tokens.php` and injected as CSS custom properties via `CssVariableService`. Tokens scope per tenant workspace theme.

Categories:
- `--surface-base`, `--surface-subtle`, `--surface-muted` - background layers
- `--text-primary`, `--text-secondary`, `--text-muted` - text colours
- `--border-default`, `--border-subtle` - border colours
- Component-specific tokens for sidebar, cards, forms, badges

## Theme System

**Light mode default.** `CssVariableService` resolves theme per tenant using `TenantThemeOverride`, `ThemePreset`, and workspace branding settings (`GET /settings/appearance`). Theme CSS available at `GET /theme/{tenantSlug}/css`.

## Alpine.js Components

Modular Alpine components in `resources/js/alpine/`:
- `carina-show.js` - full-page Carina chat
- `kanban.js` - pipeline board drag-and-drop
- `modal.js` - reusable modal dialog
- `tabs.js` - tab switching
- `dropdown.js` - dropdown menus
- `refurb-calc.js` - refurb calculator
- `refurb-catalogue-page.js` - refurb catalogue
- `reporting-hub.js` - reporting charts
- `crm-contacts-toolbox.js` - contact bulk actions
- `investors-hub-widgets.js` - investor dashboard
- `community-hub.js` - community posts/groups
- `lms-hub.js` - course/learning path UI
- `deal-market-intelligence.js` - market data widgets
- `market-intelligence-hub.js` - market intelligence hub
- `lead-funnel-hub.js` - lead funnel UI
- `mentor-profile-editor.js` - mentor profile editing
- `workspace-team.js` - team management
- `tenant-billing-dashboard.js` - Stripe billing UI
- `tenant-subscriptions-manager.js` - subscription management
- `tenant-onboarding-flow.js` - workspace onboarding wizard

## Blade components (tenant)

| Component | Path | Purpose |
|-----------|------|---------|
| `x-tenant.view-mode-toggle` | `resources/views/components/tenant/view-mode-toggle.blade.php` | Grid/list segmented control for deal listing pages |

**Props:** `current` (`grid` \| `list`), `storageKey` (per-page `localStorage` name).

**Behaviour:** On click, saves preference to `localStorage`, then sets `view` on the current URL via `URLSearchParams` and navigates. Parent pages may run a one-shot script on load to apply `localStorage` when `view` is absent from the query string.

**Used on:** Sourced Listings (`sourced-listings-view-mode`), Deal Engine index (`deal-analysis-view-mode`). See `brain/knowledge/04-deals.md` *Listing view modes*.

## Card System

Standard `.card` pattern using design tokens:
- Background: `var(--surface-base)`
- Border: `var(--border-default)`
- Border-radius: `rounded-lg` / `rounded-xl`
- Padding: `p-4` / `p-6`

## Form Patterns

Forms follow a consistent pattern:
- Inline validation errors
- Disabled/loading states during submission
- CSRF token on all POST/PUT/DELETE forms
- Optional Alpine-enhanced inputs (select2, date pickers, conditional fields)

## Related
- `03-properties.md` - property form specifics
- `08-carina.md` - Carina chat UI, voice input waveform
- `13-routes.md` - route structure
