# Dashboard

The dashboard is served at `/` and `/dashboard.html`. On load, Scout injects your `SCOUT_API_KEY` into the page for authenticated API calls (self-hosted only; do not expose this URL publicly without TLS and access control).

## Radar scanner

Top-left **threat radar** plots recent security events as polar dots.

| Visual | Meaning |
|---|---|
| Distance from centre | Recency (newer = closer to edge) |
| Dot size | Severity weight |
| Colour | `info` slate, `warning` amber, `critical` red, `breach` bright red |

Hover or select dots to read event type and description in the detail panel.

## Event frequency graph

60-second rolling window bar chart. Bar height is the count of events in that minute weighted by severity (`breach` > `critical` > `warning` > `info`). Spikes often correlate with tool bursts or injection attempts.

## Anomaly score chart

Timeline of Z-scores from `session_metrics` events. Baseline mean and standard deviation are per instance and per metric. Default anomaly threshold: **3.0** (critical at **5.0**). Points above the line trigger `anomaly_detected` events and optional alerts.

## Tool heatmap

Grid of tool name vs hour-of-day (UTC). Cell intensity reflects `tool_call` event counts in the last 24 hours. Useful to spot unusual `shell-exec` or `http-request` patterns.

## Live event stream

Scrollable list with severity badges. New events arrive via SSE (`/api/stream`). Filter by severity or instance using the dashboard controls.

## Kill switch

Per-instance **Suspend** button on the instance bar.

1. Click Suspend.
2. Enter a reason (required, max 500 chars).
3. Scout sets DB status to `suspended`, publishes Redis `labyrinth:control`, and logs `kill_activated`.

Carina stops processing new messages until **Resume** is clicked (calls `POST /api/resume/:id`).

## Instance bar

Shows each registered instance:

| Status | Condition |
|---|---|
| **active** | Heartbeat within 90 seconds and not suspended |
| **suspended** | Kill switch engaged |
| **offline** | No heartbeat for 90+ seconds |

Displays seconds since last heartbeat and suspension reason when applicable.

## Stats header

24-hour counts for `critical`, `warning`, `info`, and `breach` from `GET /api/status`.
