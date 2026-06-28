# UptimeRobot monitor configuration

Create these monitors at [uptimerobot.com](https://uptimerobot.com). Alert contact: `lordsesame@gmail.com`

| Monitor name | Type | URL | Check interval | Alert threshold |
|--------------|------|-----|----------------|-----------------|
| Carina Core API | HTTPS | https://core.carinaai.uk/health | 5 min | 2 failures |
| Carina App | HTTPS | https://app.carinaai.uk/api/health | 5 min | 2 failures |
| Carina Admin | HTTPS | https://admin.carinaai.uk/api/health | 5 min | 2 failures |
| Hire page | HTTPS | https://hireaiva.co.uk/ | 5 min | 2 failures |
| Aiva admin | HTTPS | https://admin.hireaiva.co.uk/api/health | 5 min | 2 failures |
| Hub (optional) | HTTPS | https://hub.carinaai.uk/api/health | 5 min | 2 failures |

## Expected responses

- **Core API:** HTTP 200, JSON body contains `"status":"ok"` (or `"degraded"` with HTTP 503 when DB is down)
- **App / Admin:** HTTP 200 when core is reachable; HTTP 503 when core is down
- **Hire page:** HTTP 200, `text/html`
- **Admin:** HTTP 200 when app is up (nginx IP allowlist off until post-GTM; see `docker/config/gtm-rollout.json`)

## UptimeRobot probe IPs (post-GTM, when IP allowlist is enabled)

If you turn geo blocking back on, add these to `ADMIN-IP-ALLOWLIST.md`:

```
216.144.248.16/32
216.144.248.17/32
216.144.248.18/32
216.144.248.19/32
216.144.248.20/32
```

Full list: https://uptimerobot.com/help/locations/

## Alerting

- Email on 2 consecutive failures
- Email on recovery (not down-only)
- Public status page: configure at UptimeRobot (optional `status.carinaai.uk` CNAME)

## Staging

https://staging.app.carinaai.uk/api/health (no IP allowlist until post-GTM; `docker/config/gtm-rollout.json`)

## Sentry (complements uptime)

When DSNs are provisioned:

| App | Env var |
|-----|---------|
| Core | `SENTRY_DSN_CORE` in `.env.docker.runtime` |
| Cloud app | `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` |
| Admin | `SENTRY_DSN_ADMIN` |

Configure Sentry alerts: first occurrence of new issues; spike (>10 errors/hour). Ignore 404 noise on marketing paths where appropriate.
