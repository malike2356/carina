# Dashboard Chart Expansion - 8 Additional Security Visualisations

**File:** `console.labyrinthscout.com/public/dashboard.html`
**Approach:** Add 8 new Canvas/SVG visualisations to the existing dashboard. Each replaces or supplements a dead-space panel. All charts use pure Canvas 2D or SVG - no external libraries.

---

## New Grid Layout

The current 2-column layout needs a third column to accommodate more panels. Restructure the main grid:

```css
.main-grid {
  grid-template-columns: minmax(300px, 26%) 1fr minmax(240px, 22%);
  grid-template-rows: 140px 100px 1fr 140px;
  grid-template-areas:
    "radar   stats    severity"
    "radar   freq     gauge"
    "stream  anomaly  scatter"
    "stream  heatmap  topevents";
}
```

---

## Chart 1: Severity Donut (grid-area: severity)

A real-time ring/donut chart showing proportion of events by severity over the last 24h.

**Canvas 2D implementation:**
```javascript
function drawSeverityDonut(canvas, stats) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const cx = W / 2, cy = H / 2;
  const r = Math.min(W, H) * 0.38;
  const inner = r * 0.58;

  const total = stats.critical + stats.warning + stats.info + stats.breach || 1;
  const slices = [
    { key: 'breach',   value: stats.breach,   colour: '#ff2244' },
    { key: 'critical', value: stats.critical,  colour: '#ff5566' },
    { key: 'warning',  value: stats.warning,   colour: '#d4af37' },
    { key: 'info',     value: stats.info,      colour: '#00d4ff' },
  ];

  let angle = -Math.PI / 2;
  slices.forEach(s => {
    if (!s.value) return;
    const sweep = (s.value / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, angle, angle + sweep);
    ctx.closePath();
    ctx.fillStyle = s.colour;
    ctx.shadowColor = s.colour;
    ctx.shadowBlur = 12;
    ctx.fill();
    ctx.shadowBlur = 0;
    angle += sweep;
  });

  // Cut inner hole
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath();
  ctx.arc(cx, cy, inner, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';

  // Centre text: total count
  ctx.fillStyle = '#cce8f4';
  ctx.font = `bold ${Math.round(r * 0.45)}px JetBrains Mono`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(total, cx, cy);

  ctx.font = `${Math.round(r * 0.18)}px JetBrains Mono`;
  ctx.fillStyle = '#8bafc0';
  ctx.fillText('EVENTS', cx, cy + r * 0.28);
}
```

Update from SSE stats events. Animates each slice update with a brief opacity fade.

---

## Chart 2: Threat Level Gauge (grid-area: gauge)

A semicircular speedometer. Needle points to current threat level 0-100. Computed from: `min(100, critical*4 + warning*2 + breach*20)`.

**SVG implementation:**
The gauge is a semicircle arc divided into 5 zones: safe (green), elevated (cyan), warning (amber), critical (red), breach (deep red blinking). The needle is an SVG line from the centre, rotated to the current value.

```javascript
function updateGauge(svgEl, threatScore) {
  const needle = svgEl.querySelector('#gauge-needle');
  // 0 = -90deg, 100 = +90deg
  const deg = -90 + (threatScore / 100) * 180;
  needle.style.transform = `rotate(${deg}deg)`;
  needle.style.transformOrigin = '100px 100px'; // pivot at centre

  // Colour the score text
  const label = svgEl.querySelector('#gauge-score');
  label.textContent = Math.round(threatScore);
  label.style.fill = threatScore > 75 ? '#ff2244' :
                      threatScore > 50 ? '#d4af37' : '#00c896';
}
```

SVG structure: 5 arc segments in a row (teal to red), needle line, score label below.

---

## Chart 3: Session Scatter Plot (grid-area: scatter)

Each completed session is a dot. X axis: number of events in session. Y axis: maximum anomaly Z-score in session. Dot size: session duration (seconds). Dot colour: highest severity in session.

**API:** `GET /api/instances` and the existing events data. Build session aggregates client-side from the event stream as events arrive.

```javascript
const sessionMap = new Map(); // sessionId -> { events, maxAnomaly, duration, maxSeverity }

function onEvent(ev) {
  const s = sessionMap.get(ev.session_id) || { events: 0, maxAnomaly: 0, startTs: Date.now(), maxSeverity: 'info' };
  s.events++;
  if (SEVERITY_RANK[ev.severity] > SEVERITY_RANK[s.maxSeverity]) s.maxSeverity = ev.severity;
  sessionMap.set(ev.session_id, s);
  drawScatter();
}

function drawScatter(canvas) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  const sessions = [...sessionMap.values()];
  if (!sessions.length) return;

  const maxEvents = Math.max(...sessions.map(s => s.events), 1);
  const maxZ = Math.max(...sessions.map(s => s.maxAnomaly), 3);

  sessions.forEach(s => {
    const x = (s.events / maxEvents) * (W - 20) + 10;
    const y = H - 10 - (s.maxAnomaly / maxZ) * (H - 20);
    const r = Math.max(3, Math.min(10, (Date.now() - s.startTs) / 10000));
    const col = { breach: '#ff2244', critical: '#ff5566', warning: '#d4af37', info: '#00d4ff' }[s.maxSeverity];

    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = col + '99';
    ctx.fill();
    ctx.strokeStyle = col;
    ctx.lineWidth = 1;
    ctx.stroke();
  });
}
```

Axes: faint grid lines. X label: "events". Y label: "Z-score".

---

## Chart 4: Top Event Types Bar Chart (grid-area: topevents)

Horizontal bar chart. Top 8 `event_type` values by count from the last 100 events in the stream. Updates on each new SSE event.

```javascript
const eventTypeCounts = new Map();

function onEvent(ev) {
  eventTypeCounts.set(ev.event_type, (eventTypeCounts.get(ev.event_type) || 0) + 1);
  drawTopEvents();
}

function drawTopEvents(canvas) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  const sorted = [...eventTypeCounts.entries()]
    .sort((a, b) => b[1] - a[1]).slice(0, 8);

  if (!sorted.length) return;

  const maxCount = sorted[0][1];
  const barH = (H - sorted.length * 2) / sorted.length;
  const labelW = 140;

  sorted.forEach(([type, count], i) => {
    const y = i * (barH + 2);
    const barW = ((count / maxCount) * (W - labelW - 10));

    // Label
    ctx.fillStyle = '#8bafc0';
    ctx.font = `${Math.min(10, barH * 0.7)}px JetBrains Mono`;
    ctx.textAlign = 'right';
    ctx.fillText(type.replace(/_/g, ' ').slice(0, 20), labelW - 4, y + barH * 0.7);

    // Bar
    const col = type.includes('injection') || type.includes('blocked') ? '#ff2244' :
                type.includes('tool') ? '#00d4ff' : '#00c896';
    ctx.fillStyle = col + 'aa';
    ctx.fillRect(labelW, y, barW, barH);

    // Count
    ctx.fillStyle = '#cce8f4';
    ctx.textAlign = 'left';
    ctx.fillText(count, labelW + barW + 4, y + barH * 0.7);
  });
}
```

---

## Chart 5: Injection Attempt Trend Line (add to anomaly panel as second layer)

Overlay a second line on the anomaly canvas: injection attempts per minute (rolling). Draw as a thin dashed amber line over the existing Z-score line.

Data: maintain a 10-minute rolling array of per-minute injection counts. Update when `event_type === 'injection_blocked'` or `event_type.includes('injection')`.

```javascript
const injectionMinutes = new Array(10).fill(0);
let currentMinute = Date.now();

function onEvent(ev) {
  if (ev.event_type.includes('injection') || ev.event_type === 'tool_result_injection_blocked') {
    if (Date.now() - currentMinute > 60000) {
      injectionMinutes.push(0);
      injectionMinutes.shift();
      currentMinute = Date.now();
    }
    injectionMinutes[injectionMinutes.length - 1]++;
  }
}

// Inside drawAnomalyChart(), after the main line:
function drawInjectionOverlay(ctx, W, H, data) {
  if (!data.some(v => v > 0)) return;
  const max = Math.max(...data, 1);
  ctx.beginPath();
  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 1.5;
  data.forEach((v, i) => {
    const x = (i / (data.length - 1)) * W;
    const y = H - (v / max) * (H * 0.8);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.stroke();
  ctx.setLineDash([]);

  // Legend
  ctx.fillStyle = '#d4af37';
  ctx.font = '8px JetBrains Mono';
  ctx.fillText('-- injection/min', W - 100, 12);
}
```

---

## Chart 6: Egress Block Sparkline (add to panel label of egress-related stats)

A small 50px-tall inline sparkline showing egress blocks over the last 30 minutes. Display it in the header of the event stream panel as a miniature canvas. Update whenever `event_type === 'egress_blocked'`.

```javascript
const egressBlocks = new Array(30).fill(0); // per-minute for 30 min

function drawEgressSparkline(canvas) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  const max = Math.max(...egressBlocks, 1);
  const barW = W / egressBlocks.length;
  egressBlocks.forEach((v, i) => {
    const h = (v / max) * H;
    ctx.fillStyle = v > 0 ? '#ff2244aa' : '#0a1628';
    ctx.fillRect(i * barW, H - h, barW - 1, h);
  });
}
```

---

## Chart 7: Provider Usage Pie (small, in instances bar area)

Show which LLM providers have been used in this session. From `event_type === 'tool_call'` metadata that includes `provider`.

A small 80x80 pie chart next to the instances bar. Colours: DeepSeek=#9b59ff, Claude=#00c896, OpenAI=#00d4ff.

---

## Chart 8: Honeypot Status Grid (new small panel or within instances)

A 3x3 or 4x4 grid of squares, one per deployed honeypot. Untriggered = dark with faint border. Triggered = bright red with glow and blink.

```javascript
function drawHoneypotGrid(canvas, honeypots) {
  const ctx = canvas.getContext('2d');
  const cols = 4;
  const cellW = canvas.width / cols;
  const cellH = canvas.height / Math.ceil(honeypots.length / cols);

  honeypots.forEach((hp, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = col * cellW + 2, y = row * cellH + 2;
    const w = cellW - 4, h = cellH - 4;

    if (hp.triggered) {
      ctx.fillStyle = '#ff224488';
      ctx.shadowColor = '#ff2244';
      ctx.shadowBlur = 15;
    } else {
      ctx.fillStyle = '#0a1628';
      ctx.shadowBlur = 0;
    }
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = hp.triggered ? '#ff2244' : '#0d3a4f';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, h);
    ctx.shadowBlur = 0;
  });
}
```

Poll `GET /api/honeypots` every 30s.

---

## Panel label size increase

All `.panel-label` text: increase from `0.6rem` to `0.72rem`, letter-spacing from `0.1em` to `0.14em`. Makes the panel titles readable without leaning in.

---

## Summary of all charts in the dashboard after this update

| Panel | Chart type | Data source |
|---|---|---|
| radar | SVG animated sweep + dots | SSE events |
| stats | 4 stat cards with sparkline | SSE stats |
| severity | Donut/ring chart | SSE stats |
| freq | Bar/EKG chart | SSE events |
| gauge | Semicircle speedometer | Computed from stats |
| stream | Scrolling log | SSE events |
| anomaly | Line chart + injection overlay | /api/anomalies + SSE |
| scatter | Session scatter plot | SSE events aggregated |
| heatmap | 2D heatmap grid | /api/status toolCalls |
| topevents | Horizontal bar chart | SSE events aggregated |
