# Repo path map (for pending prompts)

**Updated:** 2026-06-25

Prompts were written against an older tree. Use these paths when implementing.

| Prompt path | Actual repo path |
|-------------|------------------|
| `02-backends/core.carinaai.uk/` | Core agent API, migrations, Docker stack |
| `02-backends/admin/ops.carinaai.uk/` | VERLOX ops panel (ops.carinaai.uk) |
| `02-backends/console.labyrinthscout.com/` | Scout console |
| `02-backends/scout-engine/` | Scout engine API |
| `03-frontends/client-apps/app.carinaai.uk/` | Customer workspace (app.carinaai.uk) |
| `03-frontends/client-apps/admin.carinaai.uk/` | Admin dashboard (admin.carinaai.uk) |
| `03-frontends/marketing/carinaai.uk/` | Marketing site source (`public_website/` on VPS) |
| `03-frontends/marketing/docs.carinaai.uk/` | Docusaurus docs |
| `scripts/` | Repo-root deploy (`deploy-carina.sh`); `deploy-lib.sh` is a wrapper |
| `02-backends/core.carinaai.uk/docker/scripts/` | VPS-synced deploy (`deploy-prod.sh`, `deploy-atomic.sh`, `deploy-lib.sh`) |

## Production layout (Docker-first)

| VPS path | Role |
|----------|------|
| `/home/malike/apps/core.carinaai.uk/` | Carina Compose stack (core, ops, cloud, nginx, postgres) |
| `/home/malike/apps/app.carinaai.uk/` | Cloud app build context + standalone artifacts |
| `/home/malike/apps/ops.carinaai.uk/` | Ops panel build context |
| `/home/malike/apps/console.labyrinthscout.com/` | Scout Compose stack |
| `core.carinaai.uk/public_website/` | Marketing bind mount for Docker nginx |
| `core.carinaai.uk/.deploy/` | Release tags and rollback history (created by deploy-atomic) |

## Deploy commands

From laptop (full stack):

```bash
bash scripts/deploy-carina.sh
```

On VPS (Carina stack only, atomic):

```bash
cd /home/malike/apps/core.carinaai.uk
bash docker/scripts/deploy-prod.sh
```

Rollback one service:

```bash
bash docker/scripts/deploy-atomic.sh --rollback carina-web
```

## Archive paths

| From | To |
|------|-----|
| `01-devends/prompts/01-pending_prompts/` | `01-devends/prompts/02-archived_prompts/` |

Do not use PM2, `/var/www/*/releases/`, or host nginx for Carina production. All Carina traffic is Docker nginx on ports 80/443.
