# Carina Cloud

Next.js 15 hosted workspace for [app.carinaai.uk](https://app.carinaai.uk).

## Stack

- Next.js 15 App Router, React 19
- Better-Auth (email/password, optional Google OAuth)
- Drizzle ORM + PostgreSQL (`carina_cloud` database)
- AES-256-GCM BYOK vault (`VAULT_SECRET`)
- Stripe billing (Starter / Team plans)
- Chat via `@verlox/carina-core` internal router with per-request BYOK injection

## Local development

```bash
cd app.carinaai.uk
pnpm install
cp .env.example .env
pnpm db:migrate
pnpm dev
```

Open http://localhost:4100

## Deploy

See `docker/carina-cloud.conf` and `docker/app.carinaai.uk.conf`. Run `bash deploy.sh` from this directory after one-time VPS setup (supervisor, nginx, Postgres database `carina_cloud`).

## Database bootstrap (one-time on VPS)

```bash
psql postgresql://carina:secret@localhost:5433/postgres -tc "SELECT 1 FROM pg_database WHERE datname='carina_cloud'" | grep -q 1 || \
  psql postgresql://carina:secret@localhost:5433/postgres -c 'CREATE DATABASE carina_cloud;'
```

Then run migrations from a machine with `DATABASE_URL` set:

```bash
pnpm db:migrate
```

## Contact

Verlox Ltd: [contact@verlox.uk](mailto:contact@verlox.uk)
