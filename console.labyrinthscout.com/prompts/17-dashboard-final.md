# Labyrinth Scout Dashboard - Definitive Final Rebuild

**File:** `console.labyrinthscout.com/public/dashboard.html`
**Replace entire file.** Keep only `<!-- __SCOUT_KEY_INJECTION__ -->` in `<head>`.

This spec fixes every visual and data problem identified in the live screenshot. Read it fully before writing a single line.

---

## Non-negotiable requirements

1. ALL charts must load historical data from the API on startup - not wait for SSE events
2. Radar must fill its entire panel - no max-width cap, no margin centering
3. Event frequency canvas must render on first paint (double rAF pattern)
4. Session scatter must have axis labels, grid lines, and minimum visual structure even with 0 dots
5. Top event types must pre-load from `GET /api/events?limit=200` on startup
6. Tool heatmap must be a proper 2D coloured cell grid, not bars
7. No chart panel can have more than 15% dead space
8. All label text minimum 0.65rem (nothing unreadable)

---

## Layout - nested flex, not a single grid

Forget a single CSS grid for the whole dashboard. Use a 3-column flex row with each column managing its own vertical stack. This gives exact control over proportions.

```html
<div class="app">
  <header class="hdr">...</header>
  <div class="cols">
    <div class="col-left">
      <div class="panel radar-panel">...</div>
      <div class="panel stream-panel">...</div>
    </div>
    <div class="col-mid">
      <div class="row-stats">...</div>      <!-- 4 stat cards -->
      <div class="panel freq-panel">...</div>
      <div class="panel anomaly-panel">...</div>
      <div class="panel heatmap-panel">...</div>
    </div>
    <div class="col-right">
      <div class="panel donut-panel">...</div>
      <div class="panel gauge-panel">...</div>
      <div class="panel scatter-panel">...</div>
      <div class="panel topevents-panel">...</div>
    </div>
  </div>
  <div class="instances-bar">...</div>
</div>
```

```css
.app {
  width: 100%;
  height: 100vh;
  display: flex;
  flex-direction: column;
  padding: 0.4rem 0.75rem 0.4rem;
  gap: 0.4rem;
  overflow: hidden;
}

.cols {
  flex: 1;
  min-height: 0;
  display: flex;
  gap: 0.4rem;
}

/* LEFT COLUMN: 26% width. Radar takes 60%, stream takes 40% */
.col-left {
  width: 26%;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  min-height: 0;
}

.radar-panel {
  flex: 3; /* 60% of column */
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.stream-panel {
  flex: 2; /* 40% of column */
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* MIDDLE COLUMN: fills remaining space minus right col */
.col-mid {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  min-height: 0;
}

.row-stats {
  height: 110px;
  flex-shrink: 0;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.4rem;
}

.freq-panel {
  height: 80px;
  flex-shrink: 0;
}

.anomaly-panel {
  flex: 2; /* ~40% of remaining middle height */
  min-height: 0;
}

.heatmap-panel {
  flex: 3; /* ~60% of remaining middle height - heatmap needs space */
  min-height: 0;
}

/* RIGHT COLUMN: 22% width. All 4 panels stack equally */
.col-right {
  width: 22%;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  min-height: 0;
}

.donut-panel   { flex: 3; min-height: 0; }
.gauge-panel   { flex: 2; min-height: 0; }
.scatter-panel { flex: 3; min-height: 0; }
.topevents-panel { flex: 3; min-height: 0; }
```

---

## Colour palette

```css
:root {
  --void:       #020409;
  --navy:       #050c1a;
  --lift:       #0a1628;
  --border:     rgba(0,200,150,0.12);
  --green:      #00c896;
  --red:        #ff2244;
  --amber:      #d4af37;
  --cyan:       #00d4ff;
  --purple:     #9b59ff;
  --text:       #8bafc0;
  --bright:     #cce8f4;
}
```

Fonts: `JetBrains Mono` for all numbers and data. `Inter` for labels. Both from Google Fonts.

---

## Panel base

```css
.panel {
  background: var(--navy);
  border: 1px solid var(--border);
  border-radius: 4px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.panel-lbl {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.65rem;
  letter-spacing: 0.13em;
  text-transform: uppercase;
  color: var(--amber);
  padding: 0.3rem 0.6rem;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  white-space: nowrap;
}

.panel-body {
  flex: 1;
  min-height: 0;
  position: relative;
}
```

---

## Header (40px, no flex-shrink)

```
[LABYRINTH SCOUT]  [● LIVE]  [instance: carina-local]          [2026-06-04 03:36:35 UTC]
```

```css
.hdr {
  height: 40px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--border);
  padding: 0 0.25rem 0.4rem;
  gap: 1rem;
}
.hdr-brand {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.9rem;
  font-weight: 600;
  letter-spacing: 0.2em;
  color: var(--amber);
}
.hdr-live {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.65rem;
  color: var(--text);
}
.live-dot {
  width: 7px; height: 7px;
  border-radius: 50%;
  background: var(--red);
}
.live-dot.on {
  background: var(--green);
  animation: pulse 2s infinite;
}
@keyframes pulse {
  0%,100% { box-shadow: 0 0 0 0 rgba(0,200,150,.5); }
  50%      { box-shadow: 0 0 0 6px rgba(0,200,150,0); }
}
.hdr-instance {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.65rem;
  color: var(--cyan);
  padding: 0.15rem 0.4rem;
  border: 1px solid rgba(0,212,255,.2);
  border-radius: 2px;
}
.hdr-clock {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.7rem;
  color: var(--bright);
  margin-left: auto;
}
```

---

## Radar Panel

The SVG must completely fill the panel body. No max-width. No centering padding.

```css
.radar-panel .panel-body {
  padding: 0;
}

#radar-svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
```

SVG `viewBox="0 0 400 400"` with `preserveAspectRatio="xMidYMid meet"`.

Radar elements:
- 3 concentric rings at 33%, 66%, 100% radius of 190 from centre (200,200)
- 8 radial lines (every 45deg)
- Sweep arc: 70-degree pie slice, radialGradient fill (green at tip, transparent at centre)
- Threat dots: circle elements added on events, fading over 8 seconds
- All elements inside `<g id="radar-dots"></g>`

Sweep animation using `requestAnimationFrame` - one full rotation every 6 seconds.

On critical/breach event: border-color of `.radar-panel` flashes to `var(--red)` for 2 seconds, body gets class `grid-pulse` for 2 seconds.

---

## Stat Cards (4 cards, 110px tall row)

Each card: content centred both axes. Number large, label small below.

```css
.stat-card {
  background: var(--lift);
  border: 1px solid var(--border);
  border-radius: 4px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.2rem;
  position: relative;
  overflow: hidden;
}

.stat-card::after {
  content: '';
  position: absolute;
  bottom: 0; left: 0; right: 0;
  height: 2px;
}

.stat-card.critical::after { background: var(--red); box-shadow: 0 0 8px var(--red); }
.stat-card.warning::after  { background: var(--amber); box-shadow: 0 0 8px var(--amber); }
.stat-card.info::after     { background: var(--cyan); box-shadow: 0 0 8px var(--cyan); }
.stat-card.breach::after   { background: var(--red); animation: breachFlash 1s infinite; }

@keyframes breachFlash { 50% { opacity: 0; } }

.stat-num {
  font-family: 'JetBrains Mono', monospace;
  font-size: clamp(2.2rem, 3.5vw, 4rem);
  font-weight: 700;
  line-height: 1;
  text-align: center;
  text-shadow: 0 0 20px currentColor;
  transition: color 0.3s;
}

.stat-lbl {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.6rem;
  letter-spacing: 0.15em;
  color: var(--text);
  text-align: center;
}

.stat-card.critical .stat-num { color: var(--red); }
.stat-card.warning  .stat-num { color: var(--amber); }
.stat-card.info     .stat-num { color: var(--cyan); }
.stat-card.breach   .stat-num { color: var(--red); }
```

Animate number changes: when value changes, run a brief scale(1.1) → scale(1) transition on `.stat-num`.

---

## Event Frequency Graph (Canvas, 80px panel)

60-second rolling bar chart. One bar per second. Bar height = event count × severity weight.

**CRITICAL FIX:** Canvas width must be set AFTER layout. Use this exact pattern:

```javascript
function sizeCanvas(c) {
  const dpr = window.devicePixelRatio || 1;
  const w = c.parentElement.clientWidth;
  const h = c.parentElement.clientHeight;
  if (w === 0 || h === 0) return false;
  c.width  = Math.floor(w * dpr);
  c.height = Math.floor(h * dpr);
  c.style.width  = w + 'px';
  c.style.height = h + 'px';
  const ctx = c.getContext('2d');
  ctx.scale(dpr, dpr);
  return true;
}

// At startup - MUST use double rAF:
requestAnimationFrame(() => requestAnimationFrame(() => {
  [freqCanvas, anomalyCanvas, heatmapCanvas, donutCanvas,
   scatterCanvas, topCanvas, egressCanvas].forEach(c => {
    if (c) sizeCanvas(c);
  });
  drawAll();
}));
```

Canvas style: `position: absolute; inset: 0;` inside `.panel-body { position: relative; }`.

```javascript
// Pre-populate frequency from history on startup
async function loadEventHistory() {
  const r = await fetch('/api/events?limit=200', { headers: apiHeaders() });
  const data = await r.json();
  const events = Array.isArray(data) ? data : (data.events || []);
  events.forEach(ev => {
    // Place in correct time bucket based on created_at
    const ageMs = Date.now() - new Date(ev.created_at).getTime();
    const bucketIdx = Math.floor(ageMs / 1000);
    if (bucketIdx >= 0 && bucketIdx < 60) {
      const b = freqBuckets[59 - bucketIdx];
      if (b) b[ev.severity] = (b[ev.severity] || 0) + 1;
    }
  });
  drawFrequency();
}
```

Draw: background `#020409`. Bars are `barW - 1` wide. Colour: breach=`#ff2244`, critical=`#ff4460`, warning=`#d4af37`, info=`#00d4ff`. Glow via `ctx.shadowBlur`. Baseline: faint green line.

---

## Anomaly Z-Score Chart (Canvas, flex:2 in mid column)

**Load history on startup:**
```javascript
async function loadAnomalies() {
  const r = await fetch('/api/anomalies/recent?limit=200', { headers: apiHeaders() });
  const d = await r.json();
  anomalyPoints = (d.anomalies || d || []).map(a => ({
    z: parseFloat(a.z_score) || 0,
    t: new Date(a.detected_at || a.created_at).getTime(),
    metric: a.metric_name
  })).sort((a, b) => a.t - b.t);
  drawAnomaly();
}
```

If no data yet, draw an empty chart with visible axes and threshold line - not a blank canvas.

Draw:
- Background: dark navy `#050c1a`
- Horizontal grid lines at Z=1, 2, 3, 4, 5 - faint green. Label them on left axis.
- **Threshold line at Z=3.0**: dashed red, label "ANOMALY THRESHOLD" right-aligned
- Main Z-score line: smooth bezier, colour transitions from cyan (below 3) to red (above 3) at the threshold. Glow effect.
- Fill area under line: gradient from line colour (20% opacity) to transparent
- When Z>3: the line glows red intensely. `ctx.shadowBlur = 15`
- X axis: show time labels every 2 minutes (bottom axis)
- If `anomalyPoints` is empty: draw "No anomaly data yet" centred in amber text

**Injection trend overlay** (dashed amber line):
- Separate rolling 10-minute array of per-minute injection counts
- Pre-load from event history: count events with `event_type.includes('injection')` per minute
- Draw as `setLineDash([3,3])` amber line, `lineWidth: 1.5`
- Legend: "-- injections/min" in amber, top-right of canvas

---

## Tool Heatmap - PROPER GRID (Canvas, flex:3 in mid column - largest panel)

A real 2D coloured cell grid. 7 tools on Y axis × 24 hours on X axis = 168 cells.

**Load from API on startup:**
```javascript
async function loadHeatmapData() {
  const r = await fetch('/api/status', { headers: apiHeaders() });
  const d = await r.json();
  const toolCalls = d.toolCalls || {};
  // toolCalls format: { 'web-search': count, ... } - aggregate into heatmap
  // Also build from event history:
  const r2 = await fetch('/api/events?limit=500', { headers: apiHeaders() });
  const d2 = await r2.json();
  const events = Array.isArray(d2) ? d2 : (d2.events || []);
  events.forEach(ev => {
    const tool = ev.metadata?.tool;
    const hour = new Date(ev.created_at).getHours();
    if (tool && TOOLS.includes(tool)) {
      if (!heatmap[tool]) heatmap[tool] = new Array(24).fill(0);
      heatmap[tool][hour]++;
    }
  });
  drawHeatmap();
}
```

Draw the heatmap:
```javascript
const TOOLS = ['web-search','file-read','file-write','http-request','email-send','code-exec','shell-exec'];

function drawHeatmap() {
  const ctx = heatmapCanvas.getContext('2d');
  const W = heatmapCanvas.clientWidth;
  const H = heatmapCanvas.clientHeight;
  ctx.clearRect(0, 0, W, H);

  const LABEL_W = 72;
  const TOP = 18;
  const cellW = (W - LABEL_W) / 24;
  const cellH = (H - TOP) / TOOLS.length;

  // Find max for colour scaling
  const maxVal = Math.max(1, ...TOOLS.flatMap(t => heatmap[t] || []));

  // Hour labels (top axis)
  ctx.fillStyle = 'rgba(139,175,192,0.6)';
  ctx.font = `${Math.min(9, cellW * 0.7)}px JetBrains Mono`;
  ctx.textAlign = 'center';
  [0,4,8,12,16,20,23].forEach(h => {
    ctx.fillText(h.toString().padStart(2,'0'), LABEL_W + h * cellW + cellW/2, TOP - 5);
  });

  // Draw cells
  TOOLS.forEach((tool, row) => {
    // Tool label (left axis)
    ctx.fillStyle = '#8bafc0';
    ctx.font = `${Math.max(8, Math.min(11, cellH * 0.5))}px JetBrains Mono`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(tool, LABEL_W - 4, TOP + row * cellH + cellH / 2);

    // 24 cells
    for (let h = 0; h < 24; h++) {
      const val = (heatmap[tool] || [])[h] || 0;
      const intensity = val / maxVal;

      // Colour: 0=dark navy, low=teal dark, high=bright green
      const r = Math.round(5  + intensity * 0);
      const g = Math.round(12 + intensity * 188);
      const b = Math.round(26 + intensity * 118);

      ctx.fillStyle = `rgb(${r},${g},${b})`;
      if (intensity > 0) {
        ctx.shadowColor = `rgba(0,200,150,${intensity * 0.5})`;
        ctx.shadowBlur = intensity > 0.5 ? 6 : 0;
      }
      ctx.fillRect(
        LABEL_W + h * cellW + 1,
        TOP + row * cellH + 1,
        cellW - 2,
        cellH - 2
      );
      ctx.shadowBlur = 0;
    }
  });

  // Grid overlay
  ctx.strokeStyle = 'rgba(0,200,150,0.06)';
  ctx.lineWidth = 0.5;
  for (let h = 0; h <= 24; h++) {
    ctx.beginPath();
    ctx.moveTo(LABEL_W + h * cellW, TOP);
    ctx.lineTo(LABEL_W + h * cellW, H);
    ctx.stroke();
  }
  for (let r = 0; r <= TOOLS.length; r++) {
    ctx.beginPath();
    ctx.moveTo(LABEL_W, TOP + r * cellH);
    ctx.lineTo(W, TOP + r * cellH);
    ctx.stroke();
  }
}
```

When no data: draw the full grid in dark navy with the labels visible - shows structure even when empty.

---

## Severity Donut (right col, flex:3)

Canvas fills panel body entirely. Load `currentStats` from `/api/status` on startup.

Centre hole must be large enough to show total count. Minimum slice: if a severity is 0%, skip it but still show others. If ALL are 0, show a grey ring with "NO DATA".

Draw 4 slices: breach→critical→warning→info (clockwise from top). Each slice glows.

Legend below the donut (bottom 25% of panel): small colour dots with labels and percentages.

---

## Threat Level Gauge (right col, flex:2)

SVG semicircle speedometer. Use the FULL panel width and height.

```html
<svg id="gauge-svg" viewBox="0 0 200 115" preserveAspectRatio="xMidYMid meet"
     style="width:100%;height:100%;display:block">
  <defs>
    <filter id="g-glow">
      <feGaussianBlur stdDeviation="1.5" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>

  <!-- 5 arc segments: teal(0-20) cyan(20-40) amber(40-60) red(60-80) deep-red(80-100) -->
  <!-- Draw using path arcs at radius 80, width 12 -->

  <!-- Tick marks every 10 units -->

  <!-- Needle: line from 100,100 rotated -->
  <line id="g-needle" x1="100" y1="100" x2="100" y2="28"
    stroke="#ffffff" stroke-width="2.5" stroke-linecap="round"
    filter="url(#g-glow)"
    style="transform-origin:100px 100px; transform:rotate(-90deg);
           transition:transform 0.6s cubic-bezier(0.34,1.56,0.64,1)"/>

  <!-- Pivot dot -->
  <circle cx="100" cy="100" r="5" fill="#0a1628" stroke="#00c896" stroke-width="1.5"/>

  <!-- Score -->
  <text id="g-score" x="100" y="82" text-anchor="middle"
    font-family="JetBrains Mono" font-size="22" font-weight="700" fill="#00c896">0</text>
  <text x="100" y="108" text-anchor="middle"
    font-family="JetBrains Mono" font-size="7" fill="#8bafc0" letter-spacing="0.1em">THREAT LEVEL</text>
</svg>
```

Needle pivot is at 100,100. Needle rotates from -90deg (score=0) to +90deg (score=100):
```javascript
function updateGauge() {
  const score = Math.min(100,
    (currentStats.breach||0)*20 + (currentStats.critical||0)*4 + (currentStats.warning||0)*2
  );
  const deg = -90 + (score/100)*180;
  document.getElementById('g-needle').style.transform = `rotate(${deg}deg)`;
  const el = document.getElementById('g-score');
  el.textContent = Math.round(score);
  el.setAttribute('fill',
    score>75?'#ff2244': score>50?'#d4af37': score>25?'#00d4ff':'#00c896');
}
```

---

## Session Scatter (right col, flex:3)

Canvas. Must have VISIBLE STRUCTURE even with 0 dots.

Draw axis lines (bottom and left), axis labels, grid lines at 25/50/75% - before any dots. Then overlay dots.

```javascript
function drawScatter() {
  const ctx = scatterCanvas.getContext('2d');
  const W = scatterCanvas.clientWidth, H = scatterCanvas.clientHeight;
  ctx.clearRect(0, 0, W, H);

  const PAD = { top: 10, right: 10, bottom: 28, left: 36 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  // Grid
  ctx.strokeStyle = 'rgba(0,200,150,0.08)';
  ctx.lineWidth = 0.5;
  [0.25, 0.5, 0.75, 1].forEach(f => {
    const y = PAD.top + plotH * (1-f);
    ctx.beginPath(); ctx.moveTo(PAD.left, y); ctx.lineTo(PAD.left+plotW, y); ctx.stroke();
    const x = PAD.left + plotW * f;
    ctx.beginPath(); ctx.moveTo(x, PAD.top); ctx.lineTo(x, PAD.top+plotH); ctx.stroke();
  });

  // Axes
  ctx.strokeStyle = 'rgba(0,200,150,0.3)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PAD.left, PAD.top); ctx.lineTo(PAD.left, PAD.top+plotH);
  ctx.lineTo(PAD.left+plotW, PAD.top+plotH); ctx.stroke();

  // Axis labels
  ctx.fillStyle = 'rgba(139,175,192,0.7)';
  ctx.font = '7px JetBrains Mono';
  ctx.textAlign = 'center';
  ctx.fillText('events/session', PAD.left + plotW/2, H - 4);
  ctx.save();
  ctx.translate(8, PAD.top + plotH/2);
  ctx.rotate(-Math.PI/2);
  ctx.fillText('max Z-score', 0, 0);
  ctx.restore();

  // Dots
  const entries = [...sessionData.values()];
  if (entries.length === 0) {
    ctx.fillStyle = 'rgba(139,175,192,0.3)';
    ctx.font = '9px JetBrains Mono';
    ctx.textAlign = 'center';
    ctx.fillText('no sessions yet', PAD.left + plotW/2, PAD.top + plotH/2);
    return;
  }

  const maxEv = Math.max(...entries.map(s=>s.events), 1);
  const maxZ  = Math.max(...entries.map(s=>s.maxZ), 5);
  const COLS  = { info:'#00d4ff', warning:'#d4af37', critical:'#ff4460', breach:'#ff2244' };

  entries.forEach(s => {
    const x = PAD.left + (s.events/maxEv)*plotW;
    const y = PAD.top + plotH - (s.maxZ/maxZ)*plotH;
    const r = Math.max(4, Math.min(12, Math.log(s.events+1)*2.5));
    const col = COLS[s.maxSev]||'#00c896';
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI*2);
    ctx.fillStyle = col+'66';
    ctx.fill();
    ctx.strokeStyle = col;
    ctx.lineWidth = 1;
    ctx.stroke();
  });
}
```

Pre-populate `sessionData` from event history on startup.

---

## Top Event Types (right col, flex:3)

**Must pre-load from history:**
```javascript
async function loadTopEvents() {
  const r = await fetch('/api/events?limit=300', { headers: apiHeaders() });
  const d = await r.json();
  const events = Array.isArray(d) ? d : (d.events || []);
  events.forEach(ev => {
    typeCounts.set(ev.event_type, (typeCounts.get(ev.event_type)||0)+1);
  });
  drawTopEvents();
}
```

Draw top 8 as horizontal bars:

```javascript
function drawTopEvents() {
  const ctx = topCanvas.getContext('2d');
  const W = topCanvas.clientWidth, H = topCanvas.clientHeight;
  ctx.clearRect(0, 0, W, H);

  const sorted = [...typeCounts.entries()].sort((a,b)=>b[1]-a[1]).slice(0,8);

  if (!sorted.length) {
    ctx.fillStyle = 'rgba(139,175,192,0.3)';
    ctx.font = '9px JetBrains Mono';
    ctx.textAlign = 'center';
    ctx.fillText('no data yet', W/2, H/2);
    return;
  }

  const max = sorted[0][1];
  const rows = sorted.length;
  const rowH = H / rows;
  const LBL = Math.min(120, W * 0.45);
  const BAR_AREA = W - LBL - 30;

  sorted.forEach(([type, count], i) => {
    const y = i * rowH;
    const bw = (count/max) * BAR_AREA;
    const isRed = /injection|blocked|breach|kill|danger|egress/.test(type);
    const isAmber = /warning|honeypot|anomaly/.test(type);
    const col = isRed ? '#ff2244' : isAmber ? '#d4af37' : '#00c896';

    // Row background alternate
    if (i%2===0) {
      ctx.fillStyle = 'rgba(0,200,150,0.03)';
      ctx.fillRect(0, y, W, rowH);
    }

    // Label
    ctx.fillStyle = '#8bafc0';
    ctx.font = `${Math.min(9.5, rowH*0.55)}px JetBrains Mono`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(type.replace(/_/g,' ').slice(0,22), LBL - 4, y + rowH/2);

    // Bar
    ctx.fillStyle = col+'99';
    ctx.fillRect(LBL, y + 2, bw, rowH - 4);

    // Count
    ctx.fillStyle = col;
    ctx.textAlign = 'left';
    ctx.font = `bold ${Math.min(9, rowH*0.5)}px JetBrains Mono`;
    ctx.fillText(count, LBL + bw + 4, y + rowH/2);
  });
}
```

---

## Live Event Stream

Scroll must work. Key CSS:
```css
.stream-body {
  flex: 1;
  overflow-y: scroll; /* scroll, not auto - always show track */
  min-height: 0; /* WITHOUT THIS flex child ignores overflow */
  scrollbar-color: rgba(0,200,150,0.3) transparent;
  scrollbar-width: thin;
}
```

**Pre-load existing events on startup:**
```javascript
async function loadRecentEvents() {
  const r = await fetch('/api/events?limit=50', { headers: apiHeaders() });
  const d = await r.json();
  const events = Array.isArray(d) ? d : (d.events || []);
  // Render oldest first (they arrive newest-first from API)
  [...events].reverse().forEach(ev => prependEvent(ev, false));
}

function prependEvent(ev, animate = true) {
  const empty = streamBody.querySelector('.stream-empty');
  if (empty) empty.remove();

  const row = document.createElement('div');
  row.className = `event-row sev-${ev.severity}`;
  if (animate) row.classList.add('event-new');

  const ts = new Date(ev.created_at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',second:'2-digit'});
  const sevLabel = ev.severity.toUpperCase().padEnd(8);

  row.innerHTML = `
    <span class="ev-ts">${ts}</span>
    <span class="ev-sev ${ev.severity}">${sevLabel}</span>
    <span class="ev-type">${ev.event_type.replace(/_/g,' ')}</span>
    <span class="ev-desc">${(ev.description||'').slice(0,60)}</span>
    <span class="ev-inst">${ev.instance_id||''}</span>
  `;

  streamBody.prepend(row);
  while (streamBody.children.length > 150) streamBody.lastElementChild.remove();
}
```

Event row CSS:
```css
.event-row {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.65rem;
  padding: 0.3rem 0.5rem;
  border-bottom: 1px solid rgba(0,200,150,0.05);
  border-left: 2px solid transparent;
  display: grid;
  grid-template-columns: 60px 72px 1fr 2fr auto;
  gap: 0.4rem;
  align-items: center;
  line-height: 1.3;
}

.event-row.sev-critical { border-left-color: #ff2244; }
.event-row.sev-breach   { border-left-color: #ff2244; background: rgba(255,34,68,0.05); }
.event-row.sev-warning  { border-left-color: #d4af37; }
.event-row.sev-info     { border-left-color: rgba(0,212,255,0.3); }

.ev-ts   { color: rgba(139,175,192,0.6); }
.ev-sev  { font-weight: 600; font-size: 0.6rem; letter-spacing: 0.06em; }
.ev-sev.critical { color: #ff4460; }
.ev-sev.breach   { color: #ff2244; }
.ev-sev.warning  { color: #d4af37; }
.ev-sev.info     { color: #00d4ff; }
.ev-type { color: #cce8f4; }
.ev-desc { color: rgba(139,175,192,0.7); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ev-inst { color: rgba(0,200,150,0.5); font-size: 0.55rem; }

.event-new { animation: slideIn 0.3s ease-out; }
@keyframes slideIn { from { opacity: 0; transform: translateY(-4px); } }
```

Egress sparkline in stream panel label:
```html
<div class="panel-lbl">
  LIVE EVENT STREAM
  <canvas id="egress-canvas" style="width:100px;height:16px;margin-left:auto;opacity:0.8"></canvas>
  <span id="egress-total" style="font-size:0.6rem;color:var(--red);min-width:20px;text-align:right"></span>
</div>
```

---

## Instances Bar (32px, bottom strip)

```css
.instances-bar {
  height: 36px;
  flex-shrink: 0;
  background: var(--navy);
  border: 1px solid var(--border);
  border-radius: 4px;
  display: flex;
  align-items: center;
  padding: 0 0.75rem;
  gap: 1.5rem;
  overflow-x: auto;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.65rem;
}

.inst-chip {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  white-space: nowrap;
}

.inst-dot {
  width: 6px; height: 6px;
  border-radius: 50%;
}
.inst-dot.active    { background: var(--green); animation: pulse 2s infinite; }
.inst-dot.suspended { background: var(--red); }
.inst-dot.offline   { background: var(--text); opacity: 0.4; }

.inst-name { color: var(--bright); }
.inst-status.active    { color: var(--green); }
.inst-status.suspended { color: var(--red); }

.inst-age { color: rgba(139,175,192,0.5); }

.btn-kill {
  background: rgba(255,34,68,0.15);
  border: 1px solid rgba(255,34,68,0.4);
  color: #ff2244;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.6rem;
  padding: 0.15rem 0.5rem;
  border-radius: 2px;
  cursor: pointer;
  letter-spacing: 0.08em;
}
.btn-kill:hover { background: rgba(255,34,68,0.3); }

.btn-resume {
  background: rgba(0,200,150,0.1);
  border: 1px solid rgba(0,200,150,0.3);
  color: var(--green);
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.6rem;
  padding: 0.15rem 0.5rem;
  border-radius: 2px;
  cursor: pointer;
}
```

---

## Kill Modal

Full-screen overlay. Requires typing "KILL" to enable the confirm button. Do not use browser `confirm()`. Existing logic is correct - keep it.

---

## Startup sequence (MUST be in this order)

```javascript
document.addEventListener('DOMContentLoaded', async () => {
  updateClock();
  setInterval(updateClock, 1000);

  // 1. Load data first (parallel)
  await Promise.allSettled([
    loadStatus(),          // fills stats, gauge, donut
    loadEventHistory(),    // fills freq, stream, topEvents, scatter, heatmap
    loadAnomalies(),       // fills anomaly chart
    loadHoneypots(),       // fills honeypot grid
  ]);

  // 2. Start canvas sizing AFTER data and after paint
  requestAnimationFrame(() => requestAnimationFrame(() => {
    sizeAllCanvases();
    drawAll();
    startRadar(); // begins rAF loop
  }));

  // 3. Connect live SSE
  connectSSE();

  // 4. Polling intervals
  setInterval(loadStatus, 30_000);
  setInterval(loadAnomalies, 15_000);
  setInterval(loadHoneypots, 30_000);
  setInterval(rollFreqBucket, 1_000);
  setInterval(rollEgressBucket, 60_000);
});
```

---

## Background effects

Grid:
```css
body::before {
  content: '';
  position: fixed; inset: 0; pointer-events: none; z-index: 0;
  background-image:
    linear-gradient(rgba(0,200,150,0.025) 1px, transparent 1px),
    linear-gradient(90deg, rgba(0,200,150,0.025) 1px, transparent 1px);
  background-size: 40px 40px;
}
```

Scanlines:
```css
body::after {
  content: '';
  position: fixed; inset: 0; pointer-events: none; z-index: 9999;
  background: repeating-linear-gradient(
    0deg, transparent, transparent 2px,
    rgba(0,0,0,0.025) 2px, rgba(0,0,0,0.025) 4px
  );
}
```

CRT boot:
```css
@keyframes crtBoot {
  0%   { opacity: 0; }
  12%  { opacity: 0.6; }
  20%  { opacity: 0.1; }
  35%  { opacity: 0.8; }
  50%  { opacity: 0.2; }
  100% { opacity: 1; }
}
body { animation: crtBoot 1.4s ease-out forwards; }
```

Grid pulse on breach/critical:
```css
body.grid-pulse::before {
  background-image:
    linear-gradient(rgba(255,34,68,0.07) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,34,68,0.07) 1px, transparent 1px);
}
```

Add/remove `grid-pulse` class for 2 seconds on critical/breach events.
