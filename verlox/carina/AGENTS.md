# Repository Guidelines

## Writing style (hard constraint)

Never use em dashes (U+2014) or en dashes (U+2013). Use `;`, `:`, `,`, `-`, parentheses, or sentence breaks instead. Never use emojis anywhere. See `/opt/lampp/htdocs/verlox/AGENTS.md` and run `python3 ../scripts/fix-writing-style.py` after bulk doc edits.

## Project Structure & Module Organization

This is the VERLOX Carina monorepo. The canonical tree is grouped by audience and layer:

- `external/client-apps/`: customer-facing clients, including `app.carinaai.uk/`, `carinaMobile/` (`03-frontends/client-apps/carinaMobile/`), and `carina-desktop/`.
- `external/integrations/`: IDE extensions and client integrations.
- `external/sdks/`: public SDKs and exports.
- `internal/servers/`: server products, including `core.carinaai.uk/`, `console.labyrinthscout.com/`, and `scout-engine/`.
- `internal/admin/`: VERLOX-only administration, including `ops.carinaai.uk/`.
- `marketing/sites/`: public static sites.
- `marketing/docs/`: public Docusaurus documentation.
- `product/planning/`: internal planning, strategy, design, operations, and prompt material.
- `product/archive/`: archived material.

The repo root is intentionally small. Work inside `external/`, `internal/`, `marketing/`, or `product/` first, then choose the product directory.

Product code for the packaged Carina agent lives in `internal/servers/core.carinaai.uk/`, a Node.js/TypeScript agent with CLI entry points in `bin/`, source in `src/`, and product data in `brain/`. Public documentation lives in `marketing/docs/docs.carinaai.uk/` (Docusaurus; user + developer guides). Legacy VitePress sources remain in `internal/servers/core.carinaai.uk/docs/` (deprecated; edit `marketing/docs/docs.carinaai.uk/` instead). The private operations panel is `internal/admin/ops.carinaai.uk/` (also under `02-backends/admin/ops.carinaai.uk/` in this tree), with Express routes in `routes/`, helpers in `lib/`, EJS templates in `views/`, and CSS generated to `public/styles.css`. **Warden** (Scout immune system) is at `/security/warden`; see `ops.carinaai.uk/docs/WARDEN.md` and `scout-engine/src/warden/README.md`. Labyrinth Scout lives in `internal/servers/console.labyrinthscout.com/`, with event ingestion and the Warden API also in `02-backends/scout-engine/`. The Carina mobile companion is `03-frontends/client-apps/carinaMobile/` (Expo Router; general-purpose default). Deployment scripts are in `scripts/`. **Production deploy guide:** `docs/DEPLOYMENT-GUIDE.md`. **Ops auth, user management, Scout accounts admin, and ops/Scout deploy quirks:** `docs/OPS-USER-MANAGEMENT.md`. Agent runtime knowledge is in `internal/servers/core.carinaai.uk/src/platform/platform-knowledge.md`.

## Prompt library and agent chat rules

Development prompts belong in `01-devends/prompts-library/`. Do not create scattered development prompt folders inside product code.

- Active build prompts: `01-devends/prompts-library/01-pending_prompts/`
- Completed prompts: `01-devends/prompts-library/02-archived_prompts/archives_from_pending_prompts/`
- Reusable prompts: `01-devends/prompts-library/03-reusable_prompts/`
- Source chats and planning discussions behind prompts: `01-devends/prompts-library/04-source_chats/`
- Templates and schema: `01-devends/prompts-library/templates/` and `01-devends/prompts-library/00-library-docs/`

Before adding, moving, or archiving prompts, read `01-devends/prompts-library/00-library-docs/AGENT-RULES.md`. When prompt files are changed, run `python3 01-devends/prompts-library/scripts/build-prompt-index.py`.

Agent chats that produce product or engineering decisions must be preserved as source material and rewritten into prompts. Keep the raw or indexed chat in `04-source_chats/`, then put the executable or reusable prompt in the correct prompt folder.

## Build, Test, and Development Commands

Use package-local commands from the relevant directory.

- `cd marketing/docs/docs.carinaai.uk && pnpm start`: Docusaurus docs site (user + developer).
- `cd internal/servers/core.carinaai.uk && pnpm docs:dev`: alias to Docusaurus dev server.
- `cd internal/servers/core.carinaai.uk && pnpm dev`: run the Carina agent in watch mode.
- `cd internal/servers/core.carinaai.uk && pnpm carina`: run the CLI entry point.
- `cd internal/servers/core.carinaai.uk && pnpm build`: compile TypeScript and copy gateway web assets.
- `cd internal/servers/core.carinaai.uk && pnpm test`: run Vitest tests (5,369 as of 2026-06-10).
- `cd internal/servers/console.labyrinthscout.com && pnpm dev`: run Scout in watch mode.
- `cd internal/servers/console.labyrinthscout.com && pnpm typecheck && pnpm test`: validate Scout before changes ship.
- `cd internal/admin/ops.carinaai.uk && pnpm dev`: run the VERLOX ops panel on port 4000.
- `cd internal/admin/ops.carinaai.uk && pnpm css`: rebuild Tailwind output for EJS views.
- `cd 03-frontends/client-apps/carinaMobile && pnpm start`: Expo dev server for the Carina mobile app.
- `cd 03-frontends/client-apps/carinaMobile && pnpm test`: Vitest for mobile config and API helpers.
- `cd 03-frontends/client-apps/carinaMobile && pnpm build:preview`: EAS preview build for device QA (see `03-frontends/client-apps/carinaMobile/DEPLOY.md`).

## Carina Mobile

| Item | Value |
|---|---|
| Path | `03-frontends/client-apps/carinaMobile/` |
| Status | Internal QA / device testing until `DEVICE_QA.md` sign-off |
| Product boundary | General agent; no `property-uk` (Propreneur only) |
| Architecture | `03-frontends/client-apps/carinaMobile/ARCHITECTURE.md` |
| Completion prompts | `03-frontends/client-apps/carinaMobile/prompts/README.md` |
| Deploy | `03-frontends/client-apps/carinaMobile/DEPLOY.md` |
| Device QA | `03-frontends/client-apps/carinaMobile/DEVICE_QA.md` |

Not production-ready until `DEVICE_QA.md` sign-off is complete.

## Coding Style & Naming Conventions

Code is TypeScript ESM. Match local style: two-space indentation, semicolons, single quotes, named exports for shared helpers, and explicit types at module boundaries. Keep Express route files grouped by feature, for example `routes/settings.ts` or `src/api/events.ts`. Tests use `*.test.ts` beside the code they cover.

## Testing Guidelines

Vitest is the active test framework for `internal/servers/core.carinaai.uk/` and `internal/servers/console.labyrinthscout.com/`. Core tests include V8 coverage with current thresholds of 60% lines and 60% functions. Add tests for agent tools, security policy, API handlers, and regression-prone wiring. Run the package’s `pnpm test` before handing off; run `pnpm typecheck` where available.

## Commit & Pull Request Guidelines

Git history uses short imperative subjects, often with Conventional Commit scopes: `fix(deploy): ...`, `docs(security): ...`, `feat: ...`, `chore: ...`. Keep commits focused. Pull requests should state the affected product area, list validation commands, link any issue or prompt, and include screenshots for ops panel or public UI changes.

## Security & Configuration Tips

Never commit real `.env` files, API keys, `.htpasswd`, or credentials. Use the existing `.env.example` files in `internal/servers/core.carinaai.uk/`, `internal/admin/ops.carinaai.uk/`, and `internal/servers/console.labyrinthscout.com/`. Preserve Scout/Carina trust boundaries: Carina reports sanitized telemetry; Scout control actions must remain scoped and auditable.

## Ops panel: auth and user management

Read **`docs/OPS-USER-MANAGEMENT.md`** before changing login, roles, tenant admin, or Scout subscriber accounts.

Summary for agents:

- **Ops operators** (`/users`, superadmin only): `internal/admin/ops.carinaai.uk/`
- **Cloud subscribers** (`/tenants`): app.carinaai.uk better-auth users; do not add a second admin UI
- **Scout customer accounts** (`/scout/accounts`): console.labyrinthscout.com `/account/*` users; API in Scout `src/api/admin.ts`
- **core.carinaai.uk** and **Scout dashboard**: single-password operator surfaces; password changes via ops Settings only
- **Deploy ops:** run `pnpm build` in ops first; production uses `docker/Dockerfile.runtime` (pre-built `dist/`)
- **Deploy Scout console:** build Docker image from `$APPS_ROOT` (monorepo context), not from inside `console.labyrinthscout.com/` alone
- **Env:** set `SCOUT_ACCOUNT_PUBLIC_URL` in ops `.env` for Scout password setup links

## Production: carinaai.uk marketing site (Docker nginx)

`https://carinaai.uk/` is served by the **Docker `nginx` container**, not host aaPanel nginx. Live files: `core.carinaai.uk/public_website/` (bind mount).

**After rsync or any change under `public_website/`, recreate nginx** or the site can 403 while `index.html` exists on the host (stale Docker bind mount inode):

```bash
cd core.carinaai.uk && bash docker/scripts/reload-marketing-nginx.sh
```

`scripts/deploy-marketing.sh` and `scripts/deploy-carina.sh` run this automatically. Read `core.carinaai.uk/docker/DEPLOY.md` and `public_website/README-DEPLOY.md` before manual marketing deploys.

## Terminology: Playbook vs Cookbook

**Playbook** is the user-facing product term: situational decision engine, hardware-aware model discovery, workspace `/playbook`, CLI `carina playbook`.

**Cookbook** is an internal implementation label only (`src/cookbook/`, `cookbook-api.ts`). Do not use it in operator-facing copy, docs, or UI. `carina cookbook` may remain as a deprecated CLI alias with a brief notice pointing to `carina playbook`.

## Stripe Billing Source Of Truth

Always use `/opt/lampp/htdocs/verlox/.stripe-credentials-and-price-id.md` for Stripe price IDs and amounts across Carina, Aiva, Scout, and related products. Do not create new Stripe prices unless the owner explicitly asks. Never paste secret values from that file into chat, logs, commits, docs, or UI. Optional Keprix Community £1 coffee donation is voluntary only.
