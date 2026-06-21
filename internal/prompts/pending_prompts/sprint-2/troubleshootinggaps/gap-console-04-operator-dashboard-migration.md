# GAP: Migrate Operator Dashboard out of console.labyrinthscout.com


## Post-build (MANDATORY)

When all "Done When" criteria in this prompt are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file (use today's date).
2. Add a "**What was built:**" bullet list of key files or features shipped.
3. Move this file from `carina/internal/prompts/pending_prompts/` to `carina/internal/prompts/archived_prompts/pending_prompts/`, keeping the same relative path. Use `git mv` when possible.
4. If every prompt in this gap folder is COMPLETED, move the whole gap folder and update its `README.md` the same way.
5. Do not leave completed prompts in `pending_prompts/`; agents treat that folder as active work only.

Full checklist: `carina/internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`

## Context and problem

`console.labyrinthscout.com` serves two completely different audiences through the same domain:

| Path | Audience | Purpose |
|---|---|---|
| `/` | Paying customers (SaaS) | Scout security SPA - findings, scans, targets, agents |
| `/account/*` | Paying customers (SaaS) | Account management, pairing keys, sign in |
| `/pricing`, `/checkout` | Public (prospects) | Marketing and purchase flow |
| `/dashboard` | VERLOX internal | Operator dashboard: fleet overview, tenant management, internal metrics |
| `/dashboard/login` | VERLOX internal | Separate login for VERLOX operator access |

The last two rows are the problem. An internal VERLOX admin view is sitting on a public SaaS domain behind nothing but a login form. Customers who land on `/dashboard/login` see "Operator sign in" alongside "Account sign in" and have no idea what the difference is. The existence of the operator dashboard on this domain also creates a shared-origin security boundary where CORS, cookies, and auth tokens from the customer session overlap with the operator session.

## What needs to be done

### Step 1: Move /dashboard and /dashboard/login to ops.carinaai.uk

`ops.carinaai.uk` is the designated internal VERLOX admin panel. The operator Scout dashboard belongs there, not on the customer domain.

**Files to move:**
- `console.labyrinthscout.com/public/dashboard.html` -> `ops.carinaai.uk/views/scout-dashboard.html` (or equivalent)
- `console.labyrinthscout.com/public/dashboard/login.html` -> `ops.carinaai.uk/views/scout-login.html`
- Any JS/CSS specific to these pages

**API calls to update:**
The operator dashboard at `/dashboard.html` calls `/api/` endpoints on the console server. These either need to:
- Remain on the console server but require an operator auth token (not the customer session cookie)
- Move to a dedicated operator API on `ops.carinaai.uk`

Recommended: add a separate operator auth mechanism (separate JWT or API key header) on the existing console server routes that the dashboard uses, and proxy those calls through `ops.carinaai.uk`. This keeps the console server as the single source of truth for Scout data without duplicating logic.

### Step 2: Add a 404 or permanent redirect on /dashboard at console.labyrinthscout.com

Once the operator dashboard is migrated, add a route in `console.labyrinthscout.com/src/server.ts`:

```typescript
// Redirect legacy operator paths - these moved to ops.carinaai.uk
app.get('/dashboard', (_req, res) => res.redirect(301, 'https://ops.carinaai.uk/scout'));
app.get('/dashboard/login', (_req, res) => res.redirect(301, 'https://ops.carinaai.uk/scout/login'));
app.get('/dashboard/*', (_req, res) => res.redirect(301, 'https://ops.carinaai.uk/scout'));
```

### Step 3: Consolidate the information architecture

After this migration, the domain-to-audience mapping becomes clean:

| Domain | Audience | What it contains |
|---|---|---|
| `labyrinthscout.com` | Public | Marketing only |
| `console.labyrinthscout.com` | Customers + Prospects | SaaS product, account, pricing, checkout |
| `carinaai.uk` | Public | Marketing only |
| `app.carinaai.uk` | Customers | Carina SaaS product |
| `ops.carinaai.uk` | VERLOX internal only | Admin panel, operator Scout view, internal tools |
| `core.carinaai.uk` | VERLOX internal only | Agent runtime, not user-facing |

No customer-facing page should ever link to `ops.carinaai.uk` or `core.carinaai.uk`.
No internal tool should be accessible from a customer domain without explicit operator auth.

### Step 4: Tighten auth separation

Currently the operator dashboard at `/dashboard` uses a separate login (`/dashboard/login`) that issues its own session. After migration, `ops.carinaai.uk` should be protected at the network level (IP allowlist for the Contabo VPS management IP, or behind VPN) in addition to the login form. A login form alone is not sufficient protection for an internal admin panel that has access to all tenant data.

## Acceptance criteria

- `console.labyrinthscout.com/dashboard` returns 301 redirect to `ops.carinaai.uk/scout`
- `console.labyrinthscout.com/dashboard/login` returns 301 redirect to `ops.carinaai.uk/scout/login`
- The operator dashboard on `ops.carinaai.uk/scout` loads fully with the same functionality as the current `/dashboard`
- No nav link on any customer-facing page (`/`, `/pricing`, `/checkout`, `/account/*`) points to `ops.carinaai.uk` or `core.carinaai.uk`
- Grepping all public HTML files for `ops.carinaai.uk` and `core.carinaai.uk` returns zero results

## Files involved

**console.labyrinthscout.com:**
- `public/dashboard.html` - move to ops
- `public/dashboard/login.html` - move to ops
- `src/server.ts` - add redirect routes

**ops.carinaai.uk:**
- Add scout dashboard view and login view
- Add proxy or direct API routes for scout operator data

**No changes needed to:**
- `console.labyrinthscout.com/public/index.html` (customer SPA, already clean)
- `console.labyrinthscout.com/public/account/*.html` (already cleaned in sprint-2 Tier 1)
- `console.labyrinthscout.com/public/pricing.html` (already cleaned in sprint-2 Tier 1)
