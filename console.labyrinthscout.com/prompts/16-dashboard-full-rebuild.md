# Labyrinth Scout Dashboard - Full Rebuild

**File:** `console.labyrinthscout.com/public/dashboard.html`
**Action:** Replace the entire file. Keep `<!-- __SCOUT_KEY_INJECTION__ -->` in `<head>`.

This is a complete dashboard rebuild fixing every layout problem and adding 8 new charts. Read the current file first, understand what API calls it makes, what SSE events it handles, what JS functions exist - then rebuild the whole thing from scratch with the spec below.

---

## Problems to fix (from screenshot review)

1. **Radar too small** - tiny wedge in top-left corner, not filling its panel
2. **Anomaly Z-score panel too tall** - dominates the right column, steals space from heatmap
3. **Live event stream no scroll** - when events fill the box, old ones are hidden. The stream div needs `overflow-y: auto` working correctly with a fixed height
4. **Tool heatmap gets almost no height** - squashed to ~50px
5. **Stat card numbers not centred** - numbers left-aligned inside oversized cards
6. **Event frequency panel is blank** - canvas width is 0 on first paint (timing bug)
7. **Dead space everywhere** - panels have too much padding relative to content

---

## Colour palette (keep exactly)

```css
:root {
  --void:        #020409;
  --navy:        #050c1a;
  --navy-lift:   #0a1628;
  --border:      rgba(0,200,150,0.12);
  --glow-green:  #00c896;
  --glow-red:    #ff2244;
  --glow-amber:  #d4af37;
  --glow-cyan:   #00d4ff;
  --glow-purple: #9b59ff;
  --text:        #8bafc0;
  --text-bright: #cce8f4;
}
```

---

## Grid Layout (3-column, full viewport, no max-width cap)

```css
body {
  margin: 0;
  background: var(--void);
  color: var(--text-bright);
  font-family: 'Inter', system-ui, sans-serif;
  height: 100vh;
  overflow: hidden;
}

.app {
  width: 100%;
  height: 100vh;
  display: flex;
  flex-direction: column;
  padding: 0.5rem 1rem 0.5rem;
}

.main-grid {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(280px, 30%) 1fr minmax(220px, 24%);
  grid-template-rows: 130px 80px 1fr 130px;
  grid-template-areas:
    "radar   stats      severity"
    "radar   freq       gauge"
    "stream  anomaly    scatter"
    "stream  heatmap    topevents";
  gap: 0.4rem;
}
```

The radar spans rows 1 and 2 (stats+freq height) and rows 3 and 4 (stream spans all 4). Use `grid-row: span 2` on radar-panel and `grid-row: span 4` on stream-panel.

---

## Header (fixed height, ~48px)

```
[LABYRINTH SCOUT] [● LIVE / ○ OFFLINE]   [instance-id]   [UTC clock]
```

Single flex row. Logo left. Connection status centre-left. Instance info centre. Clock right.
Keep existing header JS (connection dot, clock, instance display).

---

## Panel base style

```css
.panel {
  background: var(--navy);
  border: 1px solid var(--border);
  border-radius: 4px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 0;
}

.panel-label {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.65rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--glow-green);
  padding: 0.3rem 0.6rem;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
```

---

## Panel: Radar (grid-area radar, spans rows 1-4 of col 1)

The radar SVG must fill its panel completely. Use `width: 100%; height: 100%; flex: 1;` on the SVG. `viewBox="0 0 400 400"` preserves aspect ratio.

The radar panel takes the full left column height. No max-width on the SVG.

```css
.radar-panel {
  grid-area: radar;
  grid-row: 1 / 5;
  display: flex;
  flex-direction: column;
}

#radar-svg {
  flex: 1;
  width: 100%;
  height: 100%;
  min-height: 0;
}
```

Keep all existing radar JS: sweep arc, threat dots, flash-red on breach, glow filter. The SVG already has the correct structure - just fix the CSS so it fills the panel.

---

## Panel: Stats cards (grid-area stats, row 1 col 2)

Four cards side by side. Numbers centred both horizontally and vertically.

```css
.stats-panel {
  grid-area: stats;
  background: transparent;
  border: none;
}

.stat-cards {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.4rem;
  height: 100%;
}

.stat-card {
  background: var(--navy);
  border: 1px solid var(--border);
  border-radius: 4px;
  display: flex;
  flex-direction: column;
  align-items: center;        /* horizontal centre */
  justify-content: center;   /* vertical centre */
  padding: 0.4rem;
  position: relative;
  overflow: hidden;
}

/* severity left-edge accent */
.stat-card::before {
  content: '';
  position: absolute;
  left: 0; top: 0; bottom: 0;
  width: 3px;
}
.stat-card.critical::before { background: var(--glow-red); }
.stat-card.warning::before  { background: var(--glow-amber); }
.stat-card.info::before     { background: var(--glow-cyan); }
.stat-card.breach::before   { background: var(--glow-red); animation: breachPulse 1s infinite; }

.stat-num {
  font-family: 'JetBrains Mono', monospace;
  font-size: clamp(2.5rem, 4.5vw, 5rem);
  font-weight: 700;
  line-height: 1;
  text-align: center;
  text-shadow: 0 0 20px currentColor;
}

.stat-label {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.6rem;
  letter-spacing: 0.15em;
  color: var(--text);
  text-align: center;
  margin-top: 0.3rem;
}

.stat-card.critical .stat-num { color: var(--glow-red); }
.stat-card.warning  .stat-num { color: var(--glow-amber); }
.stat-card.info     .stat-num { color: var(--glow-cyan); }
.stat-card.breach   .stat-num { color: var(--glow-red); }
```

---

## Panel: Event Frequency EKG (grid-area freq, row 2 col 2)

60-second rolling bar chart. Canvas fills the panel.

Fix the blank canvas bug: call `initCanvases()` inside `requestAnimationFrame(() => requestAnimationFrame(() => initCanvases()))` at startup, not directly. This ensures the DOM has painted and `getBoundingClientRect()` returns non-zero widths.

```css
.freq-panel {
  grid-area: freq;
}

.freq-panel canvas {
  display: block;
  width: 100%;
  flex: 1;
}
```

The `resizeCanvas()` function must set `canvas.width = canvas.parentElement.clientWidth * dpr`. Keep the existing draw logic.

---

## Panel: Live Event Stream (grid-area stream, spans rows 1-4 of col 1... wait, radar is col 1)

Stream is col 1 rows 3-4 in the current layout. With the new layout (radar = full col 1), stream must move.

**Revised layout** - stream goes in col 2 rows 3-4, anomaly in col 3 row 3, etc:

```
grid-template-areas:
  "radar   stats      severity"
  "radar   freq       gauge"
  "radar   stream     anomaly"
  "radar   heatmap    scatter"
```

Wait - that gives too much space to the radar. Better: keep radar in col 1 rows 1-2, stream in col 1 rows 3-4:

```css
.main-grid {
  grid-template-columns: minmax(280px, 26%) 1fr minmax(220px, 22%);
  grid-template-rows: 120px 70px 1fr 120px;
  grid-template-areas:
    "radar   stats      severity"
    "radar   freq       gauge"
    "stream  anomaly    scatter"
    "stream  heatmap    topevents";
}

.radar-panel  { grid-area: radar;  grid-row: 1 / 3; }
.stream-panel { grid-area: stream; grid-row: 3 / 5; }
```

Stream panel - **must scroll when full**:

```css
.stream-panel {
  grid-area: stream;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

.stream {
  flex: 1;
  overflow-y: scroll;   /* always show scrollbar - never hidden */
  min-height: 0;        /* critical: without this flex child ignores overflow */
  scrollbar-color: var(--glow-green) var(--navy);
  scrollbar-width: thin;
}
```

`min-height: 0` on `.stream` is the key fix. Without it, a flex child that contains overflowing content will expand rather than scroll.

Auto-scroll to bottom on new event ONLY if the user is already at the bottom (within 50px):

```javascript
function appendEvent(ev) {
  const atBottom = stream.scrollHeight - stream.scrollTop - stream.clientHeight < 50;
  stream.prepend(renderEventRow(ev));
  while (stream.children.length > 100) stream.lastElementChild.remove();
  // Don't auto-scroll - let user scroll up to read history
  if (atBottom) stream.scrollTop = 0; // since we prepend, top is newest
}
```

---

## Panel: Anomaly Z-Score (grid-area anomaly, row 3 col 2)

**Reduce height** - it was dominating. Row 3 is `1fr` (fills remaining space after rows 1,2,4). This is already correct. The issue is the panel has too much internal padding.

```css
.anomaly-panel {
  grid-area: anomaly;
  min-height: 0;
}

.anomaly-panel canvas {
  flex: 1;
  display: block;
  width: 100%;
  min-height: 0;
}
```

Keep existing draw logic. Add injection trend overlay as a dashed amber line (see Chart 5 below).

---

## Panel: Tool Heatmap (grid-area heatmap, row 4 col 2)

Row 4 is fixed at `120px`. This gives the heatmap a proper height.

```css
.heatmap-panel {
  grid-area: heatmap;
}

.heatmap-panel canvas {
  flex: 1;
  display: block;
  width: 100%;
  min-height: 0;
}
```

The 7 tools (web-search, file-read, file-write, http-request, email-send, code-exec, shell-exec) across 24 hours. Each cell coloured by call intensity. Keep existing drawHeatmap() logic.

---

## NEW Chart 1: Severity Donut (grid-area severity, row 1 col 3)

Proportion of events by severity as a donut/ring chart. Updates from SSE stats events.

```javascript
function drawSeverityDonut() {
  const ctx = severityCanvas.getContext('2d');
  const W = severityCanvas.width, H = severityCanvas.height;
  ctx.clearRect(0, 0, W, H);
  const cx = W/2, cy = H/2;
  const r = Math.min(W, H) * 0.40;
  const inner = r * 0.55;

  const vals = [
    { v: currentStats.breach,   c: '#ff2244', label: 'BREACH' },
    { v: currentStats.critical, c: '#ff5566', label: 'CRIT' },
    { v: currentStats.warning,  c: '#d4af37', label: 'WARN' },
    { v: currentStats.info,     c: '#00d4ff', label: 'INFO' },
  ];
  const total = vals.reduce((s, x) => s + x.v, 0) || 1;

  let angle = -Math.PI / 2;
  vals.forEach(s => {
    if (!s.v) return;
    const sweep = (s.v / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, angle, angle + sweep);
    ctx.closePath();
    ctx.fillStyle = s.c;
    ctx.shadowColor = s.c;
    ctx.shadowBlur = 10;
    ctx.fill();
    ctx.shadowBlur = 0;
    angle += sweep;
  });

  // Punch hole
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath();
  ctx.arc(cx, cy, inner, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';

  // Centre: total count
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `bold ${Math.round(r * 0.42)}px JetBrains Mono`;
  ctx.fillStyle = '#cce8f4';
  ctx.fillText(total, cx, cy - r * 0.1);
  ctx.font = `${Math.round(r * 0.17)}px JetBrains Mono`;
  ctx.fillStyle = '#8bafc0';
  ctx.fillText('EVENTS', cx, cy + r * 0.22);
}
```

---

## NEW Chart 2: Threat Level Gauge (grid-area gauge, row 2 col 3)

Semicircular speedometer. Score = `Math.min(100, stats.critical*4 + stats.warning*2 + stats.breach*20)`.

SVG implementation: 5 arc segments (teal 0-20, cyan 20-40, amber 40-60, red 60-80, deep-red 80-100). SVG needle line rotates from -90deg (0) to +90deg (100).

```html
<svg id="gauge-svg" viewBox="0 0 200 110" style="width:100%;height:auto">
  <defs>
    <filter id="gauge-glow"><feGaussianBlur stdDeviation="2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  </defs>
  <!-- 5 arc segments drawn as paths -->
  <!-- needle: line from 100,100 to 100,30 rotated by JS -->
  <line id="gauge-needle" x1="100" y1="100" x2="100" y2="35"
    stroke="#fff" stroke-width="2" stroke-linecap="round" filter="url(#gauge-glow)"
    style="transform-origin: 100px 100px; transform: rotate(-90deg); transition: transform 0.5s ease"/>
  <circle cx="100" cy="100" r="5" fill="#cce8f4"/>
  <text id="gauge-score" x="100" y="95" text-anchor="middle"
    font-family="JetBrains Mono" font-size="18" font-weight="700" fill="#00c896">0</text>
  <text x="100" y="108" text-anchor="middle"
    font-family="JetBrains Mono" font-size="7" fill="#8bafc0">THREAT LEVEL</text>
</svg>
```

```javascript
function updateGauge() {
  const score = Math.min(100,
    currentStats.critical * 4 + currentStats.warning * 2 + currentStats.breach * 20
  );
  const deg = -90 + (score / 100) * 180;
  document.getElementById('gauge-needle').style.transform = `rotate(${deg}deg)`;
  const el = document.getElementById('gauge-score');
  el.textContent = Math.round(score);
  el.setAttribute('fill',
    score > 75 ? '#ff2244' : score > 50 ? '#d4af37' : score > 25 ? '#00d4ff' : '#00c896'
  );
}
```

Call `updateGauge()` whenever stats update.

---

## NEW Chart 3: Session Scatter Plot (grid-area scatter, row 3 col 3)

Each session as a dot. X = event count in session. Y = max anomaly Z-score. Dot radius = log(duration_seconds+1) * 2. Colour = highest severity.

Build session aggregates from SSE events:
```javascript
const sessions = new Map();
// key: session_id, value: { events, maxZ, start, maxSev }

function trackSession(ev) {
  const s = sessions.get(ev.session_id) || { events: 0, maxZ: 0, start: Date.now(), maxSev: 'info' };
  s.events++;
  const sevRank = { info:1, warning:2, critical:3, breach:4 };
  if ((sevRank[ev.severity]||0) > (sevRank[s.maxSev]||0)) s.maxSev = ev.severity;
  sessions.set(ev.session_id, s);
}
```

Draw function plots each session dot with colour by `maxSev`. Axes: faint teal grid, X-label "events/session", Y-label "max Z". Show last 50 sessions max.

---

## NEW Chart 4: Top Event Types Horizontal Bar (grid-area topevents, row 4 col 3)

Maintain a rolling count of event_type occurrences from SSE stream:
```javascript
const eventCounts = new Map();
function trackEventType(ev) {
  eventCounts.set(ev.event_type, (eventCounts.get(ev.event_type)||0) + 1);
}
```

Draw top 7 as horizontal bars. Label on left (max 22 chars, replace underscores with spaces). Bar length proportional to count. Colour: red if name contains 'injection','blocked','breach','kill'; amber if 'warning','egress','honeypot'; cyan otherwise.

---

## NEW Chart 5: Injection Trend overlay on Anomaly chart

Maintain 10-minute rolling injection count array (one bucket per minute):
```javascript
const injPerMin = new Array(10).fill(0);
```

Increment current bucket on any event where `event_type` contains 'injection'. Roll buckets every 60s.

In `drawAnomalyChart()`, after the main Z-score line, draw the injection trend as a dashed amber line:
```javascript
// overlay injection trend
ctx.setLineDash([3, 3]);
ctx.strokeStyle = '#d4af37';
ctx.lineWidth = 1.5;
ctx.beginPath();
const maxInj = Math.max(...injPerMin, 1);
injPerMin.forEach((v, i) => {
  const x = (i / (injPerMin.length - 1)) * W;
  const y = H - (v / maxInj) * (H * 0.7);
  i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
});
ctx.stroke();
ctx.setLineDash([]);
// legend
ctx.fillStyle = '#d4af37';
ctx.font = '8px JetBrains Mono';
ctx.fillText('-- inject/min', W - 95, 14);
```

---

## NEW Chart 6: Egress Sparkline (in stream panel header)

30-minute rolling bar of egress_blocked events. Small canvas (full-width, 24px tall) embedded in the stream panel label bar.

```html
<div class="panel-label">
  LIVE EVENT STREAM
  <canvas id="egress-canvas" height="16" style="flex:1; margin-left:0.5rem; opacity:0.8"></canvas>
  <span id="egress-count" style="font-size:0.6rem;color:var(--glow-red)"></span>
</div>
```

```javascript
const egressMinutes = new Array(30).fill(0);
function drawEgressSparkline() {
  const ctx = egressCanvas.getContext('2d');
  const W = egressCanvas.width, H = egressCanvas.height;
  ctx.clearRect(0, 0, W, H);
  const max = Math.max(...egressMinutes, 1);
  const bw = W / 30;
  egressMinutes.forEach((v, i) => {
    if (!v) return;
    const h = Math.max(2, (v / max) * H);
    ctx.fillStyle = '#ff224488';
    ctx.fillRect(i * bw + 0.5, H - h, bw - 1, h);
  });
}
```

---

## NEW Chart 7: Provider Pie (small, in gauge panel or instances footer)

Track which provider handled each tool call from event metadata. Draw a small 3-slice pie.

```javascript
const providerCounts = { deepseek: 0, anthropic: 0, openai: 0, other: 0 };
function trackProvider(ev) {
  const p = ev.metadata?.provider || 'other';
  providerCounts[p] = (providerCounts[p] || 0) + 1;
}
```

Colours: deepseek=#9b59ff, anthropic=#00c896, openai=#00d4ff, other=#8bafc0.
Draw as a small inline pie (80x80) in the instances bar below the kill switch.

---

## NEW Chart 8: Honeypot Grid

A grid of squares, one per honeypot from `GET /api/honeypots`. Poll every 30s.
- Untriggered: dark fill, dim border
- Triggered: bright red fill, red glow, blinking

```javascript
function drawHoneypotGrid(canvas, honeypots) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  const cols = Math.max(4, Math.ceil(Math.sqrt(honeypots.length)));
  const rows = Math.ceil(honeypots.length / cols);
  const cw = W / cols - 2, ch = H / rows - 2;
  honeypots.forEach((hp, i) => {
    const col = i % cols, row = Math.floor(i / cols);
    const x = col * (cw + 2) + 1, y = row * (ch + 2) + 1;
    if (hp.triggered) {
      ctx.fillStyle = '#ff224466';
      ctx.shadowColor = '#ff2244';
      ctx.shadowBlur = 10;
    } else {
      ctx.fillStyle = '#0a1628';
      ctx.shadowBlur = 0;
    }
    ctx.fillRect(x, y, cw, ch);
    ctx.strokeStyle = hp.triggered ? '#ff2244' : 'rgba(0,200,150,0.15)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, cw, ch);
    ctx.shadowBlur = 0;
    if (hp.triggered) {
      ctx.fillStyle = '#ff2244';
      ctx.font = `${Math.min(8, ch * 0.5)}px JetBrains Mono`;
      ctx.textAlign = 'center';
      ctx.fillText('!', x + cw/2, y + ch * 0.65);
    }
  });
}
```

Place this canvas in the instances bar or as a small panel below the instances.

---

## Canvas init fix (critical)

ALL canvases must initialise after layout paint. At the end of the script:

```javascript
// Boot sequence - two rAF ensures DOM has painted before reading getBoundingClientRect
requestAnimationFrame(() => requestAnimationFrame(() => {
  [freqCanvas, anomalyCanvas, heatmapCanvas, severityCanvas, scatterCanvas,
   topEventsCanvas, egressCanvas].forEach(c => {
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = c.parentElement.getBoundingClientRect();
    if (rect.width > 0) {
      c.width = Math.floor(rect.width * dpr);
      c.style.width = rect.width + 'px';
    }
    const h = parseInt(c.getAttribute('height') || '120', 10);
    c.height = Math.floor(h * dpr);
    c.style.height = h + 'px';
  });
  drawAll();
}));

function drawAll() {
  drawFrequencyGraph();
  drawAnomalyChart();
  drawHeatmap();
  drawSeverityDonut();
  updateGauge();
  drawScatter();
  drawTopEvents();
  drawEgressSparkline();
}
```

Also call `drawAll()` on `window.resize`.

---

## Kill switch modal (keep exactly as-is)

The existing modal requiring the user to type "KILL" is correct. Keep it unchanged.

---

## Instances bar (bottom strip, fixed height ~44px)

Horizontal scrollable strip. One chip per instance:

```
[● carina-local  ACTIVE  29s ago]  [KILL]   [● other-instance  SUSPENDED  2m ago]  [RESUME]
```

Keep existing JS (pollStatus, kill, resume functions).

---

## SSE connection

Keep existing EventSource at `/api/stream`. On each event, call:
- `addEventToStream(ev)`
- `addRadarDot(ev)`
- `incrementFreqBucket(ev)`
- `trackSession(ev)`
- `trackEventType(ev)`
- `trackProvider(ev)`
- `trackEgress(ev)` (if event_type === 'egress_blocked')
- `trackInjection(ev)` (if event_type contains 'injection')

On stats update: `updateStatCards()`, `drawSeverityDonut()`, `updateGauge()`

---

## Scanlines and CRT boot effect (keep)

```css
body::after {
  content: '';
  position: fixed;
  inset: 0;
  background: repeating-linear-gradient(
    0deg,
    transparent,
    transparent 2px,
    rgba(0,0,0,0.03) 2px,
    rgba(0,0,0,0.03) 4px
  );
  pointer-events: none;
  z-index: 9999;
}

@keyframes crtBoot {
  0%   { opacity: 0; }
  10%  { opacity: 0.8; }
  15%  { opacity: 0.1; }
  20%  { opacity: 0.9; }
  100% { opacity: 1; }
}

.app { animation: crtBoot 1.2s ease-out forwards; }
```

---

## What this rebuild delivers

```
┌──────────────┬──────────────────────────────┬─────────────────────┐
│ RADAR        │ STAT CARDS (centred nums)     │ SEVERITY DONUT      │
│ (fills full  ├──────────────────────────────┼─────────────────────┤
│  left col,   │ EVENT FREQUENCY EKG          │ THREAT GAUGE        │
│  rows 1-2)   ├──────────────────────────────┼─────────────────────┤
│              │ LIVE EVENT STREAM            │ SESSION SCATTER     │
│              │ (scrollable, prepend-newest) │                     │
├──────────────┼──────────────────────────────┼─────────────────────┤
│ STREAM       │ ANOMALY + INJECTION OVERLAY  │ TOP EVENT TYPES BAR │
│ (rows 3-4,   ├──────────────────────────────┤                     │
│  scrollable) │ TOOL HEATMAP                 │                     │
└──────────────┴──────────────────────────────┴─────────────────────┘
└─────────────── INSTANCES BAR + PROVIDER PIE ──────────────────────┘
```
