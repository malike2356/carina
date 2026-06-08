# Kill Switch API

Suspend or resume an agent instance. Control messages publish to Redis channel `labyrinth:control`.

## Suspend

```
POST /api/kill/:instanceId
Content-Type: application/json
X-Scout-Key: <SCOUT_API_KEY>
```

### Body

| Field | Type | Required |
|---|---|---|
| `reason` | string | Yes, non-empty, max 500 chars |

### Example

```json
{ "reason": "Suspected data exfiltration on sess-9f2a" }
```

### Response

**200 OK**

```json
{
  "ok": true,
  "instance_id": "carina-prod",
  "status": "suspended"
}
```

### Errors

| Status | Cause |
|---|---|
| 400 | Missing reason or already suspended |
| 404 | Unknown instance |
| 401 | Invalid API key |

## Resume

```
POST /api/resume/:instanceId
X-Scout-Key: <SCOUT_API_KEY>
```

No body required.

### Response

**200 OK**

```json
{
  "ok": true,
  "instance_id": "carina-prod",
  "status": "active"
}
```

### Errors

| Status | Cause |
|---|---|
| 400 | Instance not suspended |
| 404 | Unknown instance |

## Redis payload

Published JSON (Carina filters by `instance_id`):

```json
{
  "instance_id": "carina-prod",
  "action": "suspend",
  "reason": "..."
}
```

Resume uses `"action": "resume"`.

## Carina behaviour

On suspend, Carina sets an in-process flag and rejects new messages. Log file: `data/logs/labyrinth-suspend.log` on the agent host.

SDK alternative: `startKillSwitchPolling(onSuspend)` polls `GET /api/instances/:id/status` every 30s.
