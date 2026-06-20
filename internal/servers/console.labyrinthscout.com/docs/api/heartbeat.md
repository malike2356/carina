# POST /api/heartbeat

Register or refresh an agent instance.

## Request

```
POST /api/heartbeat
Content-Type: application/json
X-Scout-Key: <SCOUT_API_KEY>
```

### Body

| Field | Type | Required | Description |
|---|---|---|---|
| `instance_id` | string | Yes | `[a-z0-9_-]+` |
| `name` | string | Yes | Display name, max 80 chars |

### Example

```json
{
  "instance_id": "carina-prod",
  "name": "Carina Production"
}
```

Carina also sends `agent_type` in SDK payloads; the server stores the row keyed by `instance_id`.

## Response

**200 OK**

```json
{ "ok": true }
```

Upserts `carina_instances` with `last_heartbeat = NOW()` and status `active` unless already `suspended`.

## Errors

| Status | Cause |
|---|---|
| 400 | Invalid `instance_id` or `name` |
| 401 | Invalid API key |
| 500 | Database error |

## Recommended interval

Every **60 seconds** per instance. Dashboard marks instances **offline** after 90 seconds without heartbeat.
