# Labyrinth Scout - Cinematic Security Dashboard Rebuild

**File to replace:** `console.labyrinthscout.com/public/dashboard.html`
**Type:** Single self-contained HTML file. No build step. No external JS frameworks.
**Goal:** A dramatic, cinematic, SOC (Security Operations Centre) style dashboard. Think Hollywood hacker room meets enterprise SIEM. Every second on this screen should feel like something is being watched.

---

## Aesthetic Reference

Dark navy base. Electric green for safe/active. Blood red for critical/breach. Amber/gold for warnings and branding. Cyan for info and data traces. Everything glows slightly. Scan lines visible on the background. The radar sweeps continuously whether events are happening or not - it never sleeps.

Colour palette (CSS variables):
```css
--void:       #020409; /* deepest background */
--navy:       #050c1a; /* panel background */
--navy-lift:  #0a1628; /* elevated surfaces */
--border:     rgba(0,200,150,0.12);
--glow-green: #00c896; /* active, safe, online */
--glow-red:   #ff2244; /* critical, breach */
--glow-amber: #d4af37; /* warning, brand */
--glow-cyan:  #00d4ff; /* info, data */
--glow-purple:#9b59ff; /* anomaly */
--text:       #8bafc0; /* body text */
--text-bright:#cce8f4; /* important text */
```

Font: `JetBrains Mono` for all data/numbers. `Inter` for labels. Both from Google Fonts CDN.

Background: `--void` base. Subtle scanline overlay (repeating horizontal lines at 2px intervals, 3% opacity). Very faint grid (40px, 2% opacity). No solid panels - only slightly lifted surfaces with a glow border.

---

## Layout (1280px max-width, full viewport height)

```
┌─────────────────────────────────────────────────────────────────────┐
│  HEADER: [LABYRINTH SCOUT] [LIVE ●] [instance: carina-local] [UTC] │
├─────────────────────────────┬───────────────────────────────────────┤
│                             │  STAT CARDS (4 across top)            │
│   RADAR SCANNER             │  [CRITICAL] [WARNING] [INFO] [BREACH]  │
│   (SVG, 400x400, animated)  ├───────────────────────────────────────┤
│                             │  EVENT FREQUENCY GRAPH                 │
│                             │  (Canvas, real-time EKG spikes)       │
├─────────────────────────────┼───────────────────────────────────────┤
│  LIVE EVENT STREAM          │  ANOMALY SCORE LINE CHART             │
│  (scrolling log)            │  (Canvas, Z-score over time)          │
│                             ├───────────────────────────────────────┤
│                             │  TOOL HEATMAP                         │
│                             │  (Canvas grid, intensity by colour)   │
├─────────────────────────────┴───────────────────────────────────────┤
│  INSTANCES BAR: [carina-local ● ACTIVE] [kill] [resume]            │
└─────────────────────────────────────────────────────────────────────┘
```

On screens below 1100px: stack everything vertically, radar moves to top.

---

## Component 1: Radar Scanner (SVG + JS)

The centrepiece. A circular radar scanner that rotates continuously at ~6 seconds per revolution. This is the most important visual element.

**Structure (SVG):**
- Outer circle: thin `--glow-green` stroke, slight glow
- Three concentric rings at 33%, 66%, 100% radius: faint `--border` stroke
- 8 compass lines (N/NE/E/SE/S/SW/W/NW): faint `--border` stroke
- Sweep line: a 60-degree arc from centre, filled with a radial gradient (bright `--glow-green` at the tip fading to transparent). Rotates via `requestAnimationFrame`.
- Threat dots: each security event creates a glowing dot on the radar. Position derived from `event.created_at` (angle) and `event.severity` (ring - critical=outer, info=inner). Dots fade out over ~8 seconds after appearing.
- When a critical/breach event arrives: the entire radar pulses red once (border flashes `--glow-red`, then returns to green over 2 seconds).

**Implementation:**
```javascript
// SVG namespace
const SVG_NS = 'http://www.w3.org/2000/svg';
const radar = document.getElementById('radar-svg');
const sweep = radar.querySelector('#sweep-arc');
let sweepAngle = 0;

function animateRadar(ts) {
  sweepAngle = (ts / 6000) * 360; // full rotation every 6s
  const rad = (sweepAngle - 90) * Math.PI / 180;
  // update sweep path: arc from centre at sweepAngle spanning -60deg
  sweep.setAttribute('d', buildArcPath(200, 200, 180, sweepAngle - 60, sweepAngle));
  requestAnimationFrame(animateRadar);
}
requestAnimationFrame(animateRadar);

function buildArcPath(cx, cy, r, startDeg, endDeg) {
  // Returns SVG path for a filled arc (pie slice) from centre
  const toRad = d => (d - 90) * Math.PI / 180;
  const x1 = cx + r * Math.cos(toRad(startDeg));
  const y1 = cy + r * Math.sin(toRad(startDeg));
  const x2 = cx + r * Math.cos(toRad(endDeg));
  const y2 = cy + r * Math.sin(toRad(endDeg));
  return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2} Z`;
}
```

The sweep fill: SVG `<defs>` radial gradient from `rgba(0,200,150,0.6)` at 80% radius to transparent. The leading edge (endDeg) is bright.

Threat dot placement:
```javascript
function addRadarDot(event) {
  const ring = { critical: 0.85, warning: 0.6, info: 0.35, breach: 0.95 }[event.severity] || 0.5;
  const angle = (Date.now() / 100) % 360; // place at current sweep position
  const r = 180 * ring;
  const x = 200 + r * Math.cos((angle - 90) * Math.PI / 180);
  const y = 200 + r * Math.sin((angle - 90) * Math.PI / 180);
  const colour = { critical: '#ff2244', warning: '#d4af37', info: '#00d4ff', breach: '#ff2244' }[event.severity];
  
  const circle = document.createElementNS(SVG_NS, 'circle');
  circle.setAttribute('cx', x); circle.setAttribute('cy', y);
  circle.setAttribute('r', 4); circle.setAttribute('fill', colour);
  circle.setAttribute('filter', 'url(#glow)');
  radar.appendChild(circle);
  
  // Fade and remove after 8s
  setTimeout(() => circle.remove(), 8000);
  circle.animate([{opacity:1},{opacity:0}], {duration:8000, fill:'forwards'});
}
```

SVG `<defs>` must include a `<filter id="glow">` with `feGaussianBlur stdDeviation="3"` and `feComposite` for the glow effect on dots.

---

## Component 2: Event Frequency Graph (Canvas 2D)

A real-time scrolling bar chart showing event frequency over the last 60 seconds. Looks like an EKG or audio waveform.

**Dimensions:** Full width of its container, 120px tall.

**Data:** An array of 60 buckets (one per second). Each bucket holds counts by severity. On each SSE event, increment the current bucket. Every second, push a new empty bucket and shift the oldest off.

**Rendering (60fps via requestAnimationFrame):**
```javascript
function drawFrequencyGraph(canvas, buckets) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  
  // Background
  ctx.fillStyle = '#0a1628';
  ctx.fillRect(0, 0, W, H);
  
  const barW = W / buckets.length;
  buckets.forEach((bucket, i) => {
    const total = bucket.critical * 4 + bucket.warning * 2 + bucket.info;
    const barH = Math.min(H - 4, (total / 20) * (H - 4));
    if (barH === 0) return;
    
    // Colour by dominant severity
    const colour = bucket.critical > 0 ? '#ff2244' :
                   bucket.warning > 0 ? '#d4af37' : '#00d4ff';
    
    ctx.fillStyle = colour;
    ctx.shadowColor = colour;
    ctx.shadowBlur = 8;
    ctx.fillRect(i * barW, H - barH, barW - 1, barH);
    ctx.shadowBlur = 0;
  });
  
  // Horizontal baseline
  ctx.strokeStyle = 'rgba(0,200,150,0.2)';
  ctx.beginPath(); ctx.moveTo(0, H-1); ctx.lineTo(W, H-1); ctx.stroke();
}
```

Animate at 10fps (setInterval 100ms) to avoid perf issues.

---

## Component 3: Anomaly Score Line Chart (Canvas 2D)

Shows Z-score anomaly values over the last 10 minutes. Like a seismograph. When Z-score exceeds 3.0, the line turns red and spikes dramatically.

**Dimensions:** Full width, 160px tall.

**Data:** Poll `GET /api/anomalies/recent?limit=100` every 15 seconds. Extrapolate into a time-series.

**Rendering:**
- Background grid: faint horizontal lines at y=25%, 50%, 75%, labelled "1.0", "2.0", "3.0" Z-score
- Threshold line at Z=3.0: dashed `--glow-red` with label "ANOMALY THRESHOLD"
- Main line: smooth bezier curve. Below threshold: `--glow-cyan`. Above threshold: `--glow-red` with glow effect
- Fill area under the line: gradient from line colour to transparent

**Implementation:**
```javascript
function drawAnomalyChart(canvas, points) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const MAX_Z = 6;
  
  ctx.clearRect(0, 0, W, H);
  
  // Grid lines
  [1, 2, 3, 4, 5].forEach(z => {
    const y = H - (z / MAX_Z) * H;
    ctx.strokeStyle = z === 3 ? 'rgba(255,34,68,0.4)' : 'rgba(0,200,150,0.08)';
    ctx.setLineDash(z === 3 ? [4,4] : []);
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    ctx.setLineDash([]);
  });
  
  if (points.length < 2) return;
  
  // Draw line
  ctx.beginPath();
  points.forEach((pt, i) => {
    const x = (i / (points.length - 1)) * W;
    const y = H - Math.min(pt.z_score / MAX_Z, 1) * H;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  
  ctx.strokeStyle = points.some(p => p.z_score > 3) ? '#ff2244' : '#00d4ff';
  ctx.lineWidth = 2;
  ctx.shadowColor = ctx.strokeStyle;
  ctx.shadowBlur = 10;
  ctx.stroke();
}
```

---

## Component 4: Tool Usage Heatmap (Canvas 2D)

A grid showing tool call intensity over the last 24 hours. X-axis = hour of day (0-23). Y-axis = tool name. Cell colour = call count intensity.

**Tools on Y-axis:** web-search, file-read, file-write, http-request, email-send, code-exec, shell-exec

**Colour scale:** 0=`#0a1628` (empty), low=`#0d3a4f`, medium=`#006680`, high=`#00c896`, max=`#00ffc8`

**Rendering:**
```javascript
function drawHeatmap(canvas, data) {
  // data: { [toolName]: [hourlyCount x 24] }
  const tools = ['web-search','file-read','file-write','http-request','email-send','code-exec','shell-exec'];
  const W = canvas.width, H = canvas.height;
  const cellW = (W - 80) / 24;
  const cellH = (H - 20) / tools.length;
  
  tools.forEach((tool, row) => {
    for (let hour = 0; hour < 24; hour++) {
      const count = data[tool]?.[hour] || 0;
      const max = Math.max(...Object.values(data).flat(), 1);
      const intensity = count / max;
      
      const r = Math.round(10 + intensity * 0);
      const g = Math.round(26 + intensity * 200);
      const b = Math.round(40 + intensity * 150);
      
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(80 + hour * cellW + 1, row * cellH + 1, cellW - 2, cellH - 2);
    }
    // Tool label
    ctx.fillStyle = '#8bafc0';
    ctx.font = '9px JetBrains Mono';
    ctx.fillText(tool, 0, row * cellH + cellH/2 + 3);
  });
}
```

---

## Component 5: Live Event Stream

Scrolling log. Maximum 100 entries in DOM. New events prepend with a flash animation.

Each row:
```
[HH:MM:SS] [CRITICAL] injection_blocked | ignore previous instructions... [carina-local]
```

Row styling by severity:
- `breach`: background `rgba(255,34,68,0.08)`, left border `#ff2244`, full row blinks once
- `critical`: background `rgba(255,34,68,0.05)`, left border `#ff2244`
- `warning`: left border `#d4af37`
- `info`: left border `rgba(0,212,255,0.4)`

On new event: row slides in from top with opacity 0→1 over 300ms. Previous rows push down.

---

## SSE Connection

```javascript
const ES = new EventSource('/api/stream');
ES.onmessage = e => {
  const msg = JSON.parse(e.data);
  if (msg.type === 'event')    handleEvent(msg.data);
  if (msg.type === 'stats')    updateStatCards(msg.data);
  if (msg.type === 'heartbeat') updateConnectionDot(true);
};
ES.onerror = () => updateConnectionDot(false);
```

On `handleEvent(event)`:
1. Prepend to event stream DOM
2. Call `addRadarDot(event)`
3. Increment current frequency bucket
4. If `severity === 'critical' || 'breach'`: flash the radar ring red, flash the background grid red pulse (add class `grid-pulse` to body for 2s)
5. Show a toast notification top-right

---

## Stat Cards (top row, 4 cards)

Large number, severity label, 24h trend arrow. Minimal - just the number in a glowing colour.

```
┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│           │ │           │ │           │ │            │
│     12      │ │      7      │ │     143     │ │      0      │
│  CRITICAL   │ │   WARNING   │ │    INFO     │ │   BREACH    │
│  ▲3 today   │ │  ▼1 today   │ │  ▲22 today  │ │             │
└─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘
```

Numbers animate via counter (count up from previous value to new value over 500ms).

---

## Instance Bar (bottom)

Fixed to bottom of viewport. Dark strip.

```
INSTANCES  ●  carina-local  ACTIVE  last seen: 3s ago  [KILL]  [RESUME]
```

- Green dot for active, red for suspended, grey for offline
- "Last seen: Xs ago" updates every second
- KILL button: confirmation modal before posting to `/api/kill/:id`. Modal has blood-red border, explanation of consequences.
- RESUME button: shown only for suspended instances

---

## Polish Details

1. **Scanlines overlay**: `body::after` with repeating horizontal lines at 2px intervals, 3% opacity. Fixed position.

2. **Screen flicker on boot**: CSS animation that reduces opacity from 0→1 with two brief interruptions over 1.2s, like a CRT monitor warming up.

3. **Timestamp in header**: live UTC clock updating every second. Format: `2026-06-04 14:23:07 UTC`

4. **"SCOUT KEY" injected**: server replaces `<!-- __SCOUT_KEY_INJECTION__ -->` with `<script>window.__SCOUT_KEY = 'sk-...'</script>`. All API calls use this key in `X-Scout-Key` header.

5. **Toast notifications**: slide in from top-right. Colour-coded by severity. Auto-dismiss after 4s. Max 3 visible at once.

6. **Kill modal**: full-screen overlay, dark red glow, requires typing "KILL" to confirm. Not just a click.

7. **No external JS libraries** except Google Fonts. All charts, animations and radar in vanilla Canvas 2D + SVG.

---

## File structure

Just one file: `public/dashboard.html`

All CSS in `<style>`, all JS in `<script>` at bottom. The file will be large (~1000 lines). That is fine. This is an operational tool, not a website.

---

## API Calls

All authenticated with `X-Scout-Key: window.__SCOUT_KEY` header.

- `GET /api/status` - instances + 24h stats. Call on load and every 30s.
- `GET /api/anomalies/recent?limit=200` - anomaly score data. Call on load and every 15s.
- `GET /api/stream` - SSE for live events (no auth header needed).
- `POST /api/kill/:id` body `{reason:"string"}` - kill switch.
- `POST /api/resume/:id` - resume.
- `POST /api/heartbeat` - NOT called from dashboard (that's Carina's job).

---

## What the current dashboard is missing

The current `public/dashboard.html` has:
- Static CSS dots and basic event stream
- A `#tool-chart` div with no actual chart implementation
- No canvas elements
- No radar scanner
- No line charts
- No heatmap

**Replace the entire file.** Keep only the `<!-- __SCOUT_KEY_INJECTION__ -->` comment in the `<head>` (server injects the API key there).
