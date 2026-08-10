'use client';

import { useCallback, useRef } from 'react';

type TrackPayload = {
  kind?: 'event' | 'feature' | 'page' | 'api';
  userId: string;
  eventName?: string;
  featureName?: string;
  action?: string;
  path?: string;
  endpoint?: string;
  method?: string;
  statusCode?: number;
  durationMs?: number;
  sessionId?: string;
  properties?: Record<string, string | number | boolean | null>;
};

/**
 * Fire-and-forget product analytics from the browser.
 * Never throws; never awaits on the hot path beyond kicking fetch.
 */
export function useTrackEvent(defaultUserId?: string) {
  const sessionRef = useRef<string>(
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `sess_${Date.now().toString(36)}`,
  );

  const track = useCallback(
    (payload: Omit<TrackPayload, 'userId'> & { userId?: string }) => {
      const userId = (payload.userId || defaultUserId || '').trim();
      if (!userId) return;
      const body = {
        ...payload,
        userId,
        sessionId: payload.sessionId || sessionRef.current,
      };
      void fetch('/api/aiva/analytics/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        keepalive: true,
      }).catch(() => undefined);
    },
    [defaultUserId],
  );

  const trackFeature = useCallback(
    (featureName: string, action = 'use', userId?: string) => {
      track({ kind: 'feature', featureName, action, userId });
    },
    [track],
  );

  const trackPage = useCallback(
    (path: string, userId?: string) => {
      track({ kind: 'page', path, userId });
    },
    [track],
  );

  return { track, trackFeature, trackPage, sessionId: sessionRef.current };
}
