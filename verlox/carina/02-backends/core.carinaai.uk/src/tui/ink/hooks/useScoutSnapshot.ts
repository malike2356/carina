import { useEffect, useState } from 'react';
import { buildScoutSnapshot, type ScoutPanelSnapshot } from '../../panels/scout-panel.js';

export function useScoutSnapshot(enabled: boolean, intervalMs = 3000): ScoutPanelSnapshot {
  const [snapshot, setSnapshot] = useState<ScoutPanelSnapshot>(() => buildScoutSnapshot());

  useEffect(() => {
    if (!enabled) return undefined;
    setSnapshot(buildScoutSnapshot());
    const timer = setInterval(() => setSnapshot(buildScoutSnapshot()), intervalMs);
    return () => clearInterval(timer);
  }, [enabled, intervalMs]);

  return snapshot;
}
