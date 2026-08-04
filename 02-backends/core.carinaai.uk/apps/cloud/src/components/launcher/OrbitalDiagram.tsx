import { useSystemHealth } from '../../hooks/useSystemHealth';

const SATELLITES = [
  { id: 'memory',    label: 'Memory',    color: '#9b59f5', angle: 330 },
  { id: 'skills',    label: 'Skills',    color: '#f59e0b', angle: 30  },
  { id: 'scout',     label: 'Scout',     color: '#16c97e', angle: 90  },
  { id: 'channels',  label: 'Channels',  color: '#00d4ff', angle: 150 },
  { id: 'projects',  label: 'Projects',  color: '#3b82f6', angle: 210 },
  { id: 'voice',     label: 'Voice',     color: '#ec4899', angle: 270 },
];

const CX = 200;
const CY = 200;
const ORBIT_RADIUS = 130;
const SAT_RADIUS = 28;
const CENTER_RADIUS = 44;

interface Props {
  onSelectSection: (id: string) => void;
  version?: string;
}

export function OrbitalDiagram({ onSelectSection, version = '...' }: Props) {
  const { health } = useSystemHealth();

  return (
    <div className="orbital-wrap">
      <svg
        viewBox="0 0 400 400"
        className="orbital-svg"
        aria-label="Carina system overview"
      >
        {/* Dashed orbit ring */}
        <circle
          cx={CX} cy={CY} r={ORBIT_RADIUS}
          fill="none" stroke="#1a2b45" strokeWidth="1"
          strokeDasharray="4 6"
        />

        {/* Connector lines from center to each satellite */}
        {SATELLITES.map(s => {
          const rad = (s.angle * Math.PI) / 180;
          const sx = CX + ORBIT_RADIUS * Math.cos(rad);
          const sy = CY + ORBIT_RADIUS * Math.sin(rad);
          return (
            <line
              key={`line-${s.id}`}
              x1={CX} y1={CY} x2={sx} y2={sy}
              stroke={s.color} strokeWidth="1" strokeOpacity="0.35"
            />
          );
        })}

        {/* Core node */}
        <circle cx={CX} cy={CY} r={CENTER_RADIUS} fill="#0d1829" stroke="#00d4ff" strokeWidth="2" />
        <circle cx={CX} cy={CY} r={CENTER_RADIUS - 8} fill="none" stroke="#00d4ff" strokeWidth="0.5" strokeOpacity="0.4" />
        <image
          href="/logo/carina_logo_1.png"
          x={CX - 22} y={CY - 22} width="44" height="44"
        />

        {/* Satellite nodes */}
        {SATELLITES.map(s => {
          const rad = (s.angle * Math.PI) / 180;
          const sx = CX + ORBIT_RADIUS * Math.cos(rad);
          const sy = CY + ORBIT_RADIUS * Math.sin(rad);
          const labelR = ORBIT_RADIUS + 22;
          const lx = CX + labelR * Math.cos(rad);
          const ly = CY + labelR * Math.sin(rad);

          const sub = health?.subsystems?.find(sub => sub.id === s.id);
          const isHealthy = sub ? sub.healthPercent >= 80 : true;

          return (
            <g
              key={s.id}
              onClick={() => onSelectSection(s.id)}
              style={{ cursor: 'pointer' }}
            >
              {/* Outer glow ring */}
              <circle cx={sx} cy={sy} r={SAT_RADIUS + 5} fill="none" stroke={s.color} strokeWidth="0.5" strokeOpacity="0.2" />
              {/* Node circle */}
              <circle cx={sx} cy={sy} r={SAT_RADIUS} fill="#0d1829" stroke={s.color} strokeWidth="1.5" />
              {/* Inner color fill */}
              <circle cx={sx} cy={sy} r={SAT_RADIUS - 10} fill={s.color} fillOpacity="0.12" />
              {/* Health dot */}
              <circle
                cx={sx + SAT_RADIUS * 0.65}
                cy={sy - SAT_RADIUS * 0.65}
                r={5}
                fill={isHealthy ? '#16c97e' : '#ef4444'}
                stroke="#060c18"
                strokeWidth="1.5"
              />
              {/* Label */}
              <text
                x={lx} y={ly + 4}
                textAnchor="middle"
                fontSize="11"
                fill="#6b8aaa"
                fontFamily="Instrument Sans, system-ui, sans-serif"
              >
                {s.label}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="orbital-core-label">
        <span className="core-name">Carina Core</span>
        <span className="core-version">v{version}</span>
      </div>
    </div>
  );
}
