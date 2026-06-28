# PgBouncer connection pooling (Docker production)

Last updated: 2026-06-25

Production and staging use **PgBouncer in Docker**, not a host `apt-get` install. The pooler sits between app containers and Postgres on the internal Docker network.

## Architecture

| Environment | Pooler service | Host:port (inside Docker network) | Postgres service |
|-------------|----------------|-----------------------------------|------------------|
| Production | `pgbouncer` | `pgbouncer:6432` | `postgres:5432` |
| Staging | `pgbouncer-staging` | `pgbouncer-staging:6432` | `postgres-staging:5432` |

- **Pool mode:** `transaction` (correct for Node.js `pg` pools)
- **default_pool_size:** 20 (prod), 10 (staging)
- **max_client_conn:** 200 (prod), 100 (staging)
- **Auth:** `auth_type = any` inside the private Docker network; Postgres still enforces credentials

Config files:

- `docker/pgbouncer/pgbouncer.ini` (production databases: `carina`, `carina_skills_hub`, `carina_cloud`)
- `docker/pgbouncer/pgbouncer.staging.ini` (`carina_staging`)
- `docker/pgbouncer/userlist.txt`

## DATABASE_URL

Apps must use port **6432** and the pooler hostname, not `postgres:5432`.

```env
# Production (Docker)
DATABASE_URL=postgresql://carina:SECRET@pgbouncer:6432/carina

# Staging (Docker)
DATABASE_URL=postgresql://carina:SECRET@pgbouncer-staging:6432/carina_staging
```

Env sync scripts rewrite runtime files on deploy:

| Script | When | Default `PGBOUNCER_ENABLED` |
|--------|------|-------------------------------|
| `sync-docker-env.py` | `deploy-prod.sh` | `1` |
| `sync-cloud-env.py` | `deploy-prod.sh` | `1` |
| `sync-ops-env.py` | `deploy-prod.sh` | `1` |
| `sync-staging-env.py` | `deploy-staging.sh` | `1` |

Set `PGBOUNCER_ENABLED=0` before running a sync script to bypass the pooler (debugging only).

`docker-compose.prod.yml` and `docker-compose.staging.yml` also set `DATABASE_URL` / `CARINA_DB_URL` / `SKILLS_HUB_DATABASE_URL` to the pooler so containers cannot accidentally skip it.

## Deploy

```bash
# Production: starts postgres, redis, pgbouncer before apps
bash docker/scripts/deploy-prod.sh

# Staging
bash docker/scripts/deploy-staging.sh
```

## Monitoring

From the VPS host:

```bash
cd /home/malike/apps/core.carinaai.uk

# Production pool stats
bash docker/scripts/pgbouncer-admin.sh SHOW POOLS
bash docker/scripts/pgbouncer-admin.sh SHOW STATS

# Staging
COMPOSE_FILE=docker-compose.staging.yml PGBOUNCER_SERVICE=pgbouncer-staging \
  bash docker/scripts/pgbouncer-admin.sh SHOW POOLS
```

`/health` on core runs `SELECT 1` through the app `DATABASE_URL`. If that succeeds, PgBouncer and Postgres are reachable.

## Reload config (no restart)

After editing `pgbouncer.ini` or `userlist.txt`:

```bash
docker compose -f docker-compose.prod.yml exec pgbouncer kill -HUP 1
# or admin console:
bash docker/scripts/pgbouncer-admin.sh RELOAD
```

Do not `docker compose restart pgbouncer` during traffic unless necessary; reload drops fewer client sessions.

## Add a new database

1. Create the database in Postgres (`init.sql` or migration).
2. Add a `[databases]` entry in `docker/pgbouncer/pgbouncer.ini`.
3. Reload PgBouncer (above).
4. Point the app's `DATABASE_URL` at `pgbouncer:6432/new_dbname`.

## Transaction mode incompatibilities (audit 2026-06-25)

Audited `02-backends/core.carinaai.uk/src` and `app.carinaai.uk`:

| Feature | Found in codebase | Action |
|---------|-------------------|--------|
| `LISTEN` / `pg_notify` | No | N/A |
| Advisory locks (`pg_advisory_*`) | No | N/A |
| Session `SET` in app queries | No | N/A |
| Named prepared statements (`{ name, text, values }`) | No | N/A |

If any of these are added later:

- **LISTEN/NOTIFY:** use a dedicated `pg.Client` to `postgres:5432`, bypassing PgBouncer.
- **Advisory locks:** use table-based locks (`INSERT ... ON CONFLICT`) instead.
- **Session `SET`:** put settings in the connection string or `ignore_startup_parameters` in `pgbouncer.ini`.
- **Named prepared statements:** remove the `name` field; use anonymous queries.

Scout and other stacks with separate Postgres instances connect directly to their own `postgres:5432` (not through Carina PgBouncer).

## Host-level PgBouncer (legacy / non-Docker)

If you run Postgres on the host without Docker, install `pgbouncer` via apt, listen on `127.0.0.1:6432`, and point `DATABASE_URL` at `127.0.0.1:6432`. The Docker path above is the supported production layout for Carina.
