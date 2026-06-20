# VERLOX Carina Monorepo

This repository contains several products that share the Carina and Labyrinth Scout platform. It is not one Node workspace. Each product directory owns its own dependencies, scripts, database access, and deployment path.

Use this file as the first map before changing code.

## Canonical Tree

```text
external/
  client-apps/
    app.carinaai.uk/           Hosted SaaS app: Next.js frontend and API backend
    carinaMobile/              Expo mobile companion
    carina-desktop/            Tauri desktop companion
  integrations/
    extensions/                IDE extensions and client integrations
  sdks/
    labyrinth-scout-sdk/       Scout integration SDK
    carina-agent-public/       Public agent export

internal/
  servers/
    core.carinaai.uk/          Carina agent core, CLI, gateway, packs
    console.labyrinthscout.com/ Scout console server and dashboard
    scout-engine/              Scout engine service
  admin/
    ops.carinaai.uk/           VERLOX internal operations panel

marketing/
  sites/
    carinaai.uk/               Public Carina marketing site
    labyrinthscout.com/        Public Scout marketing site
    trust.labyrinthscout.com/  Trust microsite
    hub.carinaai.uk/           Public hub placeholder
  docs/
    docs.carinaai.uk/          Docusaurus public documentation
  shared/
    shared/                    Shared public CSS and docs assets

product/
  planning/
    build-plan/                Build roadmap and workflow planning
    design/                    Branding, images, and design prompts
    operations/                Runbooks and implementation plans
    product/                   Product bibles and category docs
    prompts/                   Build prompts and gap-closing prompts
    security/                  Internal security planning
    strategy/                  Positioning and competitive analysis
  archive/
    archive/                   Archived material
```

The repo root is intentionally small. Work inside `external/`, `internal/`, `marketing/`, or `product/` first, then choose the product directory.

## Product Map

| Product | Directory | Type | Runtime | Audience |
|---|---|---|---|---|
| Carina Cloud | `external/client-apps/app.carinaai.uk/` | Frontend + backend | Next.js, Postgres | Hosted SaaS users |
| Carina Agent Core | `internal/servers/core.carinaai.uk/` | Backend + CLI + packaged web assets | Node.js, TypeScript | npm, Docker, operator installs |
| Public docs | `marketing/docs/docs.carinaai.uk/` | Frontend docs | Docusaurus | Users and developers |
| Carina marketing | `marketing/sites/carinaai.uk/` | Static frontend | HTML, CSS, JS | Public website |
| Labyrinth Scout Console | `internal/servers/console.labyrinthscout.com/` | Backend + frontend | Express, TypeScript | Scout tenants and VERLOX |
| Scout marketing | `marketing/sites/labyrinthscout.com/` | Static frontend | HTML, CSS, JS | Public website |
| VERLOX Ops Panel | `internal/admin/ops.carinaai.uk/` | Backend + frontend | Express, EJS, Tailwind | Internal only |
| Carina Mobile | `external/client-apps/carinaMobile/` | Frontend app + native bridges | Expo Router | Mobile companion |
| Carina Desktop | `external/client-apps/carina-desktop/` | Frontend app + native shell | Tauri, Vite | Desktop companion |
| Scout SDK | `external/sdks/labyrinth-scout-sdk/` | Library | TypeScript | Integrators |
| Scout Engine | `internal/servers/scout-engine/` | Backend service | Node.js, TypeScript | Scout engine work |
| Product planning | `product/planning/` | Docs and prompts | Markdown | Internal planning |
| Shared UI assets | `marketing/shared/shared/` | Shared static assets | CSS | Docs and sites |
| Deploy scripts | `scripts/` | Operations | Bash | VPS deploys |

## Backend vs Frontend

### Backends

Use these when changing APIs, persistence, auth, billing, events, or server-side workflow.

| Backend | Main files | Local command | Validation |
|---|---|---|---|
| Carina Cloud API | `external/client-apps/app.carinaai.uk/src/app/api/`, `src/lib/`, `src/db/` | `cd external/client-apps/app.carinaai.uk && pnpm dev` | `pnpm build` |
| Carina Agent Core | `internal/servers/core.carinaai.uk/src/` | `cd internal/servers/core.carinaai.uk && pnpm dev` | `pnpm test`, `pnpm build` |
| Scout Console API | `internal/servers/console.labyrinthscout.com/src/` | `cd internal/servers/console.labyrinthscout.com && pnpm dev` | `pnpm typecheck && pnpm test` |
| Ops Panel API | `internal/admin/ops.carinaai.uk/server.ts`, `routes/`, `lib/` | `cd internal/admin/ops.carinaai.uk && pnpm dev` | `pnpm build`, `pnpm test` |
| Scout Engine | `internal/servers/scout-engine/src/` | `cd internal/servers/scout-engine && pnpm dev` | `pnpm build`, `pnpm test` |

### Frontends

Use these when changing screens, navigation, copy, layout, visual design, or client-side behavior.

| Frontend | Main files | Local command | Validation |
|---|---|---|---|
| Carina Cloud app | `external/client-apps/app.carinaai.uk/src/app/`, `src/components/` | `cd external/client-apps/app.carinaai.uk && pnpm dev` | `pnpm build` |
| Public docs | `marketing/docs/docs.carinaai.uk/docs/`, `src/` | `cd marketing/docs/docs.carinaai.uk && pnpm start` | `pnpm build`, `pnpm typecheck` |
| Carina marketing | `marketing/sites/carinaai.uk/` | Open static files or serve locally | Manual browser check |
| Scout marketing | `marketing/sites/labyrinthscout.com/` | Open static files or serve locally | Manual browser check |
| Ops Panel UI | `internal/admin/ops.carinaai.uk/views/`, `public/`, `tailwind.css` | `cd internal/admin/ops.carinaai.uk && pnpm dev` | `pnpm css`, `pnpm build` |
| Scout Console UI | `internal/servers/console.labyrinthscout.com/public/`, `src/` | `cd internal/servers/console.labyrinthscout.com && pnpm dev` | `pnpm typecheck && pnpm test` |
| Mobile app | `external/client-apps/carinaMobile/app/`, `src/`, `components/` | `cd external/client-apps/carinaMobile && pnpm start` | `pnpm typecheck && pnpm test` |
| Desktop app | `external/client-apps/carina-desktop/src/` | `cd external/client-apps/carina-desktop && pnpm dev` | `pnpm type-check`, `pnpm build:vite` |

## Common Workflows

### Change hosted chat or SaaS screens

1. Work in `external/client-apps/app.carinaai.uk/`.
2. Put API changes in `src/app/api/`.
3. Put database schema in `src/db/schema.ts` and migrations in `src/db/migrations/`.
4. Put reusable server logic in `src/lib/`.
5. Put screens in `src/app/(workspace)/` or `src/app/(launcher)/`.
6. Put reusable UI in `src/components/`.
7. Validate with `pnpm build`.
8. Deploy from `external/client-apps/app.carinaai.uk/` with `bash deploy.sh`.

### Change the packaged Carina agent

1. Work in `internal/servers/core.carinaai.uk/`.
2. CLI entry points live in `bin/`.
3. Agent behavior, tools, security, memory, and gateway code live in `src/`.
4. Product packs live in `packages/packs/`.
5. Validate with `pnpm test` and `pnpm build`.
6. Deploy or publish through the core deploy and publish scripts, not the cloud app deploy.

### Change public documentation

1. Work in `marketing/docs/docs.carinaai.uk/`.
2. Edit user and developer docs there.
3. Do not edit deprecated docs under `core.carinaai.uk/docs/` unless intentionally preserving legacy content.
4. Validate with `pnpm build`.
5. Deploy through the marketing deploy flow.

### Change marketing pages

1. Work in `marketing/sites/carinaai.uk/` or `marketing/sites/labyrinthscout.com/`.
2. These are static sites, not the SaaS app.
3. Use extensionless links such as `/pricing`, not `/pricing.html`.
4. Deploy with `bash scripts/deploy-marketing.sh` from the repo root.

### Change Scout

1. Work in `internal/servers/console.labyrinthscout.com/` for the customer console.
2. Work in `external/sdks/labyrinth-scout-sdk/` for the integration SDK.
3. Work in `internal/servers/scout-engine/` for engine experiments and services.
4. Validate console work with `pnpm typecheck && pnpm test`.
5. Deploy console work with `bash scripts/deploy-scout.sh` from the repo root.

### Change internal operations

1. Work in `internal/admin/ops.carinaai.uk/`.
2. Routes live in `routes/`.
3. Helpers live in `lib/`.
4. Views live in `views/`.
5. Rebuild CSS with `pnpm css` when Tailwind classes change.
6. This panel is internal only. Do not treat it as customer product code.

## Deployment Map

| Deploy target | Source directory | Command |
|---|---|---|
| Carina Cloud, `app.carinaai.uk` | `external/client-apps/app.carinaai.uk/` | `cd external/client-apps/app.carinaai.uk && bash deploy.sh` |
| Carina Agent and core services | `internal/servers/core.carinaai.uk/` | `bash scripts/deploy-carina.sh` |
| Scout Console | `internal/servers/console.labyrinthscout.com/` | `bash scripts/deploy-scout.sh` |
| Public marketing and docs | `marketing/sites/`, `marketing/docs/` | `bash scripts/deploy-marketing.sh` |

The VPS is a deployment target. Make changes locally, then deploy with the relevant script.

## Repository Rules

- Run commands from the package directory, not from the repo root.
- Do not mix lockfiles or package managers inside one product.
- Do not move product directories casually. Domains are part of deployment and nginx routing.
- Keep canonical paths under `external/`, `internal/`, `marketing/`, and `product/`.
- Do not put customer-facing docs in `product/planning/`; that folder is internal planning.
- Do not add new root-level apps without updating this file and `AGENTS.md`.
- Never commit `.env` files, API keys, `.htpasswd`, or credentials.
- For broad doc edits, run `python3 ../scripts/fix-writing-style.py` from package directories or `python3 scripts/fix-writing-style.py` from the repo root.

## Cleanup Plan

Use this order when simplifying the repository.

1. Keep product directories stable under their canonical group folders.
2. Move old planning material into `product/archive/` only after confirming it is not referenced by active docs or deploy scripts.
3. Keep frontends and backends separated inside each product before moving directories across products.
4. In `app.carinaai.uk`, keep route handlers in `src/app/api`, UI routes in `src/app/(workspace)` and `src/app/(launcher)`, shared UI in `src/components`, and server helpers in `src/lib`.
5. In `core.carinaai.uk`, keep public package code under `src`, packs under `packages/packs`, and generated or copied web assets under `packages/web`.
6. Remove duplicate docs by choosing one source of truth: root `README.md` for repo navigation, `product/docs/ARCHITECTURE.md` for cross-product wiring, `marketing/docs/docs.carinaai.uk` for public docs, and `product/planning/` for internal planning.
7. Standardize validation per product before larger moves. A cleanup change should say which product it touched and which command passed.

## Quick Start

```bash
# Hosted SaaS app
cd external/client-apps/app.carinaai.uk
pnpm dev

# Agent core
cd internal/servers/core.carinaai.uk
pnpm dev

# Public docs
cd marketing/docs/docs.carinaai.uk
pnpm start

# Scout console
cd internal/servers/console.labyrinthscout.com
pnpm dev

# Internal ops panel
cd internal/admin/ops.carinaai.uk
pnpm dev
```

## Mental Model

Carina Cloud is the hosted SaaS. Carina Agent Core is the packaged agent. Scout is the security product. Ops is the internal control room. Marketing and docs are separate public frontends. Mobile and Desktop are companion clients.

When in doubt, choose the directory by product first, then by layer: `app` for routes and screens, `api` for HTTP handlers, `lib` for backend logic, `components` for UI, `db` for persistence.
