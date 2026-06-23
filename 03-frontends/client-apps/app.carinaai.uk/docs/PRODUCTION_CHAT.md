# Production chat on app.carinaai.uk

## Required environment

| Variable | Production recommendation |
|----------|---------------------------|
| `DATABASE_URL` | Postgres for carina_cloud |
| `VAULT_SECRET` | 32+ char secret for BYOK encryption |
| `BETTER_AUTH_URL` | `https://app.carinaai.uk` |
| `NEXT_PUBLIC_APP_URL` | `https://app.carinaai.uk` |
| `CARINA_USE_CORE_PROXY` | `false` unless ops auth is configured |
| `CARINA_OPS_TOKEN` | Only if proxy enabled; must match core |
| `CARINA_CORE_URL` | `https://core.carinaai.uk` if proxy enabled |

## How chat works

1. User signs in at `/login`.
2. User adds a provider key at `/settings/keys` (BYOK).
3. User opens a chat session and sends a message.
4. Cloud app streams directly to the provider API using the workspace key.

Proxy mode (`CARINA_USE_CORE_PROXY=true`) forwards to core `GET /api/chat/stream` with `Authorization: Bearer <CARINA_OPS_TOKEN>`. Proxy is skipped automatically when no ops token is set.

## Verify

```bash
# Health (authenticated session cookie required in browser)
GET /api/chat/health

# Expected when ready:
# { "ok": true, "hasKeys": true, "proxyEnabled": false }
```

Manual test:

1. Register or sign in on production.
2. Settings > Keys: add DeepSeek or OpenAI key.
3. New chat: send `hello`.
4. Assistant reply streams in the bubble.

## Common failures

| Symptom | Cause | Fix |
|---------|-------|-----|
| Link to Settings > Keys | No BYOK keys | Add a key |
| Could not reach agent backend | Proxy on without token or core 401 | Set `CARINA_USE_CORE_PROXY=false` or set matching `CARINA_OPS_TOKEN` |
| Connection error (core HTML UI) | Wrong app (core UI not cloud) | Use `https://app.carinaai.uk` |
| Invalid email or password | Wrong credentials for this host | Register on production or reset password |

## Deploy

```bash
cd /opt/lampp/htdocs/verlox/carina/app.carinaai.uk
bash deploy.sh
```

After deploy, set production `.env`:

```
CARINA_USE_CORE_PROXY=false
```

Restart supervisor service `carina-cloud`.

## Research jobs

Research uses `core.carinaai.uk` deep research, not local stubs.

| Variable | Purpose |
|----------|---------|
| `CARINA_INTERNAL_KEY` | Auth between cloud and core (`x-internal-key` + Bearer) |
| `CARINA_CORE_URL` | Core base URL, e.g. `https://core.carinaai.uk` |
| `NEXT_PUBLIC_APP_URL` | Webhook target for completed jobs |

Flow:

1. Cloud `POST /api/research` creates a job and calls core `POST /api/internal/research/run`.
2. Core runs `runDeepResearch` async.
3. Core webhooks `POST /api/research/{id}/webhook` with markdown output and sources.

Cloud calls core `POST /api/research/cloud/run` (mounted on the main research API router).

If `CARINA_INTERNAL_KEY` is unset in production, jobs fail with a clear error (no example.com stub).

Development without a key uses a short DEV STUB banner only when `NODE_ENV` is not `production`.

Set the same `CARINA_INTERNAL_KEY` on both app and core. Redeploy core after pulling the internal research API.

