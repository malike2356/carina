import { useEffect, useState } from 'react';
import type { SystemStatus } from '../lib/types/launcher';

export function useSystemStatus() {
  const [status, setStatus] = useState<SystemStatus | null>(null);

  useEffect(() => {
    const load = () =>
      fetch('/api/cloud/launcher/system/status', {
        headers: { Authorization: `Bearer ${localStorage.getItem('carina_cloud_token') ?? ''}` },
      })
        .then(r => r.json())
        .then((d: SystemStatus) => setStatus(d))
        .catch(() => {});
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, []);

  return { status };
}
