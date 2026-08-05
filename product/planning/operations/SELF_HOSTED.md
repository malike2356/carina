# Self-hosting Carina

**Docker is optional.** Single-user self-hosted Carina works with a single npm command; no Docker, Postgres, or Redis required.

## Quickest path

```bash
# Requires Node.js 22+
npm install -g carina-agent
carina onboard        # guided first-run setup
```

Carina runs locally on port 3333. No Docker, Postgres, or Redis required for single-user use. SQLite is used by default.

## When you need Docker

Docker Compose is required for:

- Multi-tenant hosted deployments
- Carina + Scout (full governance stack)
- Production persistence (Postgres + pgvector, Redis, nginx with TLS)

See `02-backends/core.carinaai.uk/docker-compose.standalone.yml` for the standalone compose file.

## Full docs

- [Self-hosting guide](https://docs.carinaai.uk/docs/user/self-hosting)
- [Linux quickstart](https://docs.carinaai.uk/docs/user/quickstart/linux)
- [Getting started](https://docs.carinaai.uk/docs/user/getting-started)
