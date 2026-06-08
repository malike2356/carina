# Docker Deployment

## Official image

```bash
docker run -d \
  --name labyrinth-scout \
  -p 4444:4444 \
  -e SCOUT_API_KEY="$(openssl rand -hex 32)" \
  -e SCOUT_DATABASE_URL=postgresql://carina:secret@postgres:5432/carina_central \
  -e REDIS_URL=redis://redis:6379 \
  --network carina \
  verlox/scout:latest
```

Image tag: `verlox/scout:latest` (built from `console.labyrinthscout.com`).

## Compose with Carina

VERLOX personal overlay (`core.carinaai.uk/docker-compose.verlox.yml`) defines `labyrinth-scout` beside Postgres and Redis:

```bash
cd core.carinaai.uk
docker compose -f docker-compose.yml -f docker-compose.verlox.yml up -d labyrinth-scout
```

Set matching keys:

```yaml
# Carina
LABYRINTH_API_KEY: ${SCOUT_API_KEY}

# Scout
SCOUT_API_KEY: ${SCOUT_API_KEY}
```

## Volumes and migrations

Scout runs SQL migrations on startup (`src/migrations.ts`). Persist Postgres data with a named volume on the database service.

## Production checklist

- TLS terminate at nginx; do not expose dashboard HTML on the public internet without auth.
- Use strong `SCOUT_API_KEY` (32+ byte hex).
- Configure alert channels (`SCOUT_TELEGRAM_*`, `SCOUT_SLACK_WEBHOOK_URL`).
- Set `SCOUT_DASHBOARD_URL` to your public URL for email links.
- Enable proxy only if needed (`SCOUT_PROXY_ENABLED`); bind proxy port internally.

## Build locally

```bash
cd console.labyrinthscout.com
pnpm install
pnpm build
docker build -t verlox/scout:local .
```

Use the inline Dockerfile in `docker-compose.verlox.yml` as a reference for multi-stage production builds.
