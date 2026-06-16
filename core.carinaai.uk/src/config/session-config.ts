export type SessionConfigOverrides = {
  maxTurns?: number;
  iterationBudget?: number;
  provider?: string;
  model?: string;
  blockExpensiveModels?: boolean;
};

const sessionOverrides = new Map<string, SessionConfigOverrides>();

export function setSessionConfig(sessionId: string, overrides: SessionConfigOverrides): void {
  sessionOverrides.set(sessionId, {
    ...sessionOverrides.get(sessionId),
    ...overrides,
  });
}

export function getSessionConfig(sessionId: string): SessionConfigOverrides | undefined {
  return sessionOverrides.get(sessionId);
}

export function clearSessionConfig(sessionId: string): void {
  sessionOverrides.delete(sessionId);
}

export function listSessionConfigIds(): string[] {
  return [...sessionOverrides.keys()];
}
