import { useEffect } from 'react';
import { useStore } from '@nanostores/react';
import { emit } from '@tauri-apps/api/event';
import { $currentSessionId, $sessions } from '../store/session.js';
import { $isStreaming } from '../store/chat.js';

export function useTraySync(hasError = false): void {
  const sessions = useStore($sessions);
  const currentId = useStore($currentSessionId);
  const isStreaming = useStore($isStreaming);

  useEffect(() => {
    const session = sessions.find((item) => item.sessionId === currentId);
    const sessionName = session?.title ?? (currentId ? currentId.slice(0, 12) : 'None');
    void emit('tray-state-change', {
      sessionName,
      busy: isStreaming,
      error: hasError,
    }).catch(() => {
      // Browser dev mode.
    });
  }, [sessions, currentId, isStreaming, hasError]);
}
