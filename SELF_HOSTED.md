# Self-hosting Carina

**Docker is optional.** Single-user self-hosted Carina works with a single command; no Docker, Postgres, or Redis required.

## Quickest path (bare metal)

```bash
git clone https://github.com/carina-ai/carina.git
cd carina/core.carinaai.uk
pnpm install
cp .env.example .env   # add your provider keys
pnpm dev               # agent is live on localhost:3000
```

Uses SQLite by default. Add `DATABASE_URL` and `REDIS_URL` to `.env` for production persistence.

## When you need Docker

Docker Compose is only required for:

- **Cloud Carina**; multi-tenant hosted platform
- **Carina + Scout**; the full security monitoring stack
- **Multi-service orchestration**; Postgres+pgvector, Redis, nginx TLS, Skills Hub

For a single user running Carina on their own machine, bare metal is the recommended path.

## Full docs

- [Self-hosting guide](https://docs.carinaai.uk/docs/user/self-hosting)
- [Linux quickstart](https://docs.carinaai.uk/docs/user/quickstart/linux)
- [Getting started](https://docs.carinaai.uk/docs/user/getting-started)
