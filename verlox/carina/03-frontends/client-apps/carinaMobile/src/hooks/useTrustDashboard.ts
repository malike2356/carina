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
  scoutError: string | null;
  trust: PublicTrustPayload | null;
  scout: HostedScoutStatus | null;
  killSwitch: KillSwitchStatus | null;
  events: ScoutSecurityEvent[];
  lastUpdated: string | null;
}

export function useTrustDashboard() {
  const { instance, user, gatewayAuth } = useAuth();
  const [state, setState] = useState<TrustDashboardState>({
    loading: true,
    error: null,
    scoutError: null,
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
    setState((prev) => ({ ...prev, loading: true, error: null, scoutError: null }));

    try {
      const trust = await fetchPublicTrust(DEFAULT_SCOUT_TRUST_URL);

      let scout: HostedScoutStatus | null = null;
      let killSwitch: KillSwitchStatus | null = null;
      let events: ScoutSecurityEvent[] = [];
      let scoutError: string | null = null;

      if (instance?.mode === 'cloud' && instance.baseUrl && user) {
        try {
          scout = await fetchHostedScoutStatus(instance.baseUrl, gatewayAuth ?? undefined);
          events = scout.events ?? [];
        } catch (err) {
          scout = null;
          scoutError = err instanceof Error ? err.message : String(err);
        }

        if (scout?.active || user?.scoutActive) {
          try {
            killSwitch = await fetchHostedKillSwitchStatus(
              instance.baseUrl,
              gatewayAuth ?? undefined,
            );
          } catch (err) {
            killSwitch = null;
            const msg = err instanceof Error ? err.message : String(err);
            scoutError = scoutError ? `${scoutError}; kill switch: ${msg}` : msg;
          }
        }
      }

      setState({
        loading: false,
        error: null,
        scoutError,
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
  }, [gatewayAuth, instance?.baseUrl, instance?.mode, user, user?.scoutActive]);

  const triggerKillSwitch = useCallback(
    async (reason: string) => {
      if (!instance?.baseUrl || !canUseKillSwitch) {
        throw new Error('Kill switch requires Carina Cloud with Scout');
      }
      setTriggering(true);
      try {
        await triggerHostedKillSwitch(instance.baseUrl, reason, gatewayAuth ?? undefined);
        await refresh();
      } finally {
        setTriggering(false);
      }
    },
    [canUseKillSwitch, gatewayAuth, instance?.baseUrl, refresh],
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
