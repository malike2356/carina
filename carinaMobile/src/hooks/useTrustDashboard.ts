import { useCallback, useEffect, useRef, useState } from 'react';
import {
  fetchHostedKillSwitchStatus,
  fetchHostedScoutStatus,
  triggerHostedKillSwitch,
} from '@/api/scout-hosted';
import { fetchPublicTrust } from '@/api/scout-trust';
import type {
  HostedScoutStatus,
  KillSwitchStatus,
  PublicTrustPayload,
  ScoutSecurityEvent,
} from '@/api/types';
import { DEFAULT_SCOUT_TRUST_URL } from '@/config/defaults';
import { useAuth } from '@/store/auth-store';

const POLL_MS = 60_000;

interface TrustDashboardState {
  loading: boolean;
  error: string | null;
  trust: PublicTrustPayload | null;
  scout: HostedScoutStatus | null;
  killSwitch: KillSwitchStatus | null;
  events: ScoutSecurityEvent[];
  lastUpdated: string | null;
}

export function useTrustDashboard() {
  const { instance, user } = useAuth();
  const [state, setState] = useState<TrustDashboardState>({
    loading: true,
    error: null,
    trust: null,
    scout: null,
    killSwitch: null,
    events: [],
    lastUpdated: null,
  });
  const [triggering, setTriggering] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const canUseKillSwitch =
    instance?.mode === 'cloud' && Boolean(user?.scoutActive || state.scout?.active);

  const refresh = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const trust = await fetchPublicTrust(DEFAULT_SCOUT_TRUST_URL);

      let scout: HostedScoutStatus | null = null;
      let killSwitch: KillSwitchStatus | null = null;
      let events: ScoutSecurityEvent[] = [];

      if (instance?.mode === 'cloud' && instance.baseUrl) {
        try {
          scout = await fetchHostedScoutStatus(instance.baseUrl);
          events = scout.events ?? [];
        } catch {
          scout = null;
        }

        if (scout?.active || user?.scoutActive) {
          try {
            killSwitch = await fetchHostedKillSwitchStatus(instance.baseUrl);
          } catch {
            killSwitch = null;
          }
        }
      }

      setState({
        loading: false,
        error: null,
        trust,
        scout,
        killSwitch,
        events,
        lastUpdated: new Date().toISOString(),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setState((prev) => ({
        ...prev,
        loading: false,
        error: msg,
      }));
    }
  }, [instance?.baseUrl, instance?.mode, user?.scoutActive]);

  const triggerKillSwitch = useCallback(
    async (reason: string) => {
      if (!instance?.baseUrl || !canUseKillSwitch) {
        throw new Error('Kill switch requires Carina Cloud with Scout');
      }
      setTriggering(true);
      try {
        await triggerHostedKillSwitch(instance.baseUrl, reason);
        await refresh();
      } finally {
        setTriggering(false);
      }
    },
    [canUseKillSwitch, instance?.baseUrl, refresh],
  );

  useEffect(() => {
    void refresh();
    timerRef.current = setInterval(() => {
      void refresh();
    }, POLL_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [refresh]);

  return {
    ...state,
    canUseKillSwitch,
    triggering,
    refresh,
    triggerKillSwitch,
  };
}
