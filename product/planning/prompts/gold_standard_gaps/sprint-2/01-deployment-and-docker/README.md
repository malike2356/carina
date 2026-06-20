# Sprint 2 - Category 01: Deployment and Docker

## What Exists

- `core.carinaai.uk/docker/Dockerfile.carina` - multi-stage build
- `core.carinaai.uk/docker/nginx/` - nginx configs for all subdomains
- `core.carinaai.uk/docker/postgres/` - Postgres init
- `core.carinaai.uk/docker-compose.yml` - dev stack
- `core.carinaai.uk/docker-compose.prod.yml` - prod stack
- `core.carinaai.uk/docker-compose.verlox.yml` - full VERLOX stack
- `core.carinaai.uk/docker/supervisor/carina-hub.conf` - supervisor for hub only

## What Is Missing

- Supervisor configs for carina-core and carina-gateway processes
- HEALTHCHECK directives in Dockerfile.carina
- Graceful shutdown (SIGTERM handling in start.sh)
- Log rotation config for /data/logs inside container
- One-command production stack with automatic TLS via Certbot

## Prompts in This Category

- `01-supervisor-config.md` - Add supervisor for core and gateway
- `02-healthcheck-and-graceful-shutdown.md` - HEALTHCHECK and SIGTERM
- `03-production-compose-tls.md` - Production stack with auto-TLS

## Original Reference

`sprint-2/gap-01-docker/`
