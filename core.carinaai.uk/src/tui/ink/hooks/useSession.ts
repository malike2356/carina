import { useState, useEffect, useCallback } from 'react';
import { llm } from '../../../brain/llm.js';
import type { GatewayClient, SessionInfo } from '../transport/json-rpc.js';

export function useSession(client: GatewayClient, initialSessionId?: string) {
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [sessions, setSessions] = useState<SessionInfo[]>([]);

  const loadSessions = useCallback(async () => {
    try {
      const list = await client.call<SessionInfo[]>('sessions.list');
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
        const created = await client.call<SessionInfo>('session.create');
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
    await client.call('provider.switch', { provider, model });
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
