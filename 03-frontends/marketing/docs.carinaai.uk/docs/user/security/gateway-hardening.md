# Gateway hardening

Production gateways should assume the public internet will probe every open port.

## Network exposure

| Rule | Recommendation |
|---|---|
| Bind address | `127.0.0.1` or private interface unless behind TLS proxy |
| Admin routes | Never expose `/api/admin` without auth |
| Web UI | Put nginx or Caddy in front with TLS |

Example nginx terminates TLS and forwards to Carina on localhost only (see `core.carinaai.uk/docker/nginx/` samples in the monorepo).

## Authentication

- Web/API: session cookies, API keys, or mutual TLS depending on deployment
- Channel webhooks: validate provider signatures (Telegram, Stripe, Twilio, etc.)
- Desktop/mobile: device pairing tokens (`infrastructure/device-pairing.ts`)

## TLS and headers

Set strict headers at the reverse proxy:

- `Strict-Transport-Security`
- Content Security Policy for embedded web chat
- Rate limits on `/api/chat` and stream routes

Cloud app sets CSP in Next.js middleware; self-hosters should mirror the pattern in [Web gateway](/docs/user/gateways/web).

## Firewall checklist

1. Allow 443 from the world to nginx only
2. Block direct access to Postgres and Redis from WAN
3. Restrict SSH to bastion IPs
4. Enable Scout kill-switch channel when using Labyrinth

## Production security checklist

Use this before exposing a gateway beyond localhost:

- [ ] Gateway token set (not default)
- [ ] Gateway binds to loopback or reverse proxy
- [ ] TLS configured on reverse proxy
- [ ] `.env` not committed to git
- [ ] Scout enabled for production
- [ ] Sandbox mode set for untrusted agents
- [ ] Firewall restricts Gateway port
- [ ] Regular `carina security audit` scheduled

## Runbook: accidental public exposure

1. Revoke and rotate all API keys and webhook secrets
2. Enable Scout suspend if integrated
3. Review audit logs for anomalous tool calls
4. Re-deploy behind VPN or IP allowlist until fixed

## Related

- [Labyrinth Scout](/docs/user/security/labyrinth-scout)
- [Self-hosting](/docs/user/self-hosting)
- [Doctor and health](/docs/user/carina-ops/doctor-and-health)
