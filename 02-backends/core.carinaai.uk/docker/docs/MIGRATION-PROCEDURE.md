# Migration procedure

Last updated: 2026-06-24

## Rules

1. Every schema change is a numbered SQL file under `src/infrastructure/migrations/`.
2. Migrations run automatically during atomic deploy (`deploy-atomic.sh` calls `run_migrations()` before `carina-web` starts).
3. Migrations must be idempotent:
   - `CREATE TABLE IF NOT EXISTS` / `CREATE INDEX IF NOT EXISTS`
   - `ADD COLUMN IF NOT EXISTS` on every `ALTER TABLE`
   - `ON CONFLICT DO NOTHING` on seed `INSERT`s
4. Never edit a migration after it has run in production; add a new numbered file instead.
5. Never renumber migrations; `009` stays `009` forever.
6. Prefer a paired `NNN-name-rollback.sql` for manual recovery (never run automatically).
7. Roll back application code first; roll back schema only when no new-format data exists.

## Deploy flow

1. Test on staging (apply SQL, deploy staging, smoke test).
2. Take a fresh backup: `bash docker/scripts/backup-postgres.sh`
3. Deploy production: `bash docker/scripts/deploy-prod.sh`
4. Verify: `curl -fsS https://core.carinaai.uk/health`

```bash
cd /home/malike/apps/core.carinaai.uk
bash docker/scripts/deploy-prod.sh
```

`deploy-atomic.sh`:

1. Builds and tags `carina-release/*` images
2. Applies pending SQL migrations against Postgres
3. Rolls containers to new images
4. Health-checks `/health`
5. Records release metadata under `.deploy/`

## Manual migration (emergency)

```bash
docker compose -f docker-compose.prod.yml exec postgres \
  psql -U "$POSTGRES_USER" -d carina -f /path/to/migration.sql
```

Prefer the deploy script so migration order stays consistent.

## Staging-first workflow

Before production:

1. Apply migration on staging: `docker compose -f docker-compose.staging.yml exec postgres-staging psql -U carina -d carina_staging -f /path/to/migration.sql`
2. Deploy staging: `bash docker/scripts/deploy-staging.sh` (runs migrations + atomic service deploy)
3. Seed or reset data: `bash docker/scripts/seed-staging.sh`
4. Smoke test:
   - `curl -fsS https://staging.core.carinaai.uk/health`
   - `curl -fsS https://staging.app.carinaai.uk/api/health`
   - `curl -fsS https://staging.admin.carinaai.uk/api/health`
   - Log in to staging app; verify core features
5. If staging passes, deploy production: `bash docker/scripts/deploy-prod.sh`

## Rollback

**Staging application rollback:**

```bash
bash docker/scripts/deploy-staging.sh --rollback
# or per service:
bash docker/scripts/deploy-staging-atomic.sh --rollback carina-web-staging
```

**Production application rollback:**

**Schema rollback:** only when the migration has a paired down file and no incompatible data was written. Otherwise ship a forward fix migration.

## Code review checklist

- [ ] New migration file with next sequence number
- [ ] Idempotent SQL
- [ ] No destructive change without data backfill step
- [ ] `.env.example` updated if new env vars required
- [ ] `ENV-INVENTORY.md` updated for new env vars

## Zero-downtime expand/contract

For column renames and other dual-write schema changes, use the toolkit under `src/migrations-zdt/` (shared expand/contract helpers):

1. Plan with **add-before-drop** (never drop the old column first).
2. Generate and store a paired `.rollback.sql` artifact **before** applying forward SQL.
3. Create or refresh a staging mirror; run the plan on staging; mark staging validated.
4. Production apply requires the explicit token `CONFIRM_PROD:<migrationName>` via ops API or deploy tooling.
5. Backfill in batches (default 1000); keep statement lock budget under 100ms.

Ops planning APIs (auth required; dry-run only; they do not execute production DDL):

- `GET /api/ops/migrations-zdt`
- `POST /api/ops/migrations-zdt/plan/add-before-drop`
- `POST /api/ops/migrations-zdt/staging-mirror`
- `POST /api/ops/migrations-zdt/:name/mark-staging-validated`
- `POST /api/ops/migrations-zdt/:name/run-production` (confirmation gate only)

Numbered SQL under `src/infrastructure/migrations/` remains the deploy-time apply path.
