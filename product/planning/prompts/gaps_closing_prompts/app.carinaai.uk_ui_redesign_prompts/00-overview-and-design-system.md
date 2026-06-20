# Prompt 00 - Overview and Design System

## Context for Every Prompt in This Series

You are working on `app.carinaai.uk`, the customer-facing web application for the Carina AI platform. This is a Next.js 14+ App Router application using TypeScript, Tailwind CSS, and Drizzle ORM with PostgreSQL.

**Working directory for all tasks in this series:** `/opt/lampp/htdocs/verlox/carina/app.carinaai.uk`

**What this app is:** A self-hosted AI chat interface for property professionals. Carina is an AI agent that helps with property research, document handling, and client management. The backend AI agent runs in `core.carinaai.uk` (a separate service). This app handles auth, billing, workspace management, and the user-facing chat UI.

**Current state (as of this redesign):** The app has auth, billing, and a basic chat panel. The chat has a textarea and a Send button. No session history, no tool call visibility, no memory panel, no sidebar session list - essentially a proof of concept. This entire series of prompts transforms it into a competitive product.

**Competitor reference:** We studied Odysseus (a polished open-source AI UI). This redesign closes every material gap. Do not copy Odysseus's pink/coral colour scheme or branding. Use Carina's identity.

---

## Existing File Structure

```
src/
  app/
    api/
      auth/[...all]/route.ts   - better-auth handler
      chat/route.ts            - POST, SSE streaming chat
      webhooks/stripe/route.ts
    (auth)/
      login/page.tsx
      register/page.tsx
    (workspace)/
      layout.tsx               - workspace shell (WILL BE REPLACED in Prompt 02)
      dashboard/page.tsx
      billing/page.tsx
      security/page.tsx
      settings/page.tsx
      settings/keys/page.tsx
    billing/checkout/route.ts
    globals.css
    layout.tsx                 - root layout
    page.tsx                   - redirects to /dashboard
    __hub-proxy/[[...path]]/route.ts
  components/
    billing/BillingClient.tsx
    billing/PlanCard.tsx
    billing/UsageMeter.tsx
    chat/ChatPanel.tsx         - WILL BE REPLACED in Prompt 04
    chat/StreamingMessage.tsx
    ui/button.tsx
    ui/card.tsx
    ui/dialog.tsx
    ui/input.tsx
    ui/label.tsx
    ui/progress.tsx
    vault/AddKeyDialog.tsx
    vault/DeleteKeyButton.tsx
    vault/KeyRow.tsx
  db/
    index.ts
    schema.ts                  - Drizzle schema (EXTENDED in Prompt 01)
  lib/
    actions.ts
    audit.ts
    auth-client.ts
    auth.ts
    carina-chat.ts             - streaming chat logic
    keys.ts
    plans.ts
    provider-env.ts
```

---

## Design System - Apply Across All Prompts

### Colour Tokens

Define these as CSS custom properties in `src/app/globals.css`, replacing the existing light-theme slate colours:

```css
:root {
  /* Backgrounds */
  --bg-base:     #0f1117; /* page background */
  --bg-surface:  #161921; /* panels, cards */
  --bg-elevated: #1e2130; /* hover states, input backgrounds */
  --bg-overlay:  #252838; /* dropdowns, tooltips */

  /* Borders */
  --border-subtle:  #2a2d3e; /* default borders */
  --border-focus:   #22c55e; /* focus rings, active states */
  --border-muted:   #1e2130; /* very quiet dividers */

  /* Text */
  --text-primary:   #f0f2f5; /* headings, body */
  --text-secondary: #8b92a5; /* labels, metadata */
  --text-muted:     #4a5068; /* placeholders, timestamps */

  /* Accent - Carina green */
  --accent:         #22c55e;
  --accent-dim:     #166534; /* accent at low opacity */
  --accent-hover:   #16a34a;

  /* Danger */
  --danger:         #ef4444;
  --danger-dim:     #7f1d1d;

  /* Chat bubbles */
  --bubble-user:      #1e3a2f; /* dark green, right-aligned */
  --bubble-assistant: #1a1d2e; /* dark surface, left-aligned */

  /* Syntax / code */
  --code-bg:    #0d1117;
  --code-text:  #e6edf3;
}
```

### Tailwind Mapping

In `tailwind.config.ts`, extend with the CSS variables:

```ts
colors: {
  base:      'var(--bg-base)',
  surface:   'var(--bg-surface)',
  elevated:  'var(--bg-elevated)',
  overlay:   'var(--bg-overlay)',
  border:    { DEFAULT: 'var(--border-subtle)', focus: 'var(--border-focus)', muted: 'var(--border-muted)' },
  text:      { primary: 'var(--text-primary)', secondary: 'var(--text-secondary)', muted: 'var(--text-muted)' },
  accent:    { DEFAULT: 'var(--accent)', dim: 'var(--accent-dim)', hover: 'var(--accent-hover)' },
  danger:    { DEFAULT: 'var(--danger)', dim: 'var(--danger-dim)' },
  bubble:    { user: 'var(--bubble-user)', assistant: 'var(--bubble-assistant)' },
  code:      { bg: 'var(--code-bg)', text: 'var(--code-text)' },
}
```

### Typography

- Body: `font-sans` (Inter or system-ui)
- Code / tool output / session IDs: `font-mono`
- No emojis in UI text
- No em dashes or en dashes anywhere - use hyphens, colons, or sentence breaks

### Spacing

Use 4px grid exclusively (Tailwind default). Never use arbitrary pixel values in className strings unless absolutely necessary.

### Border Radius

- Panels, cards: `rounded-lg` (8px)
- Buttons: `rounded-md` (6px)
- Input fields: `rounded-md`
- Message bubbles: `rounded-2xl` user, `rounded-2xl` assistant (but square on inner corners via conditional rounding)
- Chips/badges: `rounded-full`

### Focus States

Always use `focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none` on interactive elements. Never use browser default outlines.

### Scrollbars

Add to `globals.css`:
```css
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--border-subtle); border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: var(--text-muted); }
```

### Panel / Overlay System

All tools (Memory, Skills, Notes, Research, Tasks) open as floating panels anchored to the right side or as full-screen overlays on mobile. They use a consistent wrapper:

```tsx
// src/components/ui/Panel.tsx
// Props: title, icon, onClose, children, width? (default 360px)
// Renders: fixed right-anchored overlay with header, close button, scrollable body
// Backdrop: semi-transparent click-to-close
// Animation: slide in from right (translate-x-full -> translate-x-0), 200ms ease-out
```

### Interactive States

- Default button: `bg-elevated border border-border text-text-primary hover:bg-overlay`
- Primary button: `bg-accent text-black hover:bg-accent-hover font-medium`
- Danger button: `bg-danger text-white hover:bg-red-600`
- Ghost button: `text-text-secondary hover:text-text-primary hover:bg-elevated`
- Icon button: `p-1.5 rounded-md text-text-muted hover:text-text-secondary hover:bg-elevated`

### Loading States

Use a 2px accent-coloured top bar progress indicator for page transitions (not spinners). For inline loading use a pulsing dot or skeleton shimmer, never a spinner.

---

## Shared Utility Components to Create in Prompt 02

These must exist before other prompts use them:

- `src/components/ui/Panel.tsx` - floating panel wrapper
- `src/components/ui/IconButton.tsx` - small icon-only button
- `src/components/ui/Tooltip.tsx` - hover tooltip (Radix or manual)
- `src/components/ui/Kbd.tsx` - keyboard shortcut display (`<kbd>Ctrl</kbd><kbd>K</kbd>`)
- `src/components/ui/EmptyState.tsx` - empty list placeholder with icon + message
- `src/components/ui/Spinner.tsx` - inline loading dot
- `src/components/ui/Badge.tsx` - status chip (active/paused/draft)

---

## Conventions for This Series

1. All new components are TypeScript with explicit prop types. No `any`.
2. All new API routes return JSON with shape `{ data: T } | { error: string }` except SSE streams.
3. All database writes use `withAudit(workspaceId, userId, action, detail, fn)` helper from `src/lib/audit.ts`.
4. Use `'use client'` only when the component actually uses hooks or browser APIs. Server components by default.
5. Do not add comments explaining WHAT code does. Only add comments when the WHY is non-obvious.
6. No backwards-compat hacks. Change callers when you change an interface.
7. Every prompt builds on the previous one. Execute them in order (00 through 17).
