# GET /api/status

Dashboard aggregate: instances, 24h severity counts, and hourly tool call totals.

## Request

```
GET /api/status
X-Scout-Key: <SCOUT_API_KEY>
```

## Response

**200 OK**

```json
{
  "instances": [
    {
      "id": "carina-prod",
      "name": "Carina Production",
      "status": "active",
      "last_heartbeat": "2026-06-04T12:00:00.000Z",
      "secondsAgo": 12,
      "suspension_reason": null
    }
  ],
  "stats": {
    "critical": 1,
    "warning": 4,
    "info": 120,
    "breach": 0
  },
  "toolCalls": {
    "web-search": 10,
    "file-read": 5,
    "http-request": 8,
    "shell-exec": 0,
    "email-send": 2,
    "code-exec": 1
  }
}
```

### Instance status values

| Status | Meaning |
|---|---|
| `active` | Heartbeat within 90s and not suspended |
| `suspended` | Kill switch active |
| `offline` | No recent heartbeat |

`toolCalls` covers the last **hour** for known tool names.

## Per-instance status (SDK)

```
GET /api/instances/:instanceId/status
X-Scout-Key: <SCOUT_API_KEY>
```

```json
{ "suspended": false, "reason": null }
```

Used by `LabyrinthScoutClient.checkStatus()` for kill-switch polling.

## Errors

| Status | Cause |
|---|---|
| 401 | Invalid API key |
| 500 | Database unavailable |
