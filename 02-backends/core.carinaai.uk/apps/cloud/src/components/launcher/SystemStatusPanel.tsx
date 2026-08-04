import { useSystemHealth } from '../../hooks/useSystemHealth';

export function SystemStatusPanel() {
  const { health } = useSystemHealth();

  if (!health) {
    return (
      <div className="system-status-panel">
        <div className="status-panel-header">
          <span className="status-panel-title">SYSTEM STATUS</span>
          <span className="health-score" style={{ fontSize: 18, color: '#4a6a8a' }}>...</span>
        </div>
        <div className="health-bars">
          {[0, 1, 2, 3, 4, 5].map(i => (
            <div key={i} className="health-bar-row">
              <div className="skeleton health-bar-label" style={{ height: 10, width: 60 }} />
              <div className="health-bar-track" style={{ flex: 1 }}>
                <div className="skeleton" style={{ height: '100%', width: '100%' }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="system-status-panel">
      <div className="status-panel-header">
        <span className="status-panel-title">SYSTEM STATUS</span>
        <span className="health-score">{health.overallPercent}%</span>
      </div>

      <div className="health-bars">
        {health.subsystems.map(sub => <HealthBar key={sub.id} label={sub.label} percent={sub.healthPercent} />)}
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

function HealthBar({ label, percent }: { label: string; percent: number }) {
  const pct = Math.min(100, Math.max(0, percent));
  const color = pct === 100 ? '#16c97e' : pct > 60 ? '#f59e0b' : '#ef4444';
  return (
    <div className="health-bar-row">
      <span className="health-bar-label">{label}</span>
      <div className="health-bar-track">
        <div className="health-bar-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="health-bar-pct" style={{ color }}>{pct}%</span>
    </div>
  );
}
