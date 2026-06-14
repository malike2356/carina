# Carina Ops Sprint 3.2: Customer Ops static shell

## Goal

Build the Carina Ops customer UI shell on `app.carinaai.uk` using static HTML and shared layout JS.

## Context

- Pattern: `src/gateway/web/billing.html`, `settings.html`, `hosted-login.html`
- Dark theme, vanilla JS, fetch to `/api/carina-ops/*`
- Brand: "Carina Ops" not "Admin" or "Dashboard"

## Dependencies

- `13-plan-gates-module.md`

## Files to create

```
core.carinaai.uk/src/gateway/web/ops/
  layout.js          Shared nav, auth check, plan badge
  ops.css            Minimal styles (or reuse billing.css patterns)
  index.html         Overview: plan, usage summary, quick links
  workbench.html     Placeholder until prompt 20
  vault.html         Placeholder until prompt 19
  usage.html         Placeholder until prompt 21
  audit.html         Placeholder until prompt 22
  settings.html      Org name, members list
  billing.html       Plan upgrade CTA
  upgrade.html       Shown to free users
```

## Step-by-step

1. `layout.js` exports:

```javascript
async function requireOpsSession() { ... }  // redirects to /hosted-login
function renderNav(activePage) { ... }      // Overview, Workbench, Vault, Usage, Audit, Settings, Billing
function showPlanBadge(plan) { ... }
```

2. Nav labels and page titles use "Carina Ops".

3. `index.html` fetches `GET /api/carina-ops/overview` (stub OK returning `{ plan, usageToday, memberCount }`).

4. `upgrade.html` for free users:

- Copy: "Carina Ops is the control plane for teams. BYOK, usage, audit, and admin."
- CTA button to `/ops/billing`

5. Match existing hosted page typography and colors from `billing.html`.

6. No framework; no React. Keep each HTML under 150 lines.

## Expected behavior

- Paid user sees nav with all sections
- Pages share consistent header with org name
- Unauthenticated user redirected to `/hosted-login`

## Test

Manual on `localhost:3333` with `HOSTED_MODE=true`:

- Login as starter user, open `/ops/`
- Confirm nav renders and branding says Carina Ops

```bash
cd core.carinaai.uk && pnpm build
```
