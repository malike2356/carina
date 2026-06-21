import { randomUUID } from 'crypto';
import { getRedis } from '../redis.js';

export type JitGrantScope = 'session' | 'action' | 'tool' | 'channel';

export interface JitGrant {
  id: string;
  sessionId: string;
  instanceId: string;
  scope: JitGrantScope;
  toolName?: string;
  actionType?: string;
  channel?: string;
  grantedAt: string;
  expiresAt: string;
  grantedBy: string;
  reason?: string;
}

const JIT_KEY_PREFIX = 'scout:jit:';
const memoryGrants = new Map<string, JitGrant>();

function grantKey(id: string): string {
  return `${JIT_KEY_PREFIX}${id}`;
}

function sessionIndexKey(sessionId: string): string {
  return `${JIT_KEY_PREFIX}session:${sessionId}`;
}

export function computeExpiry(durationSeconds: number): string {
  const clamped = Math.min(Math.max(durationSeconds, 60), 3600);
  return new Date(Date.now() + clamped * 1000).toISOString();
}

export async function createJitGrant(input: {
  sessionId: string;
  instanceId: string;
  scope: JitGrantScope;
  toolName?: string;
  actionType?: string;
  channel?: string;
  durationSeconds?: number;
  grantedBy: string;
  reason?: string;
}): Promise<JitGrant> {
  const duration = input.durationSeconds ?? 300;
  const grant: JitGrant = {
    id: randomUUID(),
    sessionId: input.sessionId,
    instanceId: input.instanceId,
    scope: input.scope,
    toolName: input.toolName,
    actionType: input.actionType,
    channel: input.channel,
    grantedAt: new Date().toISOString(),
    expiresAt: computeExpiry(duration),
    grantedBy: input.grantedBy,
    reason: input.reason,
  };

  const redis = getRedis();
  const ttl = Math.ceil((new Date(grant.expiresAt).getTime() - Date.now()) / 1000);

  if (redis) {
    try {
      await redis.set(grantKey(grant.id), JSON.stringify(grant), 'EX', ttl);
      await redis.sadd(sessionIndexKey(grant.sessionId), grant.id);
      await redis.expire(sessionIndexKey(grant.sessionId), ttl + 60);
    } catch {
      memoryGrants.set(grant.id, grant);
    }
  } else {
    memoryGrants.set(grant.id, grant);
  }

  return grant;
}

export async function getJitGrant(id: string): Promise<JitGrant | null> {
  const redis = getRedis();
  if (redis) {
    try {
      const raw = await redis.get(grantKey(id));
      if (raw) return JSON.parse(raw) as JitGrant;
    } catch {
      /* fall through */
    }
  }
  const mem = memoryGrants.get(id);
  if (mem && new Date(mem.expiresAt) > new Date()) return mem;
  if (mem) memoryGrants.delete(id);
  return null;
}

export async function listSessionGrants(sessionId: string): Promise<JitGrant[]> {
  const grants: JitGrant[] = [];
  const redis = getRedis();

  if (redis) {
    try {
      const ids = await redis.smembers(sessionIndexKey(sessionId));
      for (const id of ids) {
        const grant = await getJitGrant(id);
        if (grant) grants.push(grant);
      }
      return grants;
    } catch {
      /* fall through */
    }
  }

  for (const grant of memoryGrants.values()) {
    if (grant.sessionId === sessionId && new Date(grant.expiresAt) > new Date()) {
      grants.push(grant);
    }
  }
  return grants;
}

export async function revokeJitGrant(id: string): Promise<boolean> {
  const redis = getRedis();
  const grant = await getJitGrant(id);

  if (redis) {
    try {
      await redis.del(grantKey(id));
      if (grant) await redis.srem(sessionIndexKey(grant.sessionId), id);
    } catch {
      /* fall through */
    }
  }

  return memoryGrants.delete(id) || grant !== null;
}

export function grantCoversAction(
  grant: JitGrant,
  toolName: string,
  actionType?: string,
): boolean {
  if (new Date(grant.expiresAt) <= new Date()) return false;

  switch (grant.scope) {
    case 'session':
      return true;
    case 'tool':
      return grant.toolName === toolName;
    case 'action':
      return grant.actionType === actionType;
    default:
      return false;
  }
}

export async function hasValidJitGrant(
  sessionId: string,
  toolName: string,
  actionType?: string,
): Promise<JitGrant | null> {
  const grants = await listSessionGrants(sessionId);
  for (const grant of grants) {
    if (grantCoversAction(grant, toolName, actionType)) {
      return grant;
    }
  }
  return null;
}

export function resetJitGrantsForTests(): void {
  memoryGrants.clear();
}
