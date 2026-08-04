import { useEffect, useState } from 'react';
import type { SystemHealth } from '../lib/types/launcher';

export function useSystemHealth() {
  const [health, setHealth] = useState<SystemHealth | null>(null);

  useEffect(() => {
    const load = () =>
      fetch('/api/cloud/launcher/system/health', {
        headers: { Authorization: `Bearer ${localStorage.getItem('carina_cloud_token') ?? ''}` },
      })
        .then(r => r.json())
        .then((d: SystemHealth) => setHealth(d))
        .catch(() => {});
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, []);

  return { health };
}
