# Prompt 12 - Mobile Shell + PWA

## Objective

Deliver Target claim: "works on mobile, actually pretty good." Responsive chat shell, touch-friendly panels, optional PWA install.

---

## Context

**Working directory:** `app.carinaai.uk`

---

## Step 1 - Viewport and meta

In `app/layout.tsx`:
- `viewport` export: `width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover`
- `theme-color` from CSS `--bg-base`
- Apple web app capable meta tags

---

## Step 2 - Responsive shell

`(workspace)/layout.tsx`:

| Breakpoint | Behavior |
|------------|----------|
| `< md` | Sidebar hidden; hamburger opens drawer overlay |
| `>= md` | Existing sidebar |

Add `MobileNav.tsx`:
- Bottom bar: Chat, Library, Research, More (sheet with Memory, Skills, Notes, Settings)
- Safe area padding for iOS `env(safe-area-inset-bottom)`

`AppSidebar`: add `hidden md:flex` when mobile nav active.

---

## Step 3 - Chat mobile UX

- Input bar sticks above keyboard (`pb-safe`)
- Message bubbles max-width 90%
- Tool call blocks collapsed by default on mobile
- Session header collapses to title only

---

## Step 4 - PWA manifest

Create `public/manifest.json`:
```json
{
  "name": "Carina",
  "short_name": "Carina",
  "start_url": "/dashboard",
  "display": "standalone",
  "background_color": "#0f1117",
  "theme_color": "#0f1117",
  "icons": [{ "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" }]
}
```

Generate 192 and 512 icons from existing `icon.svg` (script or manual export).

Register service worker `public/sw.js` (minimal: cache shell assets only, network-first for API).

Link manifest in layout.

---

## Step 5 - Touch targets

All `IconButton` minimum 44x44px tap area on mobile via Tailwind `min-h-11 min-w-11`.

---

## Acceptance criteria

- [ ] Usable chat flow on 390px width without horizontal scroll.
- [ ] Lighthouse PWA installable (manifest + SW + HTTPS).
- [ ] Sidebar accessible via hamburger on mobile.
