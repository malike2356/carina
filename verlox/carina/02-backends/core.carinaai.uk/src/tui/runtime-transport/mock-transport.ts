import type {
  ModelInfo,
  RuntimeEvent,
  RuntimeSnapshot,
  RuntimeToolSummary,
  RuntimeUsageSummary,
  SessionInfo,
  StreamChatHandlers,
  TuiRuntimeTransport,
} from './types.js';

export function createMockTransport(seed: Partial<{
  sessions: SessionInfo[];
  models: ModelInfo[];
  tools: RuntimeToolSummary[];
}> = {}): TuiRuntimeTransport {
  const listeners = new Set<(event: RuntimeEvent) => void>();
  const sessions = seed.sessions ?? [{
    id: 'mock-session',
    name: 'Mock session',
    model: 'mock',
    tokenCount: 0,
    messageCount: 0,
  }];
  let activeSession = sessions[0]!;
  const models = seed.models ?? [{
    id: 'mock/model',
    provider: 'mock',
    displayName: 'Mock model',
    costPer1k: '$0/1K',
    group: 'Local',
    configured: true,
  }];

  const emit = (event: RuntimeEvent) => {
    for (const listener of listeners) listener(event);
  };

  return {
    mode: 'mock',
    healthCheck: async () => true,
    createSession: async () => {
      const session = {
        id: `mock-${sessions.length + 1}`,
        name: 'Mock session',
        model: activeSession.model,
        tokenCount: 0,
        messageCount: 0,
      };
      sessions.push(session);
      activeSession = session;
      emit({ type: 'session', at: new Date().toISOString(), sessionId: session.id, message: 'Session created' });
      return session;
    },
    listSessions: async () => sessions,
    switchSession: async (sessionId: string) => {
      activeSession = sessions.find((session) => session.id === sessionId) ?? activeSession;
      emit({ type: 'session', at: new Date().toISOString(), sessionId: activeSession.id, message: 'Session switched' });
      return activeSession;
    },
    streamChat: async (sessionId: string, message: string, handlers: StreamChatHandlers) => {
      emit({ type: 'stream', at: new Date().toISOString(), sessionId, message: 'Stream started' });
      handlers.onToken(`Mock reply: ${message}`);
      handlers.onDone();
    },
    interrupt: async (sessionId: string) => {
      emit({ type: 'interrupt', at: new Date().toISOString(), sessionId, message: 'Turn interrupted' });
    },
    sendSteer: async (sessionId: string, message: string) => {
      emit({ type: 'stream', at: new Date().toISOString(), sessionId, message });
    },
    getRuntimeSnapshot: async (): Promise<RuntimeSnapshot> => ({
      mode: 'mock',
      healthy: true,
      activeSessionId: activeSession.id,
      activeModel: activeSession.model,
      queuedEvents: 0,
    }),
    subscribeRuntimeEvents: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    resolveApproval: async (approvalId: string, approved: boolean) => {
      emit({
        type: 'approval',
        at: new Date().toISOString(),
        sessionId: activeSession.id,
        message: approved ? 'Approval granted' : 'Approval denied',
        metadata: { approvalId },
      });
    },
    listTools: async () => seed.tools ?? [],
    getUsage: async (): Promise<RuntimeUsageSummary> => ({ tokens: activeSession.tokenCount }),
    listModels: async () => models,
    switchProvider: async (provider: string) => {
      activeSession = { ...activeSession, model: provider };
    },
    call: async <T>(method: string, params?: unknown): Promise<T> => {
      if (method === 'session.create') return await (await Promise.resolve(activeSession)) as T;
      if (method === 'sessions.list') return sessions as T;
      if (method === 'models.list') return models as T;
      if (method === 'provider.switch') {
        const next = params as { provider?: string };
        if (next.provider) activeSession = { ...activeSession, model: next.provider };
        return { ok: true } as T;
      }
      throw new Error(`Mock method unavailable: ${method}`);
    },
  };
}
