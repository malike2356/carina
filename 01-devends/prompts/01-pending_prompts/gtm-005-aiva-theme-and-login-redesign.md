# GTM 005: Aiva theme defaults and login page redesign

**Sprint:** GTM readiness
**Prompt number:** 05 of 04 (added after audit)
**Name:** Make the Aiva workspace feel polished for non-technical business users
**Primary agent:** Cursor / Claude Code
**Estimated hours:** 3-4 h
**Depends on:** Nothing (standalone)

---

## Read first

- Root layout: `03-frontends/client-apps/app.carinaai.uk/src/app/layout.tsx`
- Global CSS: `03-frontends/client-apps/app.carinaai.uk/src/app/globals.css`
- Login page: `03-frontends/client-apps/app.carinaai.uk/src/app/(auth)/login/page.tsx`
- Register page: `03-frontends/client-apps/app.carinaai.uk/src/app/(auth)/register/page.tsx`
- Auth layout (if it exists): `03-frontends/client-apps/app.carinaai.uk/src/app/(auth)/layout.tsx`
- ThemeSwitcherHost: `03-frontends/client-apps/app.carinaai.uk/src/components/shell/ThemeSwitcherHost.tsx`
- ThemeSwitcher: `03-frontends/client-apps/app.carinaai.uk/src/components/shell/ThemeSwitcher.tsx`
- Server theme resolution: `03-frontends/client-apps/app.carinaai.uk/src/lib/server-theme.ts`
- Theme runtime: `03-frontends/client-apps/app.carinaai.uk/src/lib/theme-runtime.ts`
- Default theme constant: `03-frontends/client-apps/app.carinaai.uk/src/lib/multi-theme-catalog.generated.ts`
  - `DEFAULT_MULTI_THEME = 'default'`
- Available themes: `03-frontends/client-apps/app.carinaai.uk/public/themes/multi/`
  - All themes have both `:root` (light mode) and `.dark` (dark mode) CSS variable blocks
- Workspace layout: `03-frontends/client-apps/app.carinaai.uk/src/app/(workspace)/layout.tsx`
- WorkspaceLayoutClient: `03-frontends/client-apps/app.carinaai.uk/src/components/shell/WorkspaceLayoutClient.tsx`
- `useIsAivaProduct` hook: detects Aiva vs developer product surface
- Path map: `01-devends/prompts/01-pending_prompts/PATH-MAP.md`

---

## Context

`app.carinaai.uk` is the Aiva product: an AI employee service sold to non-technical business owners. The current UI defaults to full dark mode with a developer-focused aesthetic. The floating theme switcher (bottom-right palette button) exists but is subtle and defaults to dark. A first-time business owner landing on the login page sees a stark dark form with no personality.

Aiva's brand is calm and professional - amber accents, clean type, trustworthy. The goal is not to force light mode on everyone, but to:

1. Give the login and register pages a split layout that feels premium (dark brand panel on the left, light form panel on the right) - matching how modern SaaS products like Notion, Linear, and Vercel handle auth.
2. Default the Aiva surface to **light mode** for new users (developers who find Carina through the CLI can stay dark; the Aiva workspace should feel like a business tool by default).
3. Make the theme switcher easy to find inside the workspace - move it to the sidebar footer rather than a floating button that users may not notice.

---

## Goal

### Part 1: Split-panel auth layout (login and register)

Create or update `03-frontends/client-apps/app.carinaai.uk/src/app/(auth)/layout.tsx`.

This layout wraps login, register, forgot-password, and reset-password pages. It should render a two-column split:

```
|  Left panel (40%)   |  Right panel (60%)  |
|  Dark background    |  Light background   |
|  Brand + tagline    |  {children}         |
|  Aiva testimonial   |  (the form)         |
```

**Left panel (dark, `#0d1f2d` background, amber accent `#f5a623`):**
- Aiva logo / wordmark at top-left
- Large serif heading: "Your AI employee is ready to work."
- Sub-copy: "Aiva handles messages, bookings, follow-ups, and recurring admin. You stay focused on what matters."
- One trust signal at the bottom: "15-day free trial. No card required. Cancel any time."
- The panel is purely decorative and informational - no interactive elements

**Right panel (white `#ffffff` background, `#0d1f2d` text):**
- Centered vertically with `max-width: 400px`
- Renders `{children}` (the form from login/register page)
- Small footer below the form: "Need help? Email hello@carinaai.uk"

**Responsive:** on screens narrower than 768px, hide the left panel entirely and show only the right panel (the form), full width.

**Do not use any images.** Use CSS only (background, gradients, type). Keep the layout under 80 lines.

The form pages themselves (`login/page.tsx`, `register/page.tsx`) may need their own outer container removed if they currently add `min-h-screen` centering - that centering now belongs in the layout, not the page. Adjust as needed without breaking the form functionality.

### Part 2: Default to light mode for Aiva surface

File: `03-frontends/client-apps/app.carinaai.uk/src/lib/server-theme.ts`

When no theme preference cookie is set, the current default is `DEFAULT_MULTI_THEME` (which is `'default'`) with mode `'dark'`. For the Aiva product surface, this should default to `'modern-minimal'` theme in `'light'` mode.

The server-side resolver cannot call `useIsAivaProduct()` (that is a client hook). Instead, detect the product surface from the hostname in the request headers. If the host is `app.carinaai.uk` or `aiva.carinaai.uk`, use Aiva defaults:

```typescript
import { headers } from 'next/headers';

export async function resolveServerThemePreference(): Promise<{ themeId: string; mode: ThemeMode }> {
  const cookieStore = await cookies();
  const themeRaw = cookieStore.get('carina_theme')?.value;
  const modeRaw = cookieStore.get('carina_theme_mode')?.value;

  // If user has an explicit preference stored, always use it
  if (themeRaw || modeRaw) {
    const themeId = normalizeThemeId(themeRaw ?? 'modern-minimal');
    const mode = normalizeThemeMode(modeRaw, themeRaw);
    return { themeId, mode };
  }

  // No preference set - choose default based on product surface
  const host = (await headers()).get('host') ?? '';
  const isAiva = host.includes('aiva.carinaai.uk') || host.includes('app.carinaai.uk');
  return isAiva
    ? { themeId: 'modern-minimal', mode: 'light' }
    : { themeId: 'default', mode: 'dark' };
}
```

This means a new Aiva user lands on a clean light workspace. They can still switch to dark mode via the theme switcher (Part 3). Their preference is saved in cookies and respected on all subsequent visits.

### Part 3: Move theme switcher to workspace sidebar footer

The current `ThemeSwitcherFloating` (bottom-right corner button with palette icon) is subtle and easy to miss. Business users will not find it.

**Step 1:** Find `WorkspaceLayoutClient.tsx` (referenced from workspace layout). Locate the sidebar component it renders. The sidebar should have a footer section at the bottom.

**Step 2:** Add a `ThemeSwitcher` instance to the sidebar footer. Use the `variant="compact"` and `dropUp={true}` props (so the panel opens upwards). Place it next to or below the user avatar / account section that is typically at the bottom of sidebars.

The button should show the current theme mode icon (Sun for light, Moon for dark) with the label "Appearance". When clicked, it opens the theme picker panel (already built in `ThemeSwitcher.tsx`).

```tsx
import { ThemeSwitcher } from '@/components/shell/ThemeSwitcher';

// Inside the sidebar footer:
<ThemeSwitcher
  variant="compact"
  dropUp
  syncApi
  className="w-full"
/>
```

**Step 3:** Remove `ThemeSwitcherHost` from `layout.tsx` - it is being replaced by the sidebar placement. The floating button was a stopgap. Check that `ThemeSwitcherHost` is only referenced in `layout.tsx` before removing it (grep for `ThemeSwitcherHost` across the src directory to confirm).

Note: the theme switcher should NOT appear on auth pages (login, register, etc.). Auth pages use the split layout from Part 1, not the workspace sidebar. The floating host was shown on all pages including auth - the sidebar placement naturally scopes it to the workspace only.

### Part 4: Workspace sidebar theme label

When the user is on the Aiva product surface (`useIsAivaProduct()` returns true), the appearance panel opened by the theme switcher should show a note:

```
Aiva defaults to light mode. Your preference is saved.
```

This note should appear as a small muted line above the theme grid in the picker. This helps business users understand why it is light by default and reassures them they can change it.

Find the relevant render section inside `ThemeSwitcher.tsx` (the panel that shows the theme grid). Add a conditional note:

```tsx
{isAivaProduct && (
  <p className="mb-2 text-xs text-text-muted">
    Aiva defaults to light mode. Your preference is saved.
  </p>
)}
```

Import `useIsAivaProduct` at the top of `ThemeSwitcher.tsx`.

---

## Visual targets

**Login page (after this change):**

```
|  Dark left panel              |  White right panel           |
|                               |                              |
|  Aiva                         |  Sign in to Aiva             |
|                               |  Manage your AI employees.   |
|  "Your AI employee            |                              |
|  is ready to work."           |  [Email input]               |
|                               |  [Password input]            |
|  Aiva handles messages,       |  [Sign in button]            |
|  bookings, follow-ups, and    |                              |
|  recurring admin.             |  Don't have an account?      |
|                               |  Create one                  |
|  15-day free trial.           |                              |
|  No card required.            |  Need help? hello@carinaai.uk|
|_____________________________ _|______________________________|
```

**Workspace (after this change):**
- New users see light mode (modern-minimal) by default
- Sidebar footer has "Appearance" button (Sun icon, compact)
- No floating palette button in the corner

---

## Acceptance criteria

- [ ] Login page renders a split dark/light layout on desktop; full-width light form on mobile
- [ ] Register page uses the same split layout
- [ ] New users with no cookie land on light mode (`modern-minimal` theme) on `app.carinaai.uk`
- [ ] Users with an existing `carina_theme` or `carina_theme_mode` cookie are unaffected
- [ ] The workspace sidebar footer has a working "Appearance" theme switcher button
- [ ] The floating theme switcher (ThemeSwitcherHost) is removed from layout.tsx
- [ ] Theme switcher does NOT appear on login/register pages
- [ ] Clicking dark mode in the appearance panel switches the workspace to dark; cookie is saved
- [ ] Revisiting the app respects the saved preference (light or dark)
- [ ] No TypeScript errors (`pnpm build` passes)
- [ ] No em dashes, no emojis in any edited files
- [ ] Text on the left dark panel has sufficient contrast (WCAG AA minimum)

---

## Do not touch

- Any page outside `(auth)/` and `(workspace)/`
- Billing logic
- The auth/session logic inside the form components
- Scout or Carina developer surface themes
- `.env` files
- `public/themes/multi/*.css` files (do not create new theme files)
