# Anomaly Detection

Statistical baselines on per-session metrics to catch abuse without static rules.

## Metrics tracked

| Metric | Description |
|---|---|
| `tool_calls_per_5min` | Tool invocations in rolling window |
| `unique_tools_used` | Distinct tool names in session |
| `avg_response_length` | Mean assistant message length |
| `shell_exec_count` | Shell tool usage |
| `http_request_count` | HTTP tool usage |
| `injection_attempt_count` | Prompt guard hits |
| `egress_blocked_count` | Egress filter blocks |

Agents send JSON metric blobs on `event_type: session_metrics` via `POST /api/events`.

## Algorithm

1. Load baseline mean and std dev per `(instance_id, metric)` from Postgres (minimum 10 samples).
2. Compute Z-score: `(current - mean) / stdDev`.
3. Flag anomaly when Z >= **3.0**; critical alert when Z >= **5.0**.

Baselines cache for one hour in memory.

## Dashboard

Anomaly table and timeline chart show recent detections with metric name, Z-score, and session id.

## Scheduler

Scout scheduler prunes old events and refreshes aggregates. Ensure Redis and Postgres are healthy for timely detection.

## Tuning

Investigate false positives by raising thresholds in code (`Z_ANOMALY_THRESHOLD`) or narrowing which tools run unattended. Pair with [Tool Policy](/security/tool-policy) for hard caps.
