**Status: COMPLETED 2026-06-21**


# Gap 12 - Prompt 02: Breadcrumb and PageHeader Components

**Gap:** 12 Navigation and Wayfinding
**Prompt number:** 02 of 04
**Name:** Breadcrumb and PageHeader Components
**Primary agent:** Claude Code
**Estimated hours:** 3-5 h
**Depends on:** Prompt 01 (NAV_ROUTES, getBreadcrumbs, getActiveRoute in workspace-nav.ts)

---

## Post-build (MANDATORY)

When all "Done When" criteria in this prompt are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file (use today's date).
2. Add a "**What was built:**" bullet list of key files or features shipped.
3. Move this file from `carina/internal/prompts/pending_prompts/` to `carina/internal/prompts/archived_prompts/pending_prompts/`, keeping the same relative path. Use `git mv` when possible.
4. If every prompt in this gap folder is COMPLETED, move the whole gap folder and update its `README.md` the same way.
5. Do not leave completed prompts in `pending_prompts/`; agents treat that folder as active work only.

Full checklist: `carina/internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`


## Read First

Before writing a single line, read:

1. `app.carinaai.uk/src/lib/workspace-nav.ts` - `getBreadcrumbs()`, `getActiveRoute()`, `NAV_ROUTES`
2. `app.carinaai.uk/src/app/(workspace)/layout.tsx` - where the Breadcrumb must be wired
3. `app.carinaai.uk/src/app/globals.css` - CSS variables: `--bg-surface`, `--border-subtle`,
   `--text-primary`, `--text-muted`, `--text-secondary`, `--accent`, etc.
4. Every file under `app.carinaai.uk/src/app/(workspace)/` - read each page.tsx to understand
   what header/title patterns already exist (some pages have an inline h1, some have nothing)
5. `app.carinaai.uk/src/components/shell/AppSidebar.tsx` - understand the sidebar height and
   fixed/flex layout to know where the breadcrumb bar sits without overlapping

All paths are relative to `/opt/lampp/htdocs/verlox/carina/external/client-apps/`.

---

## Context

This prompt adds two new components and wires them into the layout:

**Breadcrumb**: A thin bar at the top of the content area, always visible on non-chat pages,
showing the current location trail. Each ancestor is a clickable link. The current page is
plain text (not a link).

**PageHeader**: A reusable section header component for pages that currently lack one. It
renders a page title, optional one-line description, optional back button, and an optional
right-side actions slot. It is NOT the same as the breadcrumb - the breadcrumb is global and
persistent, the PageHeader is per-page and optional.

Pages with sparse or no header that need PageHeader added:
- `/files` (FilesPage.tsx - check if it has a title)
- `/email` (check)
- `/cron` (CronPage.tsx - check)
- `/library` (check)
- `/logs` (LogsPage.tsx - check)
- `/env` (EnvironmentPage.tsx - check)
- `/webhooks` (WebhooksManager.tsx - check)
- `/mcp` (McpPage.tsx - check)
- `/analytics` (AnalyticsDashboard.tsx - check)
- `/security` (SecurityDashboardClient.tsx - check)

For each page, READ the component first. If it already has a clear `<h1>` or title section
at the top with a description, skip it. Only add PageHeader where the page truly has nothing
consistent.

---

## Step 1: Breadcrumb Component

Create `app.carinaai.uk/src/components/shell/Breadcrumb.tsx`:

```tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { getBreadcrumbs, getActiveRoute } from '@/lib/workspace-nav';

interface BreadcrumbProps {
  // Optional page-specific title to override the last crumb.
  // Use this when rendering a dynamic route (e.g., document title instead of empty string).
  pageTitle?: string;
}

export function Breadcrumb({ pageTitle }: BreadcrumbProps) {
  const pathname = usePathname();

  // Do not render breadcrumbs inside the chat view - the session header handles that context.
  if (pathname.startsWith('/chat/') || pathname === '/chat') return null;

  const crumbs = getBreadcrumbs(pathname);

  // No crumbs means the route is not in the nav config (e.g., /dashboard root).
  // Show nothing rather than an empty bar.
  if (crumbs.length === 0) return null;

  // A single crumb with no parent is the current top-level page.
  // Only render if there is a meaningful trail (more than 1 crumb) OR if pageTitle is set.
  const hasTrail = crumbs.length > 1 || Boolean(pageTitle);
  if (!hasTrail) return null;

  return (
    <nav
      aria-label="Breadcrumb"
      className="flex items-center gap-1.5 border-b border-border bg-surface px-4 py-2 text-xs text-text-muted"
    >
      {crumbs.map((crumb, index) => {
        const isLast = index === crumbs.length - 1;
        const label = isLast && pageTitle ? pageTitle : crumb.label;

        return (
          <span key={crumb.href} className="flex items-center gap-1.5">
            {index > 0 && <ChevronRight className="h-3 w-3 text-text-muted" aria-hidden />}
            {isLast ? (
              <span className="font-medium text-text-secondary" aria-current="page">
                {label || 'Loading...'}
              </span>
            ) : (
              <Link
                href={crumb.href}
                className="transition-colors hover:text-text-primary hover:underline underline-offset-2"
              >
                {crumb.label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
```

Design constraints:
- The bar is 32-36px tall (py-2 + text-xs = ~32px). Thin enough not to steal space.
- Background matches `--bg-surface`, not `--bg-base`, so it reads as part of the chrome.
- No icons in the breadcrumb trail - text only. Icons would make it feel like a nav bar.
- The separator is a `ChevronRight` icon, not a `/` character (more legible at small size).
- On mobile (< 640px), truncate middle crumbs with `...` - show first and last only.
  Implement with a simple responsive class: hide middle crumbs with `hidden sm:flex`.

---

## Step 2: PageHeader Component

Create `app.carinaai.uk/src/components/shell/PageHeader.tsx`:

```tsx
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

interface PageHeaderProps {
  title: string;
  description?: string;
  backHref?: string;
  backLabel?: string;
  actions?: React.ReactNode;
}

export function PageHeader({ title, description, backHref, backLabel, actions }: PageHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-border">
      <div className="min-w-0 flex-1">
        {backHref && (
          <Link
            href={backHref}
            className="mb-2 flex items-center gap-1 text-xs text-text-muted transition-colors hover:text-text-secondary"
          >
            <ArrowLeft className="h-3 w-3" />
            {backLabel ?? 'Back'}
          </Link>
        )}
        <h1 className="text-base font-semibold text-text-primary">{title}</h1>
        {description && (
          <p className="mt-0.5 text-xs text-text-muted leading-relaxed">{description}</p>
        )}
      </div>
      {actions && (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      )}
    </div>
  );
}
```

Usage pattern (example for a page that currently has no header):

```tsx
// In src/app/(workspace)/webhooks/page.tsx (or wherever the client component is)
import { PageHeader } from '@/components/shell/PageHeader';

// At the top of the page render, before existing content:
<PageHeader
  title="Webhooks"
  description="Outbound HTTP subscriptions that fire on workspace events."
/>
```

---

## Step 3: Wire Breadcrumb Into the Workspace Layout

Edit `app.carinaai.uk/src/app/(workspace)/layout.tsx`.

The current `<main>` is:
```tsx
<main className="flex flex-1 flex-col min-w-0 overflow-hidden">
  <KeysBanner />
  <PanelProvider>{children}</PanelProvider>
</main>
```

Change it to:
```tsx
<main className="flex flex-1 flex-col min-w-0 overflow-hidden">
  <KeysBanner />
  <Breadcrumb />
  <PanelProvider>{children}</PanelProvider>
</main>
```

Import at the top:
```tsx
import { Breadcrumb } from '@/components/shell/Breadcrumb';
```

The `Breadcrumb` component is client-only (`'use client'`) so it handles the `usePathname()`
call. The layout itself remains a server component.

---

## Step 4: Dynamic Breadcrumb for Documents Sub-pages

The `/documents/[id]` route renders a dynamic document. The breadcrumb trail for it should be:
`Documents / [document title]` where the document title comes from the page.

Since the breadcrumb lives in the layout (above children), the child page cannot pass the title
up via props in the standard Next.js App Router. Use one of these two approaches:

**Approach A (recommended): Metadata in layout via searchParam**
The `/documents/[id]` page receives the document title as a server prop. Add a
`data-page-title` attribute on the page wrapper and read it in the Breadcrumb via
`document.querySelector('[data-page-title]')?.dataset.pageTitle`. This is a lightweight
DOM read and avoids a context API.

```tsx
// In src/app/(workspace)/documents/[id]/page.tsx
// Wrap the root div:
<div data-page-title={document.title}>
  ...existing content...
</div>
```

```tsx
// In Breadcrumb.tsx, for the last crumb with an empty label, add a useEffect:
const [dynamicTitle, setDynamicTitle] = useState('');
useEffect(() => {
  const el = document.querySelector<HTMLElement>('[data-page-title]');
  if (el?.dataset.pageTitle) setDynamicTitle(el.dataset.pageTitle);
}, [pathname]);
// Then use: const label = isLast ? (pageTitle ?? dynamicTitle || 'Loading...') : crumb.label;
```

**Approach B (alternative): BreadcrumbTitle component**
Create a tiny `BreadcrumbTitle` client component that accepts a title string and writes it to
a shared atom/context. The Breadcrumb reads from the same context.

If approach A feels hacky, use approach B with a simple React context:
- `BreadcrumbTitleContext` with `useState('')`
- `BreadcrumbTitleProvider` wraps the layout
- `useBreadcrumbTitle(title: string)` hook called from child pages

Pick whichever approach feels cleanest given the existing codebase patterns.

---

## Step 5: Add PageHeader to Pages That Lack One

For each of the following pages, READ the component first to confirm it has no clear title/h1.
If it already has a consistent title, skip it. If it does not, add PageHeader as the first
element inside the page's root container.

Pages to audit and fix:

| Route | Component file | Title to add | Description to add |
|-------|----------------|-------------|-------------------|
| /files | `src/components/files/FilesPage.tsx` | "Files" | "Upload, browse, and manage workspace files." |
| /email | `src/app/(workspace)/email/page.tsx` or wherever | "Email" | "Inbound messages and triage queue." |
| /cron | `src/components/cron/CronPage.tsx` | "Cron jobs" | "Recurring automations running on a schedule." |
| /library | check file | "Library" | "Saved knowledge, memory exports, and reference material." |
| /logs | `src/components/logs/LogsPage.tsx` | "Logs" | "Application events and audit log stream." |
| /env | `src/components/environment/EnvironmentPage.tsx` | "Environment" | "Runtime configuration variables for this workspace." |
| /webhooks | `src/components/webhooks/WebhooksManager.tsx` | "Webhooks" | "Outbound HTTP subscriptions that fire on workspace events." |
| /mcp | `src/components/mcp/McpPage.tsx` | "MCP servers" | "Connect external tool servers via Model Context Protocol." |
| /analytics | `src/components/analytics/AnalyticsDashboard.tsx` | "Analytics" | "Token usage, session activity, and workspace metrics." |
| /profiles | `src/components/profiles/ProfilesManager.tsx` | "Profiles" | "Workspace personas and per-profile model defaults." |
| /scheduled | check file | "Scheduled" | "Upcoming and queued automation runs." |

Do NOT add PageHeader to:
- `/chat` or `/chat/[sessionId]` - the `SessionHeader` component handles that
- `/settings` - settings already has its own nav panel layout
- `/dashboard` - dashboard has its own structure
- `/billing` - check if BillingClient.tsx already has a header

For settings sub-pages `/settings/keys`, `/settings/calendar`, `/settings/pairing`:
Add PageHeader with `backHref="/settings"` and `backLabel="Settings"`:

```tsx
// In src/app/(workspace)/settings/keys/page.tsx (or the client component it renders)
<PageHeader
  title="API keys"
  description="Manage your bring-your-own-key API credentials."
  backHref="/settings"
  backLabel="Settings"
/>
```

---

## Verification

```bash
# TypeScript compiles cleanly
cd app.carinaai.uk && npx tsc --noEmit 2>&1 | grep error | head -10

# Build succeeds
npm run build 2>&1 | tail -10
```

Manual test:
1. Navigate to `/analytics`. A breadcrumb bar appears above the content reading "Analytics".
   The bar does NOT appear on `/chat` or `/chat/[sessionId]`.
2. Navigate to `/settings/keys`. The breadcrumb reads "Settings / API keys" with "Settings"
   as a clickable link to `/settings`. The page has a "Back to Settings" link.
3. Navigate to `/documents/[any-real-doc-id]`. The breadcrumb reads
   "Documents / [document title]" with "Documents" as a clickable link.
4. Navigate to `/files`. A PageHeader with title "Files" is visible at the top.
5. Check the layout does not shift or break on `/chat` routes (breadcrumb must return null).
