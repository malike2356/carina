# POST /api/events

Ingest a security or telemetry event.

## Request

```
POST /api/events
Content-Type: application/json
X-Scout-Key: <SCOUT_API_KEY>
```

### Body

| Field | Type | Required | Description |
|---|---|---|---|
| `severity` | string | Yes | `info`, `warning`, `critical`, or `breach` |
| `source` | string | Yes | Reporter id, max 100 chars (e.g. `carina`, `openai-proxy`) |
| `event_type` | string | Yes | Snake case `[a-z0-9_]+`, max 100 chars |
| `description` | string | Yes | Human-readable summary, max 1000 chars |
| `instance_id` | string | No | `[a-z0-9_-]+`, max 64 chars |
| `session_id` | string | No | Session correlation id |
| `metadata` | object | No | Arbitrary JSON object |
| `ip_address` | string | No | Usually set from server `req.ip` |

### Example

```json
{
  "severity": "warning",
  "source": "carina",
  "event_type": "tool_call",
  "description": "Tool executed: http-request",
  "instance_id": "carina-prod",
  "session_id": "sess-9f2a",
  "metadata": {
    "toolName": "http-request",
    "durationMs": 842,
    "params": { "method": "GET", "url": "https://api.example.com/status" }
  }
}
```

### Session metrics (anomaly detection)

```json
{
  "severity": "info",
  "source": "carina",
  "event_type": "session_metrics",
  "description": "{\"tool_calls_per_5min\":12,\"shell_exec_count\":0}",
  "instance_id": "carina-prod",
  "session_id": "sess-9f2a"
}
```

`description` must be JSON stringified metrics; see [Anomaly Detection](/security/anomaly-detection).

## Response

**201 Created**

```json
{ "ok": true, "id": "550e8400-e29b-41d4-a716-446655440000" }
```

## Errors

| Status | Body |
|---|---|
| 400 | `{ "error": "severity must be info, warning, critical, or breach" }` |
| 401 | Missing or invalid `X-Scout-Key` |
| 500 | Database error |

## Side effects

- Row inserted into `security_events`
- Event published to Redis `scout:events` for SSE clients
- Alerts dispatched for non-metrics events (except `session_metrics`)
- Anomaly detector runs when `event_type` is `session_metrics`
