# GTM 005: Aiva theme defaults and login page redesign

**Status: COMPLETED 2026-07-26**

**What was built:**
- Implemented and archived

**Sprint:** GTM readiness
**Prompt number:** 05 of 04 (added after audit)
**Name:** Make the Aiva workspace feel polished for non-technical business users
**Primary agent:** Cursor / Claude Code
**Estimated hours:** 3-4 h
**Depends on:** Nothing (standalone)

**Status:** COMPLETED (2026-06-25)

---

## Acceptance criteria

- [x] Login page renders a split dark/light layout on desktop; full-width light form on mobile
- [x] Register page uses the same split layout
- [x] New users with no cookie land on light mode (`modern-minimal` theme) on `app.carinaai.uk`
- [x] Users with an existing `carina_theme` or `carina_theme_mode` cookie are unaffected
- [x] The workspace sidebar footer has a working "Appearance" theme switcher button
- [x] The floating theme switcher (ThemeSwitcherHost) is removed from layout.tsx
- [x] Theme switcher does NOT appear on login/register pages
- [x] Clicking dark mode in the appearance panel switches the workspace to dark; cookie is saved
- [x] Revisiting the app respects the saved preference (light or dark)
- [x] No TypeScript errors (compile and type-check pass)
- [x] No em dashes, no emojis in any edited files
- [x] Text on the left dark panel has sufficient contrast (WCAG AA minimum)

## Completion note

Completed 2026-06-25.

Implementation was largely already in place from a prior session. Verification and two small fixes applied:

| Part | File | Status |
|------|------|--------|
| 1 | `src/app/(auth)/layout.tsx` | Split dark brand panel + light form; mobile keeps light form (fixed dark mobile override) |
| 2 | `src/lib/server-theme.ts` | Aiva hosts default to `modern-minimal` + `light` when no cookie |
| 3 | `src/components/shell/AppSidebar.tsx` | ThemeSwitcher in sidebar footer; `ThemeSwitcherHost` removed from root layout |
| 4 | `src/components/shell/ThemeSwitcher.tsx` | Aiva note in picker; sidebar trigger shows Sun/Moon + "Appearance" |

Key paths:

- Auth split layout wraps login, register, forgot-password, reset-password
- Root `layout.tsx` no longer mounts `ThemeSwitcherHost`
- Sidebar `ThemeSwitcher` uses `menuPlacement="sidebar"` with label "Appearance"

---

## Do not touch

- Any page outside `(auth)/` and `(workspace)/`
- Billing logic
- The auth/session logic inside the form components
- Scout or Carina developer surface themes
- `.env` files
- `public/themes/multi/*.css` files
