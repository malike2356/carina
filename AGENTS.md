# Repository Guidelines


## CRITICAL: Public GitHub hygiene (product files only)

Before any commit or push to GitHub, track **only files that make this product work**. Planning docs, prompt queues, competitor research, personal notes, runtime logs, secrets, and nested foreign product trees stay workstation-local (`.gitignore` + `git rm --cached`). Canonical rule: `/opt/lampp/htdocs/verlox/shared/workspace-governance/PUBLIC-GITHUB-HYGIENE.md` and `/opt/lampp/htdocs/verlox/.cursor/rules/public-github-hygiene.mdc`. Guard: `bash /opt/lampp/htdocs/verlox/scripts/guard-public-github-hygiene.sh`.

## Writing style (hard constraint)

Never use em dashes (U+2014) or en dashes (U+2013). Use `;`, `:`, `,`, `-`, parentheses, or sentence breaks instead. Never use emojis anywhere. See `/opt/lampp/htdocs/verlox/AGENTS.md` and run `python3 ../scripts/fix-writing-style.py` after bulk doc edits.

## Project Structure & Module Organization

This is the VERLOX Carina monorepo. There is a **single** platform tree (the former nested `verlox/carina/` copy was merged on 2026-07-28; see `product/planning/LIVE-VS-NESTED-TREE-DECISION.md` and `/opt/lampp/htdocs/verlox/shared/workspace-governance/CARINA-SOURCE-BOUNDARY.md`).

Carina and Aiva share this runtime. Aiva is a commercial product surface on top of the platform, not a second deployable tree. Keep the platform shared and keep Aiva-specific branding, routes, entitlements, templates, and onboarding thin and explicit. Read `/opt/lampp/htdocs/verlox/shared/workspace-governance/CARINA-AIVA-SOFT-SEPARATION.md` before making boundary changes.

**Clinicom AI on Contabo:** Clinicom is a product surface that currently calls the Carina Clinicom pack sidecar (`packages/packs/clinicom/`, Contabo service `carina-sidecar`). Keprix is a later optional flip, not live on Contabo yet. Do not assume Contabo Clinicom traffic hits Keprix. See `/opt/lampp/htdocs/verlox/shared/workspace-governance/CLINICOM-CONTABO-SIDECAR.md` and `/opt/lampp/htdocs/verlox/clinicom-ai/AGENTS.md`. Clinicom OPS is separate (`ops.clinicomai.com`); never fold it into Carina OPS.

**Hard rule (multi-tenant):** Never let one Aiva workspace read another workspace's contacts, memory, documents, notes, research, media, cron, or Google tokens. Each customer keeps their own durable memory and persistence. See `02-backends/core.carinaai.uk/docs/TENANT-ISOLATION.md`.

**Hard rule:** Never create, restore, or edit under `carina/verlox/` or `carina/verlox/carina/`. That path is forbidden. Work only under top-level `02-backends/`, `03-frontends/`, `scripts/`, etc.

**CRITICAL (prompts library):** When a prompt in `01-devends/prompts-library/01-pending_prompts/` is fully completed (Done When satisfied + validated), archive it immediately to `01-devends/prompts-library/02-archived_prompts/archives_from_pending_prompts/`. Update the pending index, remove empty folders, and never leave finished prompts in pending. Follow `01-devends/prompts-library/00-library-docs/POST-BUILD-CHECKLIST.md`. Do not archive partial or owner-blocked work.

Canonical layout:

- `02-backends/core.carinaai.uk/`: Carina agent (CLI in `bin/`, source in `src/`, knowledge in `brain/`)
- `02-backends/admin/ops.carinaai.uk/`: VERLOX ops panel
- `02-backends/console.labyrinthscout.com/` and `02-backends/scout-engine/`: Labyrinth Scout
- `03-frontends/client-apps/`: `app.carinaai.uk/`, `admin.carinaai.uk/`, `carinaMobile/`, `carina-desktop/`
- `03-frontends/marketing/`: docs, hireaiva, and related marketing apps
- `03-frontends/integrations/` and `03-frontends/sdks/`: client integrations and SDKs
- `product/planning/`: internal planning and non-runtime docs
- `01-devends/`: prompts library (do not confuse with runtime `brain/`)
- Top-level `brain/`: company RAG corpus (separate from core package brain)

Public Docusaurus docs: `03-frontends/marketing/docs.carinaai.uk/`. Legacy VitePress sources may remain under core `docs/` (prefer Docusaurus). Deploy: `scripts/deploy-carina.sh` (`PLATFORM_ROOT` is this repo root). **Production deploy guide:** `docs/DEPLOYMENT-GUIDE.md`. **Ops auth / Scout quirks:** `docs/OPS-USER-MANAGEMENT.md`.

## Build, Test, and Development Commands

Use package-local commands from the relevant directory.

- `cd 03-frontends/marketing/docs.carinaai.uk && pnpm start`: Docusaurus docs site.
- `cd 02-backends/core.carinaai.uk && pnpm docs:dev`: alias to Docusaurus dev server.
- `cd 02-backends/core.carinaai.uk && pnpm dev`: run the Carina agent in watch mode.
- `cd 02-backends/core.carinaai.uk && pnpm carina`: run the CLI entry point.
- `cd 02-backends/core.carinaai.uk && pnpm build`: compile TypeScript and copy gateway web assets.
- `cd 02-backends/core.carinaai.uk && pnpm test`: run Vitest.
- `cd 02-backends/console.labyrinthscout.com && pnpm dev`: run Scout in watch mode.
- `cd 02-backends/console.labyrinthscout.com && pnpm typecheck && pnpm test`: validate Scout before changes ship.
- `cd 02-backends/admin/ops.carinaai.uk && pnpm dev`: run the VERLOX ops panel on port 4000.
- `cd 02-backends/admin/ops.carinaai.uk && pnpm css`: rebuild Tailwind output for EJS views.
- `cd 03-frontends/client-apps/carinaMobile && pnpm start`: Expo dev server for the Carina mobile app.
- `cd 03-frontends/client-apps/carinaMobile && pnpm test`: Vitest for mobile config and API helpers.

## Coding Style & Naming Conventions

Code is TypeScript ESM. Match local style: two-space indentation, semicolons, single quotes, named exports for shared helpers, and explicit types at module boundaries. Keep Express route files grouped by feature, for example `routes/settings.ts` or `src/api/events.ts`. Tests use `*.test.ts` beside the code they cover.

## Testing Guidelines

Vitest is the active test framework for `02-backends/core.carinaai.uk/` and `02-backends/console.labyrinthscout.com/`. Core tests include V8 coverage with current thresholds of 60% lines and 60% functions. Add tests for agent tools, security policy, API handlers, and regression-prone wiring. Run the package's `pnpm test` before handing off; run `pnpm typecheck` where available.

## Commit & Pull Request Guidelines

Git history uses short imperative subjects, often with Conventional Commit scopes: `fix(deploy): ...`, `docs(security): ...`, `feat: ...`, `chore: ...`. Keep commits focused. Pull requests should state the affected product area, list validation commands, link any issue or prompt, and include screenshots for ops panel or public UI changes.

## Security & Configuration Tips

Never commit real `.env` files, API keys, `.htpasswd`, or credentials. Use the existing `.env.example` files in `02-backends/core.carinaai.uk/`, `02-backends/admin/ops.carinaai.uk/`, and `02-backends/console.labyrinthscout.com/`. Preserve Scout/Carina trust boundaries: Carina reports sanitized telemetry; Scout control actions must remain scoped and auditable.

## Ops panel: auth and user management

Read **`docs/OPS-USER-MANAGEMENT.md`** before changing login, roles, tenant admin, or Scout subscriber accounts.

Summary for agents:

- **Ops operators** (`/users`, superadmin only): `02-backends/admin/ops.carinaai.uk/`
- **Cloud subscribers** (`/tenants`): app.carinaai.uk better-auth users; do not add a second admin UI
- **Scout customer accounts** (`/scout/accounts`): console.labyrinthscout.com `/account/*` users; API in Scout `src/api/admin.ts`
- **core.carinaai.uk** and **Scout dashboard**: single-password operator surfaces; password changes via ops Settings only
- **Deploy ops:** run `pnpm build` in ops first; production uses `docker/Dockerfile.runtime` (pre-built `dist/`)
- **Deploy Scout console:** build Docker image from `$APPS_ROOT` (monorepo context), not from inside `console.labyrinthscout.com/` alone
- **Env:** set `SCOUT_ACCOUNT_PUBLIC_URL` in ops `.env` for Scout password setup links

## Production: carinaai.uk marketing site (Docker nginx)

**CRITICAL (owner hard rule):** Contabo deploys must **never** leave https://carinaai.uk/ broken. After any Contabo deploy, verify HTTP 200. See `/opt/lampp/htdocs/verlox/shared/workspace-governance/CONTABO-CARINAAI-UK-NEVER-BREAK.md` and `.cursor/rules/contabo-carinaai-uk-never-break.mdc`.

`https://carinaai.uk/` is served by the **Docker `nginx` container**, not host aaPanel nginx. Live files: `core.carinaai.uk/public_website/` (bind mount).

**After rsync or any change under `public_website/`, recreate nginx** or the site can 403 while `index.html` exists on the host (stale Docker bind mount inode):

```bash
cd core.carinaai.uk && bash docker/scripts/reload-marketing-nginx.sh
```

`scripts/deploy-marketing.sh` and `scripts/deploy-carina.sh` run this automatically. Read `core.carinaai.uk/docker/DEPLOY.md` and `public_website/README-DEPLOY.md` before manual marketing deploys.

## Terminology: Playbook vs Cookbook

**Playbook** is the user-facing product term: situational decision engine, hardware-aware model discovery, workspace `/playbook`, CLI `carina playbook`.

**Cookbook** is an internal implementation label only (`src/cookbook/`, `cookbook-api.ts`). Do not use it in operator-facing copy, docs, or UI. `carina cookbook` may remain as a deprecated CLI alias with a brief notice pointing to `carina playbook`.
