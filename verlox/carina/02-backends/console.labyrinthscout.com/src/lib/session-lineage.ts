export interface SessionLineage {
  sessionId: string;
  parentSessionId: string | null;
  rootSessionId: string | null;
  attemptNumber: number;
  triggerType: 'webhook' | 'taskflow' | 'chat' | 'retry' | 'branch' | 'unknown';
  createdAt: string;
}

export interface LineageContext {
  sessionId: string;
  parentSessionId?: string;
  rootSessionId?: string;
  attemptNumber?: number;
  triggerType?: SessionLineage['triggerType'];
}

export function buildLineage(input: LineageContext): SessionLineage {
  const rootSessionId = input.rootSessionId
    ?? input.parentSessionId
    ?? input.sessionId;

  return {
    sessionId: input.sessionId,
    parentSessionId: input.parentSessionId ?? null,
    rootSessionId,
    attemptNumber: input.attemptNumber ?? 1,
    triggerType: input.triggerType ?? 'unknown',
    createdAt: new Date().toISOString(),
  };
}

export function lineageFromEventMetadata(
  sessionId: string,
  metadata: Record<string, unknown>,
): SessionLineage {
  return buildLineage({
    sessionId,
    parentSessionId: typeof metadata.parent_session_id === 'string'
      ? metadata.parent_session_id
      : undefined,
    rootSessionId: typeof metadata.root_session_id === 'string'
      ? metadata.root_session_id
      : undefined,
    attemptNumber: typeof metadata.attempt_number === 'number'
      ? metadata.attempt_number
      : undefined,
    triggerType: typeof metadata.trigger_type === 'string'
      ? metadata.trigger_type as SessionLineage['triggerType']
      : undefined,
  });
}

export function enrichEventWithLineage<T extends Record<string, unknown>>(
  payload: T,
  lineage: SessionLineage,
): T & {
  session_id: string;
  parent_session_id: string | null;
  root_session_id: string | null;
  metadata: Record<string, unknown>;
} {
  const existingMeta = typeof payload.metadata === 'object' && payload.metadata !== null
    ? payload.metadata as Record<string, unknown>
    : {};

  return {
    ...payload,
    session_id: lineage.sessionId,
    parent_session_id: lineage.parentSessionId,
    root_session_id: lineage.rootSessionId,
    metadata: {
      ...existingMeta,
      attempt_number: lineage.attemptNumber,
      trigger_type: lineage.triggerType,
      lineage_created_at: lineage.createdAt,
    },
  };
}

export function describeLineageRelation(lineage: SessionLineage): string {
  if (!lineage.parentSessionId) return 'new session';
  if (lineage.triggerType === 'retry') return 'retry of parent session';
  if (lineage.triggerType === 'branch') return 'branch from parent session';
  return 'continuation of parent session';
}

export function isReplayAttempt(lineage: SessionLineage): boolean {
  return lineage.attemptNumber > 1 || lineage.triggerType === 'retry';
}
