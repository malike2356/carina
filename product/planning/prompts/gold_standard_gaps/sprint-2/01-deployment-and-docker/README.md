# Sprint 2 - Category 01: Deployment and Docker

## Status: FULLY BUILT (2026-06-20)

All prompts in this category are implemented in `internal/servers/core.carinaai.uk/docker/`.

## What Exists

- `docker/Dockerfile.carina` - multi-stage build, HEALTHCHECK, supervisord CMD
- `docker/supervisor/container/` - carina-core, carina-gateway, carina-hub, carina-ops, logrotate
- `docker/supervisor/vps/` - bare-metal supervisor templates for Contabo VPS
- `docker/supervisor/supervisord.conf` - root supervisord config
- `docker/healthcheck.sh` - probes `/health` and `/api/health`
- `docker/logrotate/carina` - daily rotation for `/app/data/logs/*.log`
- `docker/nginx/conf.d/certbot.conf` - ACME webroot snippet
- `docker/nginx/conf.d/ssl-params.conf` - TLS hardening snippet
- `docker/nginx/carina-prod-bootstrap.conf` - HTTP-only first boot for cert issue
- `docker/scripts/init-certs.sh` - Let's Encrypt SAN certificate bootstrap
- `docker/scripts/deploy-prod.sh` - one-command production deploy
- `docker-compose.prod.yml` - prod stack with certbot, nginx, health checks, logrotate mount
- `src/index.ts` - SIGTERM/SIGINT graceful shutdown with 25s force exit
- `docker/DEPLOY.md` - deploy runbook

## Prompts in This Category

- `01-supervisor-config.md` - DONE
- `02-healthcheck-and-graceful-shutdown.md` - DONE
- `03-production-compose-tls.md` - DONE

## Original Reference

`sprint-2/gap-01-docker/`
