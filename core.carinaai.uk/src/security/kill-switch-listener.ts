import fs from 'fs';
import path from 'path';
import { Redis } from 'ioredis';
import { config } from '../config/index.js';
import { clearSession } from '../memory/store.js';

const CHANNEL = 'labyrinth:control';
const LOG_PATH = path.join(process.cwd(), 'data', 'logs', 'labyrinth-suspend.log');

let suspended = false;
let suspensionReason = '';
const blockedSessions = new Set<string>();
// In-memory only; lost on Carina restart. Operators must re-quarantine after restart.
const quarantinedTools = new Map<string, Set<string>>();
// instance_id -> Set of operator-blocked domains (lowercase, no protocol)
// NOTE: In-memory only. If Carina restarts, Scout must re-publish or operator re-applies blocks.
const operatorBlockedDomains = new Map<string, Set<string>>();
// Per-session rate limit overrides. Populated via Scout control messages.
const sessionRateLimits = new Map<string, number>();
export type SandboxPolicyMode = 'default' | 'docker_only' | 'session_only' | 'host_blocked';

let instanceSandboxPolicy: SandboxPolicyMode = 'default';
const sessionSandboxPolicies = new Map<string, SandboxPolicyMode>();
let allowlistEnforced = process.env.SCOUT_ENFORCE_ALLOWLIST === 'true';
let subscriber: Redis | null = null;

export function getInstanceSandboxPolicy(): SandboxPolicyMode {
  return instanceSandboxPolicy;
}

export function getSessionSandboxPolicy(sessionId: string): SandboxPolicyMode | null {
  return sessionSandboxPolicies.get(sessionId) ?? null;
}

export function isAllowlistEnforced(): boolean {
  return allowlistEnforced;
}

export function _resetSandboxPolicies(): void {
  instanceSandboxPolicy = 'default';
  sessionSandboxPolicies.clear();
  allowlistEnforced = process.env.SCOUT_ENFORCE_ALLOWLIST === 'true';
}

export function getSessionRateLimit(sessionId: string): number | null {
  return sessionRateLimits.get(sessionId) ?? null;
}

function appendLog(line: string): void {
  const entry = `[${new Date().toISOString()}] ${line}\n`;
  fs.mkdirSync(path.dirname(LOG_PATH), { recursive: true });
  fs.appendFileSync(LOG_PATH, entry, 'utf8');
}

export function checkNotSuspended(): void {
  if (suspended) {
    throw new Error(
      `Carina is suspended by Labyrinth Scout. Reason: ${suspensionReason}. Contact administrator.`,
    );
  }
}

export function isSuspended(): boolean {
  return suspended;
}

export function isSessionBlocked(sessionId: string): boolean {
  return blockedSessions.has(sessionId);
}

export function isToolQuarantined(instanceId: string, toolName: string): boolean {
  return quarantinedTools.get(instanceId)?.has(toolName) ?? false;
}

export function isOperatorBlocked(instanceId: string, domain: string): boolean {
  return operatorBlockedDomains.get(instanceId)?.has(domain.toLowerCase()) ?? false;
}

function applyControlPayload(payload: Record<string, unknown>): void {
  const instanceId = config.labyrinth.instanceId;
  if (payload.instance_id !== instanceId) return;

  if (payload.action === 'suspend') {
    suspended = true;
    suspensionReason = (payload.reason as string) || 'No reason provided';
    const logLine = `SUSPENDED by Scout. Reason: ${suspensionReason}`;
    console.error(`[KillSwitch] ${logLine}`);
    appendLog(logLine);
  } else if (payload.action === 'resume') {
    suspended = false;
    suspensionReason = '';
    const logLine = 'RESUMED by Scout.';
    console.log(`[KillSwitch] ${logLine}`);
    appendLog(logLine);
  } else if (payload.action === 'block_session') {
    const sid = payload.session_id;
    if (typeof sid === 'string' && sid) {
      blockedSessions.add(sid);
      const logLine = `SESSION BLOCKED: ${sid}. Reason: ${String(payload.reason ?? '')}`;
      console.warn(`[KillSwitch] ${logLine}`);
      appendLog(logLine);
    }
  } else if (payload.action === 'quarantine_tool') {
    const tool = payload.tool;
    const iid = typeof payload.instance_id === 'string' ? payload.instance_id : '';
    if (typeof tool === 'string' && tool && iid) {
      if (!quarantinedTools.has(iid)) quarantinedTools.set(iid, new Set());
      quarantinedTools.get(iid)!.add(tool);
      const logLine = `TOOL QUARANTINED: ${tool} on ${iid}. Reason: ${String(payload.reason ?? '')}`;
      console.warn(`[KillSwitch] ${logLine}`);
      appendLog(logLine);
    }
  } else if (payload.action === 'lift_quarantine') {
    const tool = payload.tool;
    const iid = typeof payload.instance_id === 'string' ? payload.instance_id : '';
    if (typeof tool === 'string' && tool && iid) {
      quarantinedTools.get(iid)?.delete(tool);
      const logLine = `TOOL QUARANTINE LIFTED: ${tool} on ${iid}`;
      console.log(`[KillSwitch] ${logLine}`);
      appendLog(logLine);
    }
  } else if (payload.action === 'block_egress') {
    const domain = payload.domain;
    const iid = typeof payload.instance_id === 'string' ? payload.instance_id : '';
    if (typeof domain === 'string' && domain && iid) {
      if (!operatorBlockedDomains.has(iid)) operatorBlockedDomains.set(iid, new Set());
      operatorBlockedDomains.get(iid)!.add(domain.toLowerCase());
      const logLine = `EGRESS BLOCKED: ${domain} on ${iid}. Reason: ${String(payload.reason ?? '')}`;
      console.warn(`[KillSwitch] ${logLine}`);
      appendLog(logLine);
    }
  } else if (payload.action === 'unblock_egress') {
    const domain = payload.domain;
    const iid = typeof payload.instance_id === 'string' ? payload.instance_id : '';
    if (typeof domain === 'string' && domain && iid) {
      operatorBlockedDomains.get(iid)?.delete(domain.toLowerCase());
      const logLine = `EGRESS UNBLOCKED: ${domain} on ${iid}`;
      console.log(`[KillSwitch] ${logLine}`);
      appendLog(logLine);
    }
  } else if (payload.action === 'set_rate_limit') {
    const sid = payload.session_id;
    const cpm = payload.calls_per_minute;
    if (typeof sid === 'string' && typeof cpm === 'number' && cpm >= 1) {
      sessionRateLimits.set(sid, cpm);
      console.log(`[KillSwitch] Rate limit set: ${cpm}/min for session ${sid.slice(0, 8)}...`);
    }
  } else if (payload.action === 'set_sandbox_policy') {
    const mode = payload.mode;
    const sid = payload.session_id;
    const valid: SandboxPolicyMode[] = ['default', 'docker_only', 'session_only', 'host_blocked'];
    if (typeof mode !== 'string' || !valid.includes(mode as SandboxPolicyMode)) return;
    const policyMode = mode as SandboxPolicyMode;
    if (typeof sid === 'string' && sid) {
      sessionSandboxPolicies.set(sid, policyMode);
      const logLine = `SANDBOX POLICY session=${sid}: ${policyMode}`;
      console.warn(`[KillSwitch] ${logLine}`);
      appendLog(logLine);
    } else {
      instanceSandboxPolicy = policyMode;
      const logLine = `SANDBOX POLICY instance: ${policyMode}`;
      console.warn(`[KillSwitch] ${logLine}`);
      appendLog(logLine);
    }
  } else if (payload.action === 'set_tool_policy') {
    if (payload.allowlist_enforced === true) {
      allowlistEnforced = true;
      appendLog('TOOL POLICY: allowlist enforcement enabled');
    } else if (payload.allowlist_enforced === false) {
      allowlistEnforced = false;
      appendLog('TOOL POLICY: allowlist enforcement disabled');
    }
  } else if (payload.action === 'clear_rate_limit') {
    const sid = payload.session_id;
    if (typeof sid === 'string') {
      sessionRateLimits.delete(sid);
      console.log(`[KillSwitch] Rate limit cleared for session ${sid.slice(0, 8)}...`);
    }
  } else if (payload.action === 'clear_session_memory') {
    const sid = payload.session_id;
    if (typeof sid === 'string' && sid.length > 0) {
      clearSession(sid)
        .then(() => {
          console.log(`[KillSwitch] Session memory cleared: ${sid.slice(0, 8)}...`);
        })
        .catch((err: unknown) => {
          console.error('[KillSwitch] clearSession failed:', err);
        });
    }
  }
}

export function initKillSwitchListener(): () => void {
  if (!config.labyrinth.enabled) {
    return () => {};
  }

  if (!config.labyrinth.instanceId) {
    console.warn('[KillSwitch] LABYRINTH_INSTANCE_ID not set. Kill switch disabled.');
    return () => {};
  }

  try {
    subscriber = new Redis(config.redis.url, {
      lazyConnect: false,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });
  } catch (err) {
    console.warn('[KillSwitch] Failed to create Redis subscriber. Kill switch disabled.', err);
    return () => {};
  }

  subscriber.on('error', (err) => {
    console.warn('[KillSwitch] Redis subscriber error. Kill switch may not function:', err.message);
  });

  subscriber.subscribe(CHANNEL, (err) => {
    if (err) {
      console.warn('[KillSwitch] Failed to subscribe to channel:', err.message);
    } else {
      console.log(`[KillSwitch] Subscribed to ${CHANNEL} for instance ${config.labyrinth.instanceId}`);
    }
  });

  subscriber.on('message', (channel, message) => {
    if (channel !== CHANNEL) return;
    try {
      applyControlPayload(JSON.parse(message) as Record<string, unknown>);
    } catch {
      /* malformed message */
    }
  });

  return () => {
    subscriber?.unsubscribe();
    subscriber?.disconnect();
    subscriber = null;
  };
}

/** Test helpers */
export function _resetSuspendedFlag(): void {
  suspended = false;
  suspensionReason = '';
}

export function _clearBlockedSessions(): void {
  blockedSessions.clear();
}

export function _clearQuarantinedTools(): void {
  quarantinedTools.clear();
}

export function _clearOperatorBlockedDomains(): void {
  operatorBlockedDomains.clear();
}

export function _resetRateLimits(): void {
  sessionRateLimits.clear();
}

export function _setSuspendedFlag(reason = 'test suspension'): void {
  suspended = true;
  suspensionReason = reason;
}

export function _processControlMessage(message: string): void {
  try {
    applyControlPayload(JSON.parse(message) as Record<string, unknown>);
  } catch {
    /* malformed */
  }
}
