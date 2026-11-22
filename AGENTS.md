# Repository Guidelines

## HOLD (2026-09-20; hygiene lift 2026-11-22)

Carina product development remains on hold. Live Contabo sites stay as they are.
Repo hygiene on 2026-11-22 is allowed: consolidate remotes, strip Aiva/Scout, rename GitHub.

See `HOLD.md`. Do not start product feature work, restores, or Contabo demos unless the owner lifts the hold.

## CRITICAL: Public GitHub hygiene (product files only)

Before any commit or push to GitHub, track **only files that make this product work**. Planning docs, prompt queues, competitor research, personal notes, runtime logs, secrets, and nested foreign product trees stay workstation-local (`.gitignore` + `git rm --cached`). Canonical rule: `/home/malike/verlox/shared/workspace-governance/PUBLIC-GITHUB-ACCOUNT-SPLIT.md` and `/home/malike/verlox/AGENTS.md`.

## Writing style (hard constraint)

Never use em dashes (U+2014) or en dashes (U+2013). Use `;`, `:`, `,`, `-`, parentheses, or sentence breaks instead. Never use emojis anywhere. See `/home/malike/verlox/AGENTS.md` and run `python3 ../scripts/fix-writing-style.py` after bulk doc edits.

## Project Structure & Module Organization

This is the VERLOX Carina platform monorepo. Canonical GitHub remote: `malike2356/carina` (renamed from `carina-ai` on 2026-11-22).

**Aiva and Scout are not part of this repo.**

- Aiva: Hermes core at `/home/malike/verlox/aiva2/` and GitHub `malike2356/aiva`
- Scout: personal research at `/home/malike/verlox/scout/` and GitHub `malike2356/scout`
- Stripped Carina trees (2026-11-22): `/home/malike/verlox/archive/carina-stripped-aiva-scout-20261122/`

**Marketing site** is a separate repo: `malike2356/carinaai.uk`. Live Contabo marketing files still bind-mount from `core.carinaai.uk/public_website/` on the server.

**Hard rule:** Never create, restore, or edit under `carina/verlox/` or `carina/verlox/carina/`. That path is forbidden. Work only under top-level `02-backends/`, `03-frontends/`, `scripts/`, etc.

Canonical layout:

- `02-backends/core.carinaai.uk/`: Carina agent (CLI in `bin/`, source in `src/`, knowledge in `brain/`)
- `02-backends/admin/ops.carinaai.uk/`: VERLOX ops panel
- `02-backends/keys-server/`: shared licence key service
- `03-frontends/client-apps/`: `app.carinaai.uk/`, `admin.carinaai.uk/`, `carinaMobile/`, `carina-desktop/`
- `03-frontends/marketing/`: docs, hub, and related marketing apps (not hireaiva; not Scout)
- `03-frontends/integrations/` and `03-frontends/sdks/`: client integrations and SDKs
- `01-devends/`: prompts library (do not confuse with runtime `brain/`)
- Top-level `brain/`: company RAG corpus (separate from core package brain)

Public Docusaurus docs: `03-frontends/marketing/docs.carinaai.uk/`. Deploy: `scripts/deploy-carina.sh` (`PLATFORM_ROOT` is this repo root). **Production deploy guide:** `docs/DEPLOYMENT-GUIDE.md`.

## Build, Test, and Development Commands

Use package-local commands from the relevant directory.

- `cd 03-frontends/marketing/docs.carinaai.uk && pnpm start`: Docusaurus docs site.
- `cd 02-backends/core.carinaai.uk && pnpm docs:dev`: alias to Docusaurus dev server.
- `cd 02-backends/core.carinaai.uk && pnpm dev`: run the Carina agent in watch mode.
- `cd 02-backends/core.carinaai.uk && pnpm carina`: run the CLI entry point.
- `cd 02-backends/core.carinaai.uk && pnpm build`: compile TypeScript and copy gateway web assets.
- `cd 02-backends/core.carinaai.uk && pnpm test`: run Vitest.
- `cd 02-backends/admin/ops.carinaai.uk && pnpm dev`: run the VERLOX ops panel on port 4000.
- `cd 02-backends/admin/ops.carinaai.uk && pnpm css`: rebuild Tailwind output for EJS views.
- `cd 03-frontends/client-apps/carinaMobile && pnpm start`: Expo dev server for the Carina mobile app.
- `cd 03-frontends/client-apps/carinaMobile && pnpm test`: Vitest for mobile config and API helpers.

## Coding Style & Naming Conventions

Code is TypeScript ESM. Match local style: two-space indentation, semicolons, single quotes, named exports for shared helpers, and explicit types at module boundaries. Keep Express route files grouped by feature. Tests use `*.test.ts` beside the code they cover.

## Testing Guidelines

Vitest is the active test framework for `02-backends/core.carinaai.uk/`. Core tests include V8 coverage with current thresholds of 60% lines and 60% functions. Run the package's `pnpm test` before handing off; run `pnpm typecheck` where available.

Note: after the 2026-11-22 Aiva/Scout strip, some deeper modules may still import archived paths. Fix those when lifting HOLD for product work; do not restore Aiva/Scout trees into this repo without an owner request.

## Commit & Pull Request Guidelines

Git history uses short imperative subjects, often with Conventional Commit scopes: `fix(deploy): ...`, `docs(security): ...`, `feat: ...`, `chore: ...`. Keep commits focused.

## Security & Configuration Tips

Never commit real `.env` files, API keys, `.htpasswd`, or credentials. Use the existing `.env.example` files in `02-backends/core.carinaai.uk/` and `02-backends/admin/ops.carinaai.uk/`.

## Production: carinaai.uk marketing site (Docker nginx)

**CRITICAL (owner hard rule):** Contabo is a shared host. Deploys must **never** leave any indexed Contabo live service broken. After any Contabo deploy, run `bash /home/malike/verlox/scripts/check-contabo-never-break.sh`. See `/home/malike/verlox/shared/workspace-governance/CONTABO-NEVER-BREAK-SERVICES.md`.

`https://carinaai.uk/` is served by the **Docker `nginx` container**, not host aaPanel nginx. Live files: `core.carinaai.uk/public_website/` (bind mount).

**After rsync or any change under `public_website/`, recreate nginx** or the site can 403:

```bash
cd core.carinaai.uk && bash docker/scripts/reload-marketing-nginx.sh
```

## Terminology: Playbook vs Cookbook

**Playbook** is the user-facing product term: situational decision engine, hardware-aware model discovery, workspace `/playbook`, CLI `carina playbook`.

**Cookbook** is an internal implementation label only (`src/cookbook/`, `cookbook-api.ts`). Do not use it in operator-facing copy, docs, or UI.
