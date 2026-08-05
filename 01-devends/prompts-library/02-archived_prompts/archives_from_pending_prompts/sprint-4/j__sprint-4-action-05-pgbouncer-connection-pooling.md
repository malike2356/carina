# Sprint 4 - Prompt j/01: PgBouncer Connection Pooling

**Status: COMPLETED 2026-06-25**

**What was built:**
- Docker `pgbouncer` / `pgbouncer-staging` services (transaction mode, port 6432)
- `docker/pgbouncer/pgbouncer.ini`, `pgbouncer.staging.ini`, `userlist.txt`
- `docker-compose.prod.yml` and `docker-compose.staging.yml` route app URLs through pooler
- `sync-docker-env.py`, `sync-cloud-env.py`, `sync-ops-env.py` default `PGBOUNCER_ENABLED=1`
- `sync-staging-env.py` + `deploy-staging.sh` integration
- `docker/docs/PGBOUNCER.md` (Docker setup, monitoring, reload, incompatibility audit)
- `docker/scripts/pgbouncer-admin.sh`
- Updated `.env.example`, `.env.production.example`, staging examples, `ENV-INVENTORY.md`

**Sprint:** 4 - Foundation
**Prompt number:** j/01

---

## Done When

- [x] PgBouncer in Docker Compose (production + staging)
- [x] Transaction mode, pool_size 20 (prod) / 10 (staging), port 6432
- [x] All app `DATABASE_URL` values use pooler hostname and port 6432 (not `postgres:5432`)
- [x] `sync-docker-env.py` defaults `PGBOUNCER_ENABLED=1`
- [x] Staging uses `pgbouncer-staging:6432` (compose + `sync-staging-env.py`)
- [x] Codebase audited for LISTEN/NOTIFY, advisory locks, SET session, named prepared statements (none found)
- [x] Incompatibilities documented in `PGBOUNCER.md`
- [x] Admin monitoring via `pgbouncer-admin.sh` (`SHOW POOLS`, `RELOAD`)
- [x] `/health` DB check validates end-to-end path through PgBouncer when apps use port 6432

**Note:** Production uses Docker PgBouncer, not host `apt-get install`. Host-level instructions are documented as legacy in `PGBOUNCER.md`.
