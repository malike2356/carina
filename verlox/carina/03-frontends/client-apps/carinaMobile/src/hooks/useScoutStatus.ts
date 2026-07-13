import { useEffect, useMemo, useState } from 'react';
import { fetchHostedScoutStatus } from '@/api/scout-hosted';
import type { ScoutStatus } from '@/components/ScoutStatusChip';
import { useAuth } from '@/store/auth-store';

export function useScoutStatus(): ScoutStatus {
  const { user, instance, gatewayAuth } = useAuth();
  const fallback = useMemo<ScoutStatus>(() => {
    if (!user) return 'unknown';
    return user.scoutActive ? 'active' : 'inactive';
  }, [user]);
  const [status, setStatus] = useState<ScoutStatus>(fallback);

  useEffect(() => {
    setStatus(fallback);
  }, [fallback]);

  useEffect(() => {
    if (!instance?.baseUrl || !user) return;
    let cancelled = false;
    void fetchHostedScoutStatus(instance.baseUrl, gatewayAuth ?? undefined)
      .then((result) => {
        if (cancelled) return;
        if (result.events?.some((event) => event.severity === 'critical' || event.severity === 'breach')) {
          setStatus('alert');
          return;
        }
        setStatus(result.active ? 'active' : 'inactive');
      })
      .catch(() => {
        if (!cancelled) setStatus(fallback);
      });
    return () => {
      cancelled = true;
    };
  }, [fallback, gatewayAuth, instance?.baseUrl, user]);

  return status;
}
