import { getRedis } from '../redis.js';
import type { ShieldMode, ShieldModeState } from './policy-decisions.js';
import { getLoadedPolicy } from './tool-policy.js';
import { canonicalToolName } from './tool-tiers.js';

const SHIELD_KEY_PREFIX = 'scout:shield:';
const memoryModes = new Map<string, ShieldModeState>();

const RESTRICTED_TOOLS = new Set([
  'terminal',
  'shell-exec',
  'file-write',
  'write_file',
  'email-send',
  'email_send',
  'message-send',
]);

const GUARD_APPROVAL_TOOLS = new Set([
  'file-write',
  'write_file',
  'email-send',
  'email_send',
  'http-request',
  'terminal',
  'shell-exec',
]);

function shieldKey(sessionId: string): string {
  return `${SHIELD_KEY_PREFIX}${sessionId}`;
}

function defaultState(sessionId: string): ShieldModeState {
  return {
    sessionId,
    mode: 'observe',
    changedAt: new Date().toISOString(),
    changedBy: 'system',
  };
}

export async function getShieldMode(sessionId: string): Promise<ShieldModeState> {
  const redis = getRedis();
  if (redis) {
    try {
      const raw = await redis.get(shieldKey(sessionId));
      if (raw) return JSON.parse(raw) as ShieldModeState;
    } catch {
      /* fall through to memory */
    }
  }
  return memoryModes.get(sessionId) ?? defaultState(sessionId);
}

export async function setShieldMode(
  sessionId: string,
  mode: ShieldMode,
  changedBy: string,
  reason?: string,
): Promise<ShieldModeState> {
  const state: ShieldModeState = {
    sessionId,
    mode,
    reason,
    changedAt: new Date().toISOString(),
    changedBy,
  };

  const redis = getRedis();
  if (redis) {
    try {
      await redis.set(shieldKey(sessionId), JSON.stringify(state), 'EX', 86400 * 7);
    } catch {
      memoryModes.set(sessionId, state);
    }
  } else {
    memoryModes.set(sessionId, state);
  }

  return state;
}

export async function isToolAllowedInShieldMode(
  toolName: string,
  mode: ShieldMode,
): Promise<{ allowed: boolean; reason?: string }> {
  const canonical = canonicalToolName(toolName);
  const policy = getLoadedPolicy();

  if (policy.blocklist.includes(toolName) || policy.blocklist.includes(canonical)) {
    return { allowed: false, reason: 'tool is blocklisted' };
  }

  switch (mode) {
    case 'quarantine':
      return { allowed: false, reason: 'session is quarantined' };
    case 'restrict':
      if (RESTRICTED_TOOLS.has(canonical) || RESTRICTED_TOOLS.has(toolName)) {
        return { allowed: false, reason: 'tool disabled in restrict mode' };
      }
      return { allowed: true };
    case 'guard':
      if (RESTRICTED_TOOLS.has(canonical) || RESTRICTED_TOOLS.has(toolName)) {
        return { allowed: true, reason: 'requires approval in guard mode' };
      }
      return { allowed: true };
    default:
      return { allowed: true };
  }
}

export function requiresApprovalInGuardMode(toolName: string, mode: ShieldMode): boolean {
  if (mode !== 'guard') return false;
  const canonical = canonicalToolName(toolName);
  return GUARD_APPROVAL_TOOLS.has(canonical) || GUARD_APPROVAL_TOOLS.has(toolName);
}

export function resetShieldModesForTests(): void {
  memoryModes.clear();
}

export async function listShieldModes(sessionIds: string[]): Promise<ShieldModeState[]> {
  return Promise.all(sessionIds.map((id) => getShieldMode(id)));
}
