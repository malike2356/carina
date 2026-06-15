import {
  importScoutPackage,
  type ScoutEvent,
  type ToolCallReport,
} from './load-scout-package.js';

export type { ScoutEvent, ToolCallReport } from './load-scout-package.js';

async function scout(): Promise<Awaited<ReturnType<typeof importScoutPackage>>> {
  return importScoutPackage();
}

export async function reportEvent(event: ScoutEvent): Promise<void> {
  const mod = await scout();
  if (!mod) return;
  return mod.reportEvent(event);
}

export async function reportToolCall(call: ToolCallReport): Promise<void> {
  const mod = await scout();
  if (!mod) return;
  return mod.reportToolCall(call);
}

export async function reportHeartbeat(): Promise<void> {
  const mod = await scout();
  if (!mod) return;
  return mod.reportHeartbeat();
}

export async function recordToolCall(
  sessionId: string,
  toolName: string,
  responseLength: number,
): Promise<void> {
  const mod = await scout();
  if (!mod) return;
  return mod.recordToolCall(sessionId, toolName, responseLength);
}

export async function flushMetricsToScout(
  instanceId: string,
  sessionId: string,
): Promise<void> {
  const mod = await scout();
  if (!mod) return;
  return mod.flushMetricsToScout(instanceId, sessionId);
}

export function stopMetricsFlush(sessionId: string): void {
  void scout().then((mod) => mod?.stopMetricsFlush(sessionId));
}

export function sanitiseParams(params: Record<string, unknown>): Record<string, unknown> {
  const redacted = { ...params };
  for (const [key, value] of Object.entries(redacted)) {
    if (/(api[_-]?key|token|secret|password|authorization|auth)/i.test(key)) {
      redacted[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      redacted[key] = sanitiseParams(value as Record<string, unknown>);
    }
  }
  return redacted;
}

export function _resetMetricsTimers(): void {
  void scout().then((mod) => mod?._resetMetricsTimers());
}

export function _resetScoutWarnFlag(): void {
  void scout().then((mod) => mod?._resetScoutWarnFlag());
}
