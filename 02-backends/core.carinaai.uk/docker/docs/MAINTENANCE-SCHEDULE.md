# Maintenance schedule

Last updated: 2026-06-25

## Daily (automated)

| Task | Script / code | Log / heartbeat |
|------|---------------|-----------------|
| Postgres backup | `docker/scripts/backup-postgres.sh` | `/var/log/verlox/backup.log`, `backup-last-success.epoch` |
| Backup retention prune | `docker/scripts/backup-retention.sh` | same log |
| Cron heartbeat | `src/health/cron-heartbeat.ts` (every 5 min) | `/var/log/verlox/cron-heartbeat.epoch` |
| Uptime monitors | External (UptimeRobot) | See `UPTIME-MONITORS.md` |
| Log rotation | `/etc/logrotate.d/verlox` | `docker/scripts/setup-logrotate.sh` |

Production uses **Docker Compose**, not PM2. Container logs: `docker compose logs --tail=200`. Configure Docker `json-file` max-size on the host if logs grow large.

## Weekly (Monday)

| Task | Owner | Command / notes |
|------|-------|-----------------|
| Review app logs | Ops | `docker compose -f docker-compose.prod.yml logs carina-web --tail=100` |
| Review Sentry | Ops | New issues in last 7 days (when DSNs configured) |
| Review UptimeRobot | Ops | Downtime events and recovery emails |
| Verify backup freshness | Ops | `stat /var/log/verlox/backup-last-success.epoch` |
| Restore test | Automated | `backup-restore-test.sh` (Sun 04:00 UTC) |

## Monthly (first Monday)

| Task | Owner | Notes |
|------|-------|-------|
| `pnpm audit` | Dev | core, app, admin; patch high/critical |
| Clear resolved Sentry issues | Ops | After fixes shipped |
| Disk usage | Ops | `df -h`; clean if > 70% |
| Backblaze usage | Ops | Adjust retention if needed |
| Failed automations | Ops | Admin fleet dashboard; `last_run_status = failed` |
| UptimeRobot monitors | Ops | All active and alerting |

## Quarterly

| Task | Owner | Notes |
|------|-------|-------|
| Rotate session secrets | Ops | `SECRET-ROTATION.md`; low-traffic window |
| Admin IP allowlist review | Ops (post-GTM) | `docker/config/gtm-rollout.json`, `ADMIN-IP-ALLOWLIST.md` |
| Open `aiva_escalations` > 30 days | Ops | Resolve or close |
| `pnpm outdated` | Dev | Non-breaking minor updates |
| Stripe webhooks | Ops | Declined or failed deliveries |
| Full restore drill to staging | Ops | `RESTORE-PROCEDURE.md` |
| Secret rotation review | Ops | `SECRET-ROTATION.md` |

## Annual

| Task | Owner | Notes |
|------|-------|-------|
| Rotate all secrets | Ops | `SECRET-ROTATION.md` |
| API keys with expiry | Ops | Anthropic, Stripe, Resend, etc. |
| Security review | Dev | `pnpm audit`, direct dependency CVEs |
| TLS cipher review | Ops | Mozilla SSL Configuration Generator |

## Incident response

1. Check `GET /health` and `docker compose -f docker-compose.prod.yml ps`
2. Review logs: `docker compose logs nginx carina-web --tail=200`
3. Roll back app if deploy-related: `deploy-atomic.sh --rollback`
4. Restore DB only per `RESTORE-PROCEDURE.md`
