import { randomUUID } from 'node:crypto';

export type ToolFailureClass = 'validation' | 'authorization' | 'credential' | 'transient' | 'timeout' | 'unknown';

export type ToolExecutionEnvelope<T = unknown> = {
  ok: boolean;
  status: 'succeeded' | 'failed' | 'partial';
  data?: T;
  userSummary: string;
  retryable: boolean;
  failureClass?: ToolFailureClass;
  correlationId: string;
  provenance: { tool: string; action: string; workspaceId: string; workerId: string };
};

export function classifyToolFailure(error: unknown): { failureClass: ToolFailureClass; retryable: boolean; userSummary: string } {
  const message = error instanceof Error ? error.message : String(error);
  if (/missing|invalid|required/i.test(message)) return { failureClass: 'validation', retryable: false, userSummary: message };
  if (/denied|forbidden|permission|grant/i.test(message)) return { failureClass: 'authorization', retryable: false, userSummary: message };
  if (/credential|token|oauth|reauth/i.test(message)) return { failureClass: 'credential', retryable: false, userSummary: message };
  if (/timeout|timed out|abort/i.test(message)) return { failureClass: 'timeout', retryable: true, userSummary: 'The connected service timed out. No success is being claimed.' };
  if (/temporar|rate limit|try again|5\d\d/i.test(message)) return { failureClass: 'transient', retryable: true, userSummary: 'The connected service is temporarily unavailable. Please retry.' };
  return { failureClass: 'unknown', retryable: false, userSummary: 'The operation could not be completed. No success is being claimed.' };
}

export function toolSuccess<T>(input: { tool: string; action: string; workspaceId: string; workerId: string; data?: T; correlationId?: string }): ToolExecutionEnvelope<T> {
  return { ok: true, status: 'succeeded', data: input.data, userSummary: 'Operation completed successfully.', retryable: false, correlationId: input.correlationId ?? randomUUID(), provenance: { tool: input.tool, action: input.action, workspaceId: input.workspaceId, workerId: input.workerId } };
}

export function toolFailure(input: { tool: string; action: string; workspaceId: string; workerId: string; error: unknown; correlationId?: string }): ToolExecutionEnvelope {
  const classified = classifyToolFailure(input.error);
  return { ok: false, status: 'failed', userSummary: classified.userSummary, retryable: classified.retryable, failureClass: classified.failureClass, correlationId: input.correlationId ?? randomUUID(), provenance: { tool: input.tool, action: input.action, workspaceId: input.workspaceId, workerId: input.workerId } };
}
