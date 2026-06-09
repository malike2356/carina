# GET /api/public/trust

Public, read-only trust metrics for the Carina trust dashboard (`carinaai.uk/trust.html`).

No API key required. Returns aggregated security posture only; no session IDs, IP addresses, or raw event descriptions.

## Request

```
GET /api/public/trust
```

## Response

**200 OK** with `Cache-Control: public, max-age=60`

```json
{
  "generated_at": "2026-06-09T12:00:00.000Z",
  "risk_score": 12,
  "risk_tier": "low",
  "risk_tier_label": "Low risk",
  "monitoring": {
    "scout_active": true,
    "agents_protected": 2,
    "agents_active": 1,
    "agents_suspended": 0,
    "last_scan_at": "2026-06-09T11:59:00.000Z",
    "last_scan_relative": "1 minute ago",
    "last_heartbeat_at": "2026-06-09T11:59:00.000Z"
  },
  "metrics": {
    "injection_blocks_24h": 0,
    "runtime_incidents_30d": 0,
    "events_today": 1284,
    "threats_24h": 0,
    "blocked_24h": 0
  },
  "attestations": [],
  "chain": {
    "erc8004_status": "registering",
    "erc8004_label": "Registering on Base Sepolia",
    "erc8126_status": "enterprise",
    "erc8126_label": "Enterprise tier — Q3 2026"
  },
  "source": "labyrinth-scout"
}
```

## Configuration

| Env var | Default | Purpose |
|---|---|---|
| `TRUST_PUBLIC_ENABLED` | `true` | Set `false` to disable the endpoint |
| `TRUST_ERC8004_STATUS` | `registering` | `live`, `registering`, or `planned` |
| `TRUST_ERC8126_STATUS` | `enterprise` | `live`, `enterprise`, or `planned` |

## Risk score tiers

| Score | Tier | Meaning |
|---|---|---|
| 0–20 | Low | Minimal concerns |
| 21–40 | Moderate | Review recommended |
| 41–60 | Elevated | Caution advised |
| 61–80 | High | Significant concerns |
| 81–100 | Critical | Avoid interaction |

The score is computed from Scout DB aggregates: runtime incidents, injection blocks, breaches, warnings, and agent suspension state. See `src/trust/compute-trust-metrics.ts`.

## Attestations (off-chain today)

Each item in `attestations` is a SHA256 hash preview of a security summary derived from recent Scout events. These are **not yet on-chain**. When ERC-8126 integration ships (Phase C), entries will include Base explorer transaction links.

## Public trust dashboard

- Carina marketing page: [carinaai.uk/trust.html](https://carinaai.uk/trust.html)
- Scout operator console links to the public dashboard from the header **PUBLIC TRUST** button

## CORS

Scout allows cross-origin reads from any origin. The Carina marketing site fetches this endpoint from `carinaai.uk`.

## Disable

Set `TRUST_PUBLIC_ENABLED=false` to return `503` for all requests. Use this if you need to hide aggregate metrics during maintenance.
