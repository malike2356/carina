---
sidebar_position: 1
---

# HTTP API

Self-hosted web gateway exposes REST endpoints when `carina web` or `pnpm cli` is running (default port 3000).

## Health

```
GET /api/health
```

## Chat (web UI)

The web UI uses session cookies and streams responses over the same origin. Hosted mode adds tenant auth at `app.carinaai.uk`.

## Webhooks

Inbound channel webhooks mount under `/webhooks/<channel>` when adapters are enabled.

## Carina Cloud

Hosted tenants use separate routes under the operator app host. See [Carina Cloud](/docs/user/carina-cloud) for BYOK and billing. Scout trust and operator APIs live in the separate Scout product docs.

For Scout public trust metrics (read-only, no console login): browse [labyrinthscout.com/trust](https://labyrinthscout.com/trust) or call `GET /api/public/trust` on your provisioned Scout host. The reference VERLOX instance backs the public trust page; your tenant console URL is emailed at provisioning and is not published on marketing sites.
