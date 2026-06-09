import { reportEvent } from './scout-client.js';
import {
  getToolSequenceTracker,
  isToolSequenceGuardEnabled,
  ToolSequenceBlockedError,
  type SequenceViolation,
} from './tool-sequence-guard.js';

export async function enforceToolSequence(
  sessionId: string,
  toolName: string,
  params: Record<string, unknown>,
): Promise<{ error: string; code: string } | null> {
  if (!isToolSequenceGuardEnabled()) return null;

  const tracker = getToolSequenceTracker();
  const violation = tracker.check(sessionId, toolName, params);
  if (!violation) return null;

  await reportSequenceViolation(sessionId, toolName, violation);
  return {
    error: new ToolSequenceBlockedError(violation).message,
    code: 'TOOL_SEQUENCE_BLOCKED',
  };
}

export function recordToolSequenceStep(
  sessionId: string,
  toolName: string,
  params: Record<string, unknown>,
): void {
  if (!isToolSequenceGuardEnabled()) return;
  getToolSequenceTracker().record(sessionId, toolName, params);
}

export function getSessionToolSequence(sessionId: string): string[] {
  return getToolSequenceTracker().getSequence(sessionId);
}

async function reportSequenceViolation(
  sessionId: string,
  toolName: string,
  violation: SequenceViolation,
): Promise<void> {
  await reportEvent({
    severity: violation.severity === 'critical' ? 'critical' : 'warning',
    source: 'tool-sequence-guard',
    event_type: 'tool_sequence_blocked',
    description: violation.label,
    session_id: sessionId,
    metadata: {
      rule_id: violation.ruleId,
      blocked_tool: toolName,
      sequence: violation.sequence,
    },
  });
}
