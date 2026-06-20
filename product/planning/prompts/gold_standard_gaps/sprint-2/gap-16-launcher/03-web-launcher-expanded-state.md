# Prompt 03: Web Launcher - Expanded (Full Dashboard) State

## Reference

Design: `03-launcher_side_expanded_full.png`

## Context

The expanded state is the "full dashboard" view reached when the user clicks "View all
projects" or navigates to `/workspaces`. It shows a full-width two-panel layout:
- Left: the same sidebar from prompt-02
- Right: the Carina system status orbital diagram + a system health panel

This is also the view shown to first-time users who have no recent projects yet.

## What to Build

### 1. Expanded layout wrapper

Extend `LauncherWithSidebar` to accept an `expanded` prop that changes the content area
to full-width split view:
```tsx
export function LauncherExpanded({ activePath, onNavigate }) {
  return (
    <LauncherWithSidebar activePath={activePath} onNavigate={onNavigate}>
      <div className="launcher-expanded-content">
        <OrbitalDiagram />
        <SystemStatusPanel />
      </div>
    </LauncherWithSidebar>
  );
}
```

CSS:
```css
.launcher-expanded-content {
  display: grid;
  grid-template-columns: 1fr 340px;
  width: 100%;
  height: 100%;
  overflow: hidden;
}
```

### 2. Orbital diagram - center piece

The orbital diagram renders the Carina Core node in the center with 6 satellite nodes
arranged in a circle. Each satellite represents a major Carina subsystem.

File: `apps/cloud/src/components/launcher/OrbitalDiagram.tsx`

```tsx
const SATELLITES = [
  { id: 'memory',    label: 'Memory',    color: '#9b59f5', angle: 330, icon: 'Brain'     },
  { id: 'skills',    label: 'Skills',    color: '#f59e0b', angle: 30,  icon: 'Zap'       },
  { id: 'scout',     label: 'Scout',     color: '#16c97e', angle: 90,  icon: 'Shield'    },
  { id: 'channels',  label: 'Channels',  color: '#00d4ff', angle: 150, icon: 'MessageSquare' },
  { id: 'projects',  label: 'Projects',  color: '#3b82f6', angle: 210, icon: 'FolderOpen' },
  { id: 'voice',     label: 'Voice',     color: '#ec4899', angle: 270, icon: 'Mic'       },
];

const CENTER_RADIUS = 44; // px, core node radius
const ORBIT_RADIUS  = 130; // px, satellite orbit
const SAT_RADIUS    = 28; // px, satellite node radius
const VIEWBOX       = 400; // SVG viewBox dimension (square)
const CX            = VIEWBOX / 2;
const CY            = VIEWBOX / 2;

export function OrbitalDiagram({ onSelectSection }) {
  const { status } = useSystemStatus();

  return (
    <div className="orbital-wrap">
      <svg
        viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}
        className="orbital-svg"
        aria-label="Carina system overview"
      >
        {/* Orbit circle */}
        <circle
          cx={CX} cy={CY} r={ORBIT_RADIUS}
          fill="none" stroke="#1a2b45" strokeWidth="1"
          strokeDasharray="4 6"
        />

        {/* Satellite connector lines */}
        {SATELLITES.map(s => {
          const rad = (s.angle * Math.PI) / 180;
          const sx = CX + ORBIT_RADIUS * Math.cos(rad);
          const sy = CY + ORBIT_RADIUS * Math.sin(rad);
          return (
            <line
              key={s.id}
              x1={CX} y1={CY} x2={sx} y2={sy}
              stroke={s.color} strokeWidth="1" strokeOpacity="0.35"
            />
          );
        })}

        {/* Core node */}
        <circle
          cx={CX} cy={CY} r={CENTER_RADIUS}
          fill="#0d1829" stroke="#00d4ff" strokeWidth="2"
        />
        {/* Core inner glow ring */}
        <circle
          cx={CX} cy={CY} r={CENTER_RADIUS - 8}
          fill="none" stroke="#00d4ff" strokeWidth="0.5" strokeOpacity="0.4"
        />
        <image
          href="/logo/carina_logo_1.png"
          x={CX - 22} y={CY - 22} width="44" height="44"
          style={{ imageRendering: 'crisp-edges' }}
        />

        {/* Satellite nodes */}
        {SATELLITES.map(s => {
          const rad = (s.angle * Math.PI) / 180;
          const sx = CX + ORBIT_RADIUS * Math.cos(rad);
          const sy = CY + ORBIT_RADIUS * Math.sin(rad);
          const labelOffset = 18;
          const lx = CX + (ORBIT_RADIUS + labelOffset) * Math.cos(rad);
          const ly = CY + (ORBIT_RADIUS + labelOffset) * Math.sin(rad);
          const active = status[s.id]?.active ?? true;
          return (
            <g key={s.id} onClick={() => onSelectSection(s.id)} style={{ cursor: 'pointer' }}>
              <circle cx={sx} cy={sy} r={SAT_RADIUS} fill="#0d1829" stroke={s.color} strokeWidth="1.5" />
              <circle cx={sx} cy={sy} r={SAT_RADIUS + 4} fill="none"
                stroke={s.color} strokeWidth="0.5" strokeOpacity="0.25" />
              {/* Icon placeholder - replace with actual icon SVG path */}
              <circle cx={sx} cy={sy} r={10} fill={s.color} fillOpacity="0.15" />
              {/* Active status dot */}
              {active && (
                <circle cx={sx + SAT_RADIUS * 0.65} cy={sy - SAT_RADIUS * 0.65}
                  r={5} fill="#16c97e" stroke="#060c18" strokeWidth="1.5" />
              )}
              {/* Label */}
              <text
                x={lx} y={ly + 5}
                textAnchor="middle"
                fontSize="11"
                fill="#6b8aaa"
                fontFamily="Inter, system-ui, sans-serif"
              >
                {s.label}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="orbital-core-label">
        <span className="core-name">Carina Core</span>
        <span className="core-version">v{status.version}</span>
      </div>
    </div>
  );
}
```

CSS:
```css
.orbital-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 48px;
}

.orbital-svg {
  width: min(400px, 100%);
  height: auto;
  overflow: visible;
}

.core-name {
  font-size: 13px;
  font-weight: 600;
  color: #e8f0f8;
}

.core-version {
  font-size: 11px;
  color: #4a6a8a;
  margin-left: 8px;
}
```

### 3. System status panel (right column)

Shows 6 health bars, one per subsystem, each with a fill percentage matching live data.

File: `apps/cloud/src/components/launcher/SystemStatusPanel.tsx`

```tsx
export function SystemStatusPanel() {
  const { health } = useSystemHealth();

  return (
    <div className="system-status-panel">
      <div className="status-panel-header">
        <span className="status-panel-title">SYSTEM STATUS</span>
        <span className="health-score">{health.overallPercent}%</span>
      </div>

      <div className="health-bars">
        {health.subsystems.map(sub => (
          <HealthBar key={sub.id} subsystem={sub} />
        ))}
      </div>

      <div className="status-panel-footer">
        <div className="status-footer-row">
          <span>Active sessions</span>
          <span className="status-val">{health.activeSessions}</span>
        </div>
        <div className="status-footer-row">
          <span>Memory store</span>
          <span className="status-val">{health.memoryCount} records</span>
        </div>
        <div className="status-footer-row">
          <span>Skills loaded</span>
          <span className="status-val">{health.skillsLoaded}</span>
        </div>
        <div className="status-footer-row">
          <span>Scout last scan</span>
          <span className="status-val">{health.scoutLastScanAgo}</span>
        </div>
      </div>
    </div>
  );
}

function HealthBar({ subsystem }) {
  const pct = Math.min(100, Math.max(0, subsystem.healthPercent));
  const color = pct === 100 ? '#16c97e' : pct > 60 ? '#f59e0b' : '#ef4444';
  return (
    <div className="health-bar-row">
      <span className="health-bar-label">{subsystem.label}</span>
      <div className="health-bar-track">
        <div className="health-bar-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="health-bar-pct" style={{ color }}>{pct}%</span>
    </div>
  );
}
```

CSS:
```css
.system-status-panel {
  background: #0d1829;
  border-left: 1px solid #1a2b45;
  display: flex;
  flex-direction: column;
  gap: 24px;
  padding: 32px 24px;
  overflow-y: auto;
}

.status-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.status-panel-title {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.14em;
  color: #4a6a8a;
  text-transform: uppercase;
}

.health-score {
  font-size: 28px;
  font-weight: 700;
  color: #16c97e;
  line-height: 1;
}

.health-bars { display: flex; flex-direction: column; gap: 14px; }

.health-bar-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.health-bar-label {
  font-size: 12px;
  color: #6b8aaa;
  width: 72px;
  flex-shrink: 0;
}

.health-bar-track {
  flex: 1;
  height: 6px;
  background: #1a2b45;
  border-radius: 3px;
  overflow: hidden;
}

.health-bar-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.6s ease;
}

.health-bar-pct {
  font-size: 11px;
  font-weight: 600;
  width: 34px;
  text-align: right;
  flex-shrink: 0;
}

.status-panel-footer {
  border-top: 1px solid #1a2b45;
  padding-top: 20px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.status-footer-row {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: #6b8aaa;
}

.status-val { color: #e8f0f8; font-weight: 500; }
```

### 4. Health data model

```ts
// apps/cloud/src/hooks/useSystemHealth.ts
export interface SubsystemHealth {
  id: string;
  label: string;
  healthPercent: number;
}

export interface SystemHealth {
  overallPercent: number;
  subsystems: SubsystemHealth[];
  activeSessions: number;
  memoryCount: number;
  skillsLoaded: number;
  scoutLastScanAgo: string;
}

export function useSystemHealth() {
  const [health, setHealth] = useState<SystemHealth | null>(null);

  useEffect(() => {
    async function load() {
      const res = await fetch('/api/system/health');
      const data = await res.json();
      setHealth(data);
    }
    load();
    const interval = setInterval(load, 30_000);
    return () => clearInterval(interval);
  }, []);

  return { health };
}
```

API endpoint to add: `GET /api/system/health` in `apps/cloud/src/server.ts`
returning:
```json
{
  "overallPercent": 100,
  "subsystems": [
    { "id": "memory",   "label": "Memory",   "healthPercent": 100 },
    { "id": "skills",   "label": "Skills",   "healthPercent": 100 },
    { "id": "scout",    "label": "Scout",    "healthPercent": 100 },
    { "id": "channels", "label": "Channels", "healthPercent": 100 },
    { "id": "projects", "label": "Projects", "healthPercent": 100 },
    { "id": "voice",    "label": "Voice",    "healthPercent": 100 }
  ],
  "activeSessions": 1,
  "memoryCount": 248,
  "skillsLoaded": 12,
  "scoutLastScanAgo": "2 min ago"
}
```

### 5. Navigation: when to show expanded state

Render `LauncherExpanded` when:
- `activePath === '/workspaces'`
- First-time user (no projects exist yet)

```tsx
// In the launcher state machine in App.tsx
const LauncherView = () => {
  const [activePath, setActivePath] = useState('/launcher');
  const { mode } = useLauncherMode();

  if (mode === 'primary') return <LauncherPrimary ... />;

  if (activePath === '/workspaces' || firstTimeUser) {
    return <LauncherExpanded activePath={activePath} onNavigate={setActivePath} />;
  }

  return (
    <LauncherWithSidebar activePath={activePath} onNavigate={setActivePath}>
      <LauncherHomeContent ... />
    </LauncherWithSidebar>
  );
};
```

## Verification Checklist

- [ ] Orbital SVG renders at correct size (400x400 viewBox, responsive)
- [ ] All 6 satellite nodes have correct colors from design tokens
- [ ] Satellite label text is readable against dark background
- [ ] Health bars animate from 0% to actual value on mount
- [ ] Overall health percentage shows in green (#16c97e)
- [ ] Health bars turn amber below 60%, red below 30%
- [ ] Status panel footer shows live session/memory/skills counts
- [ ] Clicking a satellite node navigates to that section (e.g., /memory, /scout)
- [ ] Expanded view triggered when navigating to /workspaces from sidebar

## Files to Create or Modify

- CREATE `apps/cloud/src/components/launcher/LauncherExpanded.tsx`
- CREATE `apps/cloud/src/components/launcher/OrbitalDiagram.tsx`
- CREATE `apps/cloud/src/components/launcher/SystemStatusPanel.tsx`
- CREATE `apps/cloud/src/hooks/useSystemHealth.ts`
- MODIFY `apps/cloud/src/server.ts` - add GET /api/system/health endpoint
- MODIFY `apps/cloud/src/launcher.css` - add orbital + status panel CSS
- MODIFY `apps/cloud/src/App.tsx` - render LauncherExpanded for /workspaces route
