import { useState, useEffect, useCallback } from 'react';
import { llm } from '../../../brain/llm.js';
import type { SessionInfo, TuiRuntimeTransport } from '../../runtime-transport/types.js';

export function useSession(client: TuiRuntimeTransport, initialSessionId?: string) {
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [sessions, setSessions] = useState<SessionInfo[]>([]);

  const loadSessions = useCallback(async () => {
    try {
      const list = await client.listSessions();
      setSessions(list);
    } catch {
      setSessions([]);
    }
  }, [client]);

  useEffect(() => {
    void (async () => {
      if (initialSessionId) {
        setSession({
          id: initialSessionId,
          name: initialSessionId.slice(0, 12),
          model: llm.current().name,
          tokenCount: 0,
          messageCount: 0,
        });
        return;
      }
      try {
        const created = await client.createSession();
        setSession(created);
      } catch {
        setSession({
          id: `tui:${Date.now()}`,
          name: 'New session',
          model: llm.current().name,
          tokenCount: 0,
          messageCount: 0,
        });
      }
    })();
  }, [client, initialSessionId]);

  const switchProvider = useCallback(async (provider: string, model?: string) => {
    await client.switchProvider(provider, model);
    setSession((s) => (s ? { ...s, model: provider } : s));
  }, [client]);

  return {
    session,
    setSession,
    sessions,
    loadSessions,
    switchProvider,
  };
}
