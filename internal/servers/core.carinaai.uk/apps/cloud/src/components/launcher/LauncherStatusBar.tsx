import { useSystemStatus } from '../../hooks/useSystemStatus';

export function LauncherStatusBar() {
  const { status } = useSystemStatus();
  const scoutOk = status?.scout?.ok ?? true;

  return (
    <div className="launcher-statusbar">
      <div className="status-item">
        <span className="status-dot" style={{ background: scoutOk ? '#16c97e' : '#ef4444', boxShadow: scoutOk ? '0 0 6px #16c97e' : 'none' }} />
        <span>Scout {scoutOk ? 'Protected' : 'Offline'}</span>
      </div>
      <div className="status-item">
        <LockIcon />
        <span>Encrypted</span>
      </div>
      <div className="status-item">
        <SyncIcon />
        <span>Synced</span>
      </div>
      <div className="status-item status-item-right">
        <span>v{status?.version ?? '...'}</span>
      </div>
    </div>
  );
}

function LockIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function SyncIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M23 4v6h-6" />
      <path d="M1 20v-6h6" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10" />
      <path d="M20.49 15a9 9 0 0 1-14.85 3.36L1 14" />
    </svg>
  );
}
