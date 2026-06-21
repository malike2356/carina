# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working in this repository.

## What This Repo Is

This is the VERLOX Carina mono-repo. Each directory is named after its domain or purpose. The git root is here (`Carina-ai/`).

## Directory Map

```
Carina-ai/                      GIT ROOT
│
├── core.carinaai.uk/           CARINA AGENT - the sellable product
│   ├── src/                    Node.js/TypeScript agent source
│   ├── bin/carina.ts           npm global CLI entry point
│   ├── brain/                  Property knowledge corpus (property-uk skill pack)
│   ├── docs/                   Legacy VitePress sources (migrated to docs.carinaai.uk/)
│   ├── docker/                 Dockerfiles + nginx + postgres configs
│   ├── docker-compose.yml      Dev stack (Postgres + Redis)
│   ├── docker-compose.prod.yml Production stack
│   ├── docker-compose.verlox.yml  VERLOX personal full stack (admin + scout)
│   ├── deploy.sh               VPS deploy script
│   ├── prompts/                Carina build phase prompts (all 5 phases done)
│   ├── archive/                Dead code - old Laravel/Python specs (gitignored)
│   ├── .env                    Local dev API keys (gitignored)
│   ├── package.json            pnpm scripts for Carina
│   └── CLAUDE.md               Detailed Carina agent guidance (read this next)
│
├── ops.carinaai.uk/            VERLOX PRIVATE ADMIN - never shipped to customers
│   ├── server.ts               Express/EJS admin panel (port 4000)
│   ├── routes/                 Chat, Security, Memories, Skills, RAG, Projects
│   ├── views/                  EJS templates
│   └── prompts/                01-security-tab.md, 02-chat-tab-fix.md
│
├── console.labyrinthscout.com/             LABYRINTH SCOUT SERVER - security product (built)
│   ├── src/                    Server code (built by Cursor)
│   ├── public/                 Dashboard HTML
│   └── prompts/                01-dashboard.md through 12-sdk-packages.md
│
├── labyrinthscout.com/         SCOUT MARKETING SITE
│   └── index.html              labyrinthscout.com landing page
│
├── carinaai.uk/                CARINA MARKETING SITE
│   └── index.html              carinaai.uk landing page
│
├── docs.carinaai.uk/           DOCUSAURUS DOCS (docs.carinaai.uk)
│   ├── docs/user/              User guides
│   └── docs/developer/         Developer reference
│
├── carinaMobile/                CARINA MO APP (Expo Router companion)
│
├── scripts/                    Deploy scripts (deploy-carina.sh, deploy-marketing.sh)
│
├── instructions/               PLANNING, DESIGN, AND PRODUCT DOCS (not shipped)
│   ├── build-plan/             Build roadmap, comparison tables, tool decisions
│   ├── design/                 Branding, UI images, ChatGPT design prompts
│   │   ├── branding/           Logo and visual decisions (decisions/ + journey/)
│   │   ├── images/             Reference screenshots (carina/ + scout/)
│   │   └── prompts/            Image-gen prompts for launcher and TUI redesign
│   ├── media/                  Audio files and credentials - gitignored
│   ├── operations/             Deployment runbooks, audits, checklists, kanban
│   ├── outreach/               Pitch decks, enterprise templates, partner kits
│   ├── product/                Product bible, manifesto, category definition
│   ├── prompts/                Agent build prompt packs (gap series, upgrade series)
│   ├── security/               Threat models, hardening guides, incident SLAs
│   ├── strategy/               Platform strategy, positioning, competitive analysis
│   │   └── competitive/        Carina vs Hermes / OpenClaw / Odysseus / Claude
│   └── trust/                  Operator trust templates and checklists
│
├── .gitignore                  Covers whole repo
├── .npmrc                      pnpm config
└── .dockerignore               Docker build exclusions
```

## Where To Start

- **Working on Carina agent code** → `cd core.carinaai.uk` and read `core.carinaai.uk/CLAUDE.md`
- **Working on the admin panel** → `cd ops.carinaai.uk`, start with `prompts/01-security-tab.md`
- **Building Labyrinth Scout** → `cd console.labyrinthscout.com`, start with `prompts/01-dashboard.md`
- **Mobile companion** → `cd carinaMobile`
- **Product identity / strategy** → `instructions/product/PRODUCT_BIBLE.md` and `instructions/strategy/`
- **Build roadmap / what to build next** → `instructions/build-plan/ROADMAP.md`
- **Design mockups and prompts** → `instructions/design/`
- **Operations runbooks** → `instructions/operations/`

## Run Commands (all from `core.carinaai.uk/`)

```bash
cd core.carinaai.uk

pnpm cli              # Carina CLI on port 3333
pnpm dev              # tsx watch
pnpm test             # Vitest (5,369 tests)
pnpm build            # Compile TypeScript
pnpm ingest           # Ingest property RAG corpus
pnpm admin            # Admin panel on http://localhost:4000
pnpm hub              # Skills Hub server
pnpm docs:dev         # Docusaurus (docs.carinaai.uk)
bash deploy.sh        # Deploy to VPS
```

## Products vs Private

| Directory | Shipped to customers? | How |
|---|---|---|
| `core.carinaai.uk/` | Yes | npm package + Docker image |
| `console.labyrinthscout.com/` | Yes | Docker image (`verlox/scout`) |
| `ops.carinaai.uk/` | No | VERLOX internal only |
| `carinaai.uk/` | Yes | Static files to carinaai.uk |
| `labyrinthscout.com/` | Yes | Static files to labyrinthscout.com |
| `carinaMobile/` | Companion | Expo app (not npm package) |
| `docs.carinaai.uk/` | Yes | Built to `carinaai.uk/docs` via `scripts/deploy-marketing.sh` |

**CRITICAL: Never edit files directly on the VPS.** All changes must be made locally, committed to git, and deployed via `bash scripts/deploy-carina.sh`, `bash scripts/deploy-marketing.sh`, or `bash scripts/deploy-scout.sh`. Direct VPS edits diverge from git history and cause merge conflicts on the next deploy. The VPS is a deployment target, not a development environment.
