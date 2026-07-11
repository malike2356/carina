import { useCallback } from 'react';
import type { SessionPrefs } from '@/api/types';
import { updateSessionPrefs } from '@/lib/session-registry';
import { loadSessionPrefs, saveSessionPrefs } from '@/lib/session-prefs';

export function useSessionActions(onChanged: () => Promise<void>) {
  const renameSession = useCallback(
    async (sessionId: string, customTitle: string) => {
      const existing = await loadSessionPrefs(sessionId);
      const prefs = await saveSessionPrefs(sessionId, { ...existing, customTitle });
      await updateSessionPrefs(sessionId, prefs);
      await onChanged();
    },
    [onChanged],
  );

  const togglePin = useCallback(
    async (sessionId: string, pinned: boolean) => {
      const existing = await loadSessionPrefs(sessionId);
      const prefs: SessionPrefs = {
        ...existing,
        pinned,
        pinnedAt: pinned ? new Date().toISOString() : undefined,
      };
      await saveSessionPrefs(sessionId, prefs);
      await updateSessionPrefs(sessionId, prefs);
      await onChanged();
    },
    [onChanged],
  );

  return { renameSession, togglePin };
}
