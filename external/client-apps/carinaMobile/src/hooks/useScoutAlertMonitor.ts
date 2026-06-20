import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { fetchHostedScoutStatus } from '@/api/scout-hosted';
import type { ScoutSecurityEvent } from '@/api/types';
import { loadScoutAlertsEnabled } from '@/lib/notification-prefs';
import { notifyScoutEvent } from '@/lib/notifications';
import { shouldAlertForSeverity } from '@/lib/scout-alert';
import { useAuth } from '@/store/auth-store';

const SEEN_KEY = 'carina.scout.seenEvents';
const POLL_MS = 60_000;

async function loadSeenEventIds(): Promise<Set<string>> {
  const raw = await AsyncStorage.getItem(SEEN_KEY);
  if (!raw) return new Set();
  try {
    const parsed = JSON.parse(raw) as string[];
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

async function saveSeenEventIds(ids: Set<string>): Promise<void> {
  const trimmed = [...ids].slice(-200);
  await AsyncStorage.setItem(SEEN_KEY, JSON.stringify(trimmed));
}

function pickFreshAlerts(events: ScoutSecurityEvent[], seen: Set<string>): ScoutSecurityEvent[] {
  return events.filter(
    (event) => shouldAlertForSeverity(event.severity) && !seen.has(event.id),
  );
}

export function useScoutAlertMonitor(): void {
  const { instance, user } = useAuth();
  const seenRef = useRef<Set<string>>(new Set());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const poll = useCallback(async () => {
    if (instance?.mode !== 'cloud' || !instance.baseUrl || !user?.scoutActive) return;
    const scoutEnabled = await loadScoutAlertsEnabled();
    if (!scoutEnabled) return;

    try {
      const status = await fetchHostedScoutStatus(instance.baseUrl);
      const events = status.events ?? [];
      const fresh = pickFreshAlerts(events, seenRef.current);
      for (const event of fresh) {
        await notifyScoutEvent(event);
        seenRef.current.add(event.id);
      }
      if (fresh.length > 0) {
        await saveSeenEventIds(seenRef.current);
      }
    } catch {
      // trust tab handles visible errors
    }
  }, [instance?.baseUrl, instance?.mode, user?.scoutActive]);

  useEffect(() => {
    void (async () => {
      seenRef.current = await loadSeenEventIds();
    })();
  }, []);

  useEffect(() => {
    const startPolling = () => {
      if (timerRef.current) return;
      void poll();
      timerRef.current = setInterval(() => {
        void poll();
      }, POLL_MS);
    };

    const stopPolling = () => {
      if (!timerRef.current) return;
      clearInterval(timerRef.current);
      timerRef.current = null;
    };

    const handleState = (state: string) => {
      if (state === 'active') {
        stopPolling();
      } else {
        startPolling();
      }
    };

    handleState(AppState.currentState);
    const sub = AppState.addEventListener('change', handleState);
    return () => {
      sub.remove();
      stopPolling();
    };
  }, [poll]);
}
