# Egress Filter

Controls outbound HTTPS from the `http-request` tool when `LABYRINTH_ENABLED=true` on Carina.

## Domain allowlist

Only hostnames in the allowlist pass. Defaults include common API hosts; merge extras:

```bash
SCOUT_ALLOWED_DOMAINS=api.stripe.com,my-crm.example.com
```

Subdomains must be listed explicitly unless covered by a parent rule in code.

## Blocks

| Check | Result |
|---|---|
| Non-HTTPS URL | Rejected |
| Private IP / localhost | Rejected (SSRF) |
| Host not on allowlist | `EgressBlockedError` + Scout event |
| Response matches secret patterns | `DataLeakError` + critical event |

## Reporting

Blocked requests and leak detections POST to `/api/events` with metadata including URL host and matched pattern class.

## Honeypot keys

If a request sends a honeypot API key in `Authorization`, the filter records a **breach** before the request leaves the agent.

## Configuration

| Variable | Description |
|---|---|
| `SCOUT_BASE_URL` or `LABYRINTH_URL` | Scout server for event POST |
| `SCOUT_API_KEY` or `LABYRINTH_API_KEY` | Auth header |
| `SCOUT_INSTANCE_ID` or `LABYRINTH_INSTANCE_ID` | Instance attribution |

## Operational guidance

Start permissive in development (empty extra domains) and tighten per environment. Production property deployments often allowlist Land Registry, PropertyData, and Resend only.
