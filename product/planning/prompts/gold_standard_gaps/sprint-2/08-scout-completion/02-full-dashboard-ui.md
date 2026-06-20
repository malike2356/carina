# Prompt 02: Full Scout Dashboard UI

## Context

`console.labyrinthscout.com/public/dashboard.html` exists but is incomplete. The fleet
widget exists. This prompt builds the full dashboard: real-time event feed, score chart,
severity breakdown, asset map, and active alerts panel.

## What to Build

### 1. Dashboard layout

```
+------------------------------------------+
| Scout Dashboard          [Logout] [Docs]  |
+------------------+-------+---------------+
| Scout Score      | Score | Active Alerts  |
|                  |  87   |                |
| Trend: UP +2     |       | [CRIT] CVE on  |
| 7 days avg: 85   | chart | nginx (2h ago) |
+------------------+-------+---------------+
| Severity Breakdown                        |
| Critical: 0  High: 2  Medium: 5  Low: 12 |
+------------------------------------------+
| Recent Events (live)                     |
|-------------------------------------------
| 08:14  HIGH  nmap scan on prod db        |
| 08:02  LOW   Login from new IP           |
| 07:55  CRIT  Prompt injection blocked    |
+------------------------------------------+
| Asset Map                                |
| nginx (prod) - 1 HIGH   postgres - clean |
+------------------------------------------+
```

### 2. Score gauge widget

A circular gauge showing 0-100 with color zones:
- 0-39: red (critical risk)
- 40-59: amber (high risk)
- 60-79: yellow (moderate risk)
- 80-100: green (protected)

Implemented in vanilla JS using Canvas API (no external charting library to avoid CDN
dependencies on the dashboard):
```javascript
function drawScoreGauge(canvas, score) {
  const ctx = canvas.getContext('2d');
  const cx = canvas.width / 2, cy = canvas.height / 2;
  const r = 80;
  const startAngle = Math.PI * 0.75;
  const endAngle = Math.PI * 2.25;
  const scoreAngle = startAngle + (score / 100) * (endAngle - startAngle);

  // Background arc
  ctx.beginPath();
  ctx.arc(cx, cy, r, startAngle, endAngle);
  ctx.strokeStyle = '#1a2332';
  ctx.lineWidth = 16;
  ctx.stroke();

  // Score arc
  const color = score >= 80 ? '#16c97e' : score >= 60 ? '#f59e0b' : '#e63946';
  ctx.beginPath();
  ctx.arc(cx, cy, r, startAngle, scoreAngle);
  ctx.strokeStyle = color;
  ctx.lineWidth = 16;
  ctx.lineCap = 'round';
  ctx.stroke();

  // Score number
  ctx.fillStyle = '#f0f4f8';
  ctx.font = 'bold 36px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(score, cx, cy + 12);
}
```

### 3. Score trend chart

A 30-day line chart using Canvas:
```javascript
function drawTrendChart(canvas, dataPoints) {
  const ctx = canvas.getContext('2d');
  // Plot score history as a simple line chart
  // x-axis: days, y-axis: 0-100
  // Use the CSS variable --green for the line color
}
```

### 4. Live event feed

Using SSE (already planned in category 06 for ops panel - same pattern):
```javascript
const source = new EventSource('/api/events/stream');
source.onmessage = (e) => {
  const event = JSON.parse(e.data);
  const row = buildEventRow(event);
  document.getElementById('event-feed').prepend(row);
  // Keep max 50 rows
  while (document.querySelectorAll('.event-row').length > 50) {
    document.querySelector('.event-row:last-child').remove();
  }
};
```

### 5. Asset map panel

A table showing registered assets and their current event summary:
```html
<table id="asset-map">
  <thead>
    <tr>
      <th>Asset</th><th>Type</th><th>Critical</th><th>High</th><th>Status</th>
    </tr>
  </thead>
  <tbody>
    <!-- Populated from GET /api/assets/summary -->
  </tbody>
</table>
```

Color-code rows: clean (green text), has high (amber), has critical (red).

## Verification Checklist

- [ ] Dashboard loads and shows current score in gauge widget
- [ ] Score gauge changes color at 80 (green), 60 (amber), 40 (red) boundaries
- [ ] 30-day trend chart shows historical scores
- [ ] Live event feed updates within 2 seconds of new event being emitted
- [ ] Asset map shows all registered assets with severity counts

## Files to Create or Modify

- MODIFY `console.labyrinthscout.com/public/dashboard.html` - complete full layout
- CREATE `console.labyrinthscout.com/public/dashboard/js/widgets/score-gauge.js`
- CREATE `console.labyrinthscout.com/public/dashboard/js/widgets/trend-chart.js`
- CREATE `console.labyrinthscout.com/public/dashboard/js/widgets/event-feed.js`
- CREATE `console.labyrinthscout.com/public/dashboard/js/widgets/asset-map.js`
- MODIFY `console.labyrinthscout.com/src/server.ts` - add SSE event stream endpoint
