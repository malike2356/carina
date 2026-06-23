import { getRedis } from '../redis.js';
import { publishControlMessage } from '../lib/instance-control.js';

export type SurfaceRestriction =
  | 'shell'
  | 'external_http'
  | 'skill_write'
  | 'provider_change'
  | 'message_bridge'
  | 'plugin';

export interface SurfaceRestrictionState {
  instanceId: string;
  sessionId?: string;
  restriction: SurfaceRestriction;
  target?: string;
  reason: string;
  appliedAt: string;
  appliedBy: string;
  expiresAt?: string;
}

const SURFACE_KEY_PREFIX = 'scout:surface:';
const memoryRestrictions = new Map<string, SurfaceRestrictionState>();

function restrictionKey(instanceId: string, restriction: SurfaceRestriction, sessionId?: string): string {
  const scope = sessionId ? `${instanceId}:${sessionId}` : instanceId;
  return `${SURFACE_KEY_PREFIX}${scope}:${restriction}`;
}

export async function applySurfaceRestriction(input: {
  instanceId: string;
  sessionId?: string;
  restriction: SurfaceRestriction;
  target?: string;
  reason: string;
  appliedBy: string;
  durationSeconds?: number;
}): Promise<SurfaceRestrictionState> {
  const state: SurfaceRestrictionState = {
    instanceId: input.instanceId,
    sessionId: input.sessionId,
    restriction: input.restriction,
    target: input.target,
    reason: input.reason,
    appliedAt: new Date().toISOString(),
    appliedBy: input.appliedBy,
    expiresAt: input.durationSeconds
      ? new Date(Date.now() + input.durationSeconds * 1000).toISOString()
      : undefined,
  };

  const key = restrictionKey(input.instanceId, input.restriction, input.sessionId);
  const redis = getRedis();
  const ttl = input.durationSeconds ?? 86400;

  if (redis) {
    try {
      await redis.set(key, JSON.stringify(state), 'EX', ttl);
    } catch {
      memoryRestrictions.set(key, state);
    }
  } else {
    memoryRestrictions.set(key, state);
  }

  await publishControlMessage({
    action: 'surface_restriction',
    instance_id: input.instanceId,
    session_id: input.sessionId ?? null,
    restriction: input.restriction,
    target: input.target,
    reason: input.reason,
    timestamp: state.appliedAt,
  }).catch(() => undefined);

  return state;
}

export async function releaseSurfaceRestriction(
  instanceId: string,
  restriction: SurfaceRestriction,
  sessionId?: string,
): Promise<boolean> {
  const key = restrictionKey(instanceId, restriction, sessionId);
  const redis = getRedis();

  if (redis) {
    try {
      const deleted = await redis.del(key);
      memoryRestrictions.delete(key);
      return deleted > 0;
    } catch {
      /* fall through */
    }
  }

  return memoryRestrictions.delete(key);
}

export async function isSurfaceRestricted(
  instanceId: string,
  restriction: SurfaceRestriction,
  sessionId?: string,
  target?: string,
): Promise<SurfaceRestrictionState | null> {
  const key = restrictionKey(instanceId, restriction, sessionId);
  const redis = getRedis();

  let state: SurfaceRestrictionState | null = null;
  if (redis) {
    try {
      const raw = await redis.get(key);
      if (raw) state = JSON.parse(raw) as SurfaceRestrictionState;
    } catch {
      /* fall through */
    }
  }
  if (!state) state = memoryRestrictions.get(key) ?? null;

  if (!state) return null;
  if (state.expiresAt && new Date(state.expiresAt) <= new Date()) {
    await releaseSurfaceRestriction(instanceId, restriction, sessionId);
    return null;
  }
  if (target && state.target && state.target !== target) return null;
  return state;
}

export async function listSurfaceRestrictions(
  instanceId: string,
  sessionId?: string,
): Promise<SurfaceRestrictionState[]> {
  const restrictions: SurfaceRestrictionState[] = [];
  const types: SurfaceRestriction[] = [
    'shell', 'external_http', 'skill_write', 'provider_change', 'message_bridge', 'plugin',
  ];

  for (const restriction of types) {
    const state = await isSurfaceRestricted(instanceId, restriction, sessionId);
    if (state) restrictions.push(state);
  }
  return restrictions;
}

export function restrictionBlocksTool(
  restriction: SurfaceRestriction,
  toolName: string,
): boolean {
  if (restriction === 'shell' && (toolName === 'shell-exec' || toolName === 'terminal')) {
    return true;
  }
  if (restriction === 'external_http' && toolName === 'http-request') {
    return true;
  }
  if (restriction === 'skill_write' && toolName.includes('skill') && toolName.includes('write')) {
    return true;
  }
  return false;
}

export function resetSurfaceRestrictionsForTests(): void {
  memoryRestrictions.clear();
}

export interface RiskTransitionRule {
  id: string;
  trigger: 'repeated_injection' | 'unknown_tool' | 'risky_chain' | 'suspicious_egress';
  autoApply: boolean;
  targetMode?: 'guard' | 'restrict';
  restrictions?: SurfaceRestriction[];
}

export const DEFAULT_RISK_TRANSITION_RULES: RiskTransitionRule[] = [
  {
    id: 'repeated-injection',
    trigger: 'repeated_injection',
    autoApply: true,
    targetMode: 'restrict',
  },
  {
    id: 'unknown-tool',
    trigger: 'unknown_tool',
    autoApply: false,
    targetMode: 'guard',
  },
  {
    id: 'suspicious-egress',
    trigger: 'suspicious_egress',
    autoApply: true,
    restrictions: ['external_http'],
  },
  {
    id: 'risky-chain',
    trigger: 'risky_chain',
    autoApply: true,
    targetMode: 'guard',
  },
];
