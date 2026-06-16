# Webhooks

Carina delivers signed outbound webhooks for operational events and supports subscription management with delivery logging and retries.

## Events

- `process.complete`, `process.failure`, `process.watch`
- `cron.complete`
- `kanban.move`
- `agent.turn.complete`

## Outbound signing

Each subscription receives a secret at creation. Carina sets:

- `X-Carina-Event`: event name
- `X-Carina-Signature`: HMAC-SHA256 hex digest of the raw JSON body

Verify with the subscription secret before trusting payloads.

## Management API (operator auth)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/webhooks` | List subscriptions |
| POST | `/api/webhooks` | Subscribe |
| PATCH | `/api/webhooks/:id` | Update URL, events, name |
| POST | `/api/webhooks/:id/disable` | Disable |
| POST | `/api/webhooks/:id/enable` | Re-enable |
| GET | `/api/webhooks/:id/deliveries` | Delivery log for subscription |
| GET | `/api/webhooks/deliveries` | Recent deliveries (filter by status) |
| POST | `/api/webhooks/deliveries/:id/retry` | Manual retry |
| POST | `/api/webhooks/trigger` | Fire event (operator or inbound signature) |

## Inbound triggers

Set `CARINA_WEBHOOK_INBOUND_SECRET` and POST to `/api/webhooks/trigger`:

```json
{ "event": "agent.turn.complete", "data": { "source": "ci" } }
```

Header: `X-Carina-Inbound-Signature` (HMAC-SHA256 hex of body).

## Reliability

- Each delivery is logged in `webhook_deliveries` with status, HTTP code, attempts, and errors
- Failed deliveries retry with exponential backoff (up to `max_attempts` per subscription)
- Background sweep runs every 60 seconds when Postgres is available

## Agent tool

`webhook` tool actions: `subscribe`, `list`, `update`, `disable`, `enable`, `unsubscribe`, `deliveries`, `retry`, `test`, `trigger`.
