import { config } from '../../config/index.js';
import { defaultAgentId } from './response-dispatcher.js';
import type { RASPSignal } from './types.js';

function baseContext(
  sessionId: string,
  agentId?: string,
  toolName?: string,
  details: Record<string, unknown> = {},
): RASPSignal['context'] {
  return {
    sessionId: sessionId || 'unknown',
    agentId: agentId ?? defaultAgentId(),
    toolName,
    details,
  };
}

export function signalFromPromptGuard(input: {
  sessionId?: string;
  type: string;
  severity?: number;
  confidence?: number;
  source?: string;
  patterns?: string[];
  ref?: string;
}): Omit<RASPSignal, 'timestamp'> {
  return {
    source: 'prompt_guard',
    type: input.type,
    severity: input.severity ?? 0.85,
    confidence: input.confidence ?? 0.8,
    context: baseContext(input.sessionId ?? 'unknown', undefined, undefined, {
      source: input.source ?? 'prompt-guard',
      patterns: input.patterns,
      ref: input.ref,
    }),
  };
}

export function signalFromToolSequence(input: {
  sessionId: string;
  toolName: string;
  ruleId: string;
  label: string;
  severity?: 'critical' | 'warning';
  sequence?: string[];
}): Omit<RASPSignal, 'timestamp'> {
  return {
    source: 'tool_sequence',
    type: input.ruleId,
    severity: input.severity === 'critical' ? 0.95 : 0.75,
    confidence: 0.9,
    context: baseContext(input.sessionId, undefined, input.toolName, {
      label: input.label,
      sequence: input.sequence,
    }),
  };
}

export function signalFromEgressFilter(input: {
  sessionId?: string;
  eventType: string;
  url?: string;
  patternName?: string;
}): Omit<RASPSignal, 'timestamp'> {
  return {
    source: 'egress_filter',
    type: input.eventType,
    severity: 0.9,
    confidence: 0.85,
    context: baseContext(input.sessionId ?? 'system', undefined, undefined, {
      url: input.url,
      patternName: input.patternName,
    }),
  };
}

export function signalFromHoneypot(input: {
  sessionId?: string;
  eventType: string;
  toolName?: string;
}): Omit<RASPSignal, 'timestamp'> {
  return {
    source: 'honeypot',
    type: input.eventType,
    severity: 0.95,
    confidence: 0.95,
    context: baseContext(input.sessionId ?? 'unknown', undefined, input.toolName, {}),
  };
}

export function signalFromTrustState(input: {
  sessionId?: string;
  note: string;
  suspended?: boolean;
}): Omit<RASPSignal, 'timestamp'> {
  return {
    source: 'trust_state',
    type: input.suspended ? 'instance_suspended' : 'trust_degraded',
    severity: input.suspended ? 0.8 : 0.5,
    confidence: 0.7,
    context: baseContext(input.sessionId ?? config.labyrinth.instanceId, undefined, undefined, {
      note: input.note,
    }),
  };
}

export function signalFromAnomaly(input: {
  sessionId: string;
  action: string;
  detail?: string;
  meta?: Record<string, unknown>;
}): Omit<RASPSignal, 'timestamp'> {
  return {
    source: 'anomaly',
    type: input.action,
    severity: 0.55,
    confidence: 0.6,
    context: baseContext(input.sessionId, undefined, undefined, {
      detail: input.detail,
      ...input.meta,
    }),
  };
}
