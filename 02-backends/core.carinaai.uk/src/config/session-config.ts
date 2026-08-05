import type { ThinkingLevel } from '../agents/thinking-levels.js';

export type SessionConfigOverrides = {
  maxTurns?: number;
  iterationBudget?: number;
  provider?: string;
  model?: string;
  blockExpensiveModels?: boolean;
  thinkingLevel?: ThinkingLevel;
  fastModeUntilTurn?: boolean;
  /** Cap reply generation size for snappy channels (Telegram / chat). */
  maxCompletionTokens?: number;
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
