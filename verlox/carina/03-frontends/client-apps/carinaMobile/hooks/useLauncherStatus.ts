import { useEffect, useState } from 'react';
import { useAuth } from '@/store/auth-store';

interface LauncherStatus {
  scoutProtected: boolean;
  version: string;
}

export function useLauncherStatus() {
  const { instance } = useAuth();
  const [status, setStatus] = useState<LauncherStatus>({
    scoutProtected: false,
    version: 'Carina',
  });

  useEffect(() => {
    if (!instance?.baseUrl) return;

    const token = (instance as { token?: string }).token ?? '';
    fetch(`${instance.baseUrl}/api/cloud/launcher/system/status`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { scout?: { ok?: boolean }; version?: string } | null) => {
        if (!data) return;
        setStatus({
          scoutProtected: Boolean(data.scout?.ok),
          version: data.version ?? 'Carina',
        });
      })
      .catch(() => undefined);
  }, [instance]);

  return status;
}
