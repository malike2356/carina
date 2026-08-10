import { createHash } from 'node:crypto';

export type EngineContextCheckpoint = {
  schemaVersion: 'aiva-engine-context.v1';
  tenantId: string;
  workspaceId: string;
  workerId: string;
  contactId: string;
  conversationId: string;
  channel: string;
  turnNumber: number;
  idempotencyKey: string;
  summary: string;
  workingSet: string[];
  pendingApprovalIds: string[];
  toolEvidence: string[];
  sourceEngine: string;
  targetEngine: string;
};

function safe(value: string | undefined): string {
  return value?.trim() || 'not_observed';
}

export function buildEngineContextCheckpoint(input: {
  tenantId: string;
  workspaceId: string;
  workerId: string;
  contactId: string;
  conversationId: string;
  channel: string;
  turnNumber: number;
  messageId: string;
  summary?: string;
  workingSet?: string[];
  pendingApprovalIds?: string[];
  toolEvidence?: string[];
  sourceEngine: string;
  targetEngine: string;
}): EngineContextCheckpoint {
  const scope = [input.tenantId, input.workspaceId, input.workerId, input.conversationId].map(safe).join(':');
  const idempotencyKey = createHash('sha256')
    .update(`${scope}:${input.turnNumber}:${safe(input.messageId)}`)
    .digest('hex');
  return {
    schemaVersion: 'aiva-engine-context.v1',
    tenantId: safe(input.tenantId),
    workspaceId: safe(input.workspaceId),
    workerId: safe(input.workerId),
    contactId: safe(input.contactId),
    conversationId: safe(input.conversationId),
    channel: safe(input.channel),
    turnNumber: Math.max(1, Math.trunc(input.turnNumber)),
    idempotencyKey,
    summary: input.summary?.trim() || '',
    workingSet: [...(input.workingSet ?? [])],
    pendingApprovalIds: [...(input.pendingApprovalIds ?? [])],
    toolEvidence: [...(input.toolEvidence ?? [])],
    sourceEngine: safe(input.sourceEngine),
    targetEngine: safe(input.targetEngine),
  };
}

export function assertEngineContextBoundary(checkpoint: EngineContextCheckpoint, expected: {
  tenantId: string;
  workspaceId: string;
  conversationId: string;
}): void {
  if (checkpoint.tenantId !== safe(expected.tenantId)
    || checkpoint.workspaceId !== safe(expected.workspaceId)
    || checkpoint.conversationId !== safe(expected.conversationId)) {
    throw new Error('Aiva engine context boundary mismatch');
  }
}
