# Sprint 7 - Prompt 04: Monitoring and Operational Maintenance

**Status: COMPLETED 2026-06-25**

**What was built:**
- `src/health/production-health.ts` + `production-health.test.ts` (DB, backup, cron_scheduler, wal_archive checks)
- `src/health/cron-heartbeat.ts` (5-minute heartbeat writer)
- `src/observability/sentry.ts` + Express error handler wiring in `packages/web/src/web-server.ts`
- `src/infrastructure/migrations/012-automation-run-status.sql` (`last_run_status`, `last_run_error`)
- `src/workers/aiva-automation-scheduler.ts` Scout `automation_failed` events + run status updates
- `03-frontends/client-apps/app.carinaai.uk/src/app/api/health/route.ts` (existing; PII-safe Sentry `beforeSend`)
- `03-frontends/client-apps/admin.carinaai.uk/src/app/api/health/route.ts` + middleware public path
- `03-frontends/client-apps/admin.carinaai.uk/src/instrumentation.ts` (Sentry)
- `docker/docs/UPTIME-MONITORS.md`, `MAINTENANCE-SCHEDULE.md`, `MIGRATION-PROCEDURE.md`, `SECRET-ROTATION.md`, `ENV-INVENTORY.md`
- `docker/scripts/setup-logrotate.sh`, `upload-sentry-sourcemaps.sh`
- UptimeRobot probe IPs documented in `ADMIN-IP-ALLOWLIST.md` and `admin.carinaai.uk.conf`

**Sprint:** 7 - Infrastructure
**Prompt number:** 04 of 04

---

## Done When

- [x] `GET /health` on core returns JSON with database, backup, cron_scheduler checks
- [x] `GET /api/health` on app.carinaai.uk returns 200/503 based on core reachability
- [x] `GET /api/health` on admin.carinaai.uk; not blocked by session middleware
- [x] UptimeRobot monitors documented; probe IPs in admin allowlist docs
- [x] `@sentry/node` in core with PII stripping in `beforeSend`
- [x] `@sentry/nextjs` in app (existing) and admin with `beforeSend`
- [x] Source map upload script for core build (`upload-sentry-sourcemaps.sh`)
- [x] `/etc/logrotate.d/verlox` installer script (Docker prod; PM2 N/A)
- [x] Cron heartbeat every 5 minutes; health warns if > 10 minutes stale
- [x] `last_run_status` / `last_run_error` on `ai_worker_automations`
- [x] Failed automation reports Scout `automation_failed` warning
- [x] Ops docs: migration, env inventory, secret rotation, maintenance schedule

**Operator follow-up:** Create Sentry projects and UptimeRobot monitors on live services; set DSNs in VPS env files.
