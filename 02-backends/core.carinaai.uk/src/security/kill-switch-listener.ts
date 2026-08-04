import fs from 'fs';
import path from 'path';
import type { Redis } from 'ioredis';
import { config } from '../config/index.js';
import { createRedisSubscriber } from '../lib/redis.js';
import { clearSession } from '../memory/store.js';
import { effectiveScoutControlMode } from './scout-control-settings.js';
import { isAgenticScoutCommand } from './scout-mutual-types.js';

const CHANNEL = 'labyrinth:control';
const LOG_PATH = path.join(process.cwd(), 'data', 'logs', 'labyrinth-suspend.log');

let suspended = false;
let suspensionReason = '';
const blockedSessions = new Set<string>();
const suspendedSessions = new Set<string>();
const gracefulSuspendSessions = new Map<string, string>();
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

const ENFORCEMENT_ACTIONS = new Set([
  'suspend',
  'block_session',
  'suspend_session',
  'quarantine_tool',
  'block_egress',
  'set_rate_limit',
  'set_sandbox_policy',
  'set_tool_policy',
  'clear_session_memory',
]);

export function isScoutEnforcementEnabled(): boolean {
  return effectiveScoutControlMode() === 'enforce';
}

function isEnforcementAction(action: unknown): boolean {
  return typeof action === 'string' && ENFORCEMENT_ACTIONS.has(action);
}

function shouldMonitorOnly(payload: Record<string, unknown>): boolean {
  return !isScoutEnforcementEnabled() && isEnforcementAction(payload.action);
}

function recordMonitorOnlyControl(payload: Record<string, unknown>): void {
  const action = String(payload.action ?? 'unknown');
  const reason = String(payload.reason ?? '');
  const target = String(payload.session_id ?? payload.tool ?? payload.domain ?? payload.instance_id ?? '');
  const logLine = `MONITOR ONLY: Scout ${action} ignored. Target: ${target}. Reason: ${reason}`;
  console.warn(`[KillSwitch] ${logLine}`);
  appendLog(logLine);
}

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

export function getKillSwitchStatus(): { active: boolean; reason: string } {
  return { active: suspended, reason: suspensionReason };
}

export function isSessionBlocked(sessionId: string): boolean {
  return blockedSessions.has(sessionId) || suspendedSessions.has(sessionId);
}

export function isSessionSuspended(sessionId: string): boolean {
  return suspendedSessions.has(sessionId);
}

export function isSessionGracefullySuspending(sessionId: string): boolean {
  return gracefulSuspendSessions.has(sessionId);
}

export function checkSessionAllowed(sessionId: string): void {
  checkNotSuspended();
  if (isSessionBlocked(sessionId)) {
    throw new Error(
      `Session ${sessionId.slice(0, 8)}... is suspended by Labyrinth Scout. Start a new session to continue.`,
    );
  }
}

export function finalizeGracefulSessionSuspend(sessionId: string): void {
  const reason = gracefulSuspendSessions.get(sessionId);
  if (!reason) return;
  gracefulSuspendSessions.delete(sessionId);
  suspendedSessions.add(sessionId);
  blockedSessions.add(sessionId);
  const logLine = `SESSION SUSPENDED (graceful complete): ${sessionId}. Reason: ${reason}`;
  console.warn(`[KillSwitch] ${logLine}`);
  appendLog(logLine);
}

export function blockSessionByPolicy(sessionId: string, reason: string): void {
  if (!sessionId) return;
  if (!isScoutEnforcementEnabled()) {
    const logLine = `MONITOR ONLY: policy session block ignored for ${sessionId}. Reason: ${reason}`;
    console.warn(`[KillSwitch] ${logLine}`);
    appendLog(logLine);
    return;
  }
  blockedSessions.add(sessionId);
  const logLine = `SESSION BLOCKED (policy): ${sessionId}. Reason: ${reason}`;
  console.warn(`[KillSwitch] ${logLine}`);
  appendLog(logLine);
}

/** Clear RASP/Scout session blocks so /new can continue on the same channel session id. */
export function clearSessionPolicyBlock(sessionId: string): boolean {
  if (!sessionId) return false;
  const had =
    blockedSessions.delete(sessionId)
    || suspendedSessions.delete(sessionId)
    || gracefulSuspendSessions.delete(sessionId);
  if (had) {
    const logLine = `SESSION BLOCK CLEARED: ${sessionId}`;
    console.info(`[KillSwitch] ${logLine}`);
    appendLog(logLine);
  }
  return had;
}

export function suspendInstanceByPolicy(reason: string): void {
  if (!isScoutEnforcementEnabled()) {
    const logLine = `MONITOR ONLY: policy suspend ignored. Reason: ${reason}`;
    console.warn(`[KillSwitch] ${logLine}`);
    appendLog(logLine);
    return;
  }
  suspended = true;
  suspensionReason = reason;
  const logLine = `SUSPENDED (policy): ${reason}`;
  console.error(`[KillSwitch] ${logLine}`);
  appendLog(logLine);
}

export function isToolQuarantined(instanceId: string, toolName: string): boolean {
  return quarantinedTools.get(instanceId)?.has(toolName) ?? false;
}

export function isOperatorBlocked(instanceId: string, domain: string): boolean {
  return operatorBlockedDomains.get(instanceId)?.has(domain.toLowerCase()) ?? false;
}

async function triggerForensicCapture(payload: Record<string, unknown>): Promise<void> {
  const sessionId = typeof payload.session_id === 'string' ? payload.session_id : undefined;
  const incidentId = typeof payload.incident_id === 'string' && payload.incident_id
    ? payload.incident_id
    : `scout-${Date.now()}`;
  const reason = typeof payload.reason === 'string' ? payload.reason : 'Scout forensic trigger';
  try {
    const { captureForensicOnScoutTrigger } = await import('./forensics/evidence-capture.js');
    await captureForensicOnScoutTrigger({
      incidentId,
      sessionId,
      reason,
      capturedBy: 'scout-control',
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('[KillSwitch] Forensic capture failed:', msg);
  }
}

async function applyWorkerScopedControl(payload: Record<string, unknown>): Promise<boolean> {
  const { handleScoutWorkerControl } = await import('./scout-worker-killswitch.js');
  return handleScoutWorkerControl(payload);
}

function recordPolicyVersionFromScout(
  kind: 'sandbox' | 'tool',
  payload: Record<string, unknown>,
): void {
  void import('./scout/policy-tracker.js').then(({ recordPolicyChange }) => {
    recordPolicyChange(kind, payload);
  }).catch(() => {
    /* optional in tests */
  });
}

function applyControlPayload(payload: Record<string, unknown>): void {
  void applyWorkerScopedControl(payload).then((handled) => {
    if (handled) return;
    applyInstanceControlPayload(payload);
  });
}

function applyInstanceControlPayload(payload: Record<string, unknown>): void {
  const instanceId = config.labyrinth.instanceId;
  if (payload.instance_id !== instanceId) return;

  if (isAgenticScoutCommand(payload.action)) {
    void import('./scout-command-handlers.js').then(({ applyAgenticScoutCommand }) =>
      applyAgenticScoutCommand(payload),
    );
    return;
  }

  applyInstanceControlActions(payload);
}

function applyInstanceControlActions(payload: Record<string, unknown>): void {
  if (shouldMonitorOnly(payload)) {
    recordMonitorOnlyControl(payload);
    if (payload.capture_forensic === true || payload.action === 'suspend' || payload.action === 'suspend_session') {
      void triggerForensicCapture(payload);
    }
    return;
  }

  if (payload.action === 'suspend') {
    suspended = true;
    suspensionReason = (payload.reason as string) || 'No reason provided';
    const logLine = `SUSPENDED by Scout. Reason: ${suspensionReason}`;
    console.error(`[KillSwitch] ${logLine}`);
    appendLog(logLine);
    void triggerForensicCapture(payload);
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
      if (payload.capture_forensic === true) {
        void triggerForensicCapture(payload);
      }
    }
  } else if (payload.action === 'suspend_session') {
    const sid = payload.session_id;
    const reason = String(payload.reason ?? 'Scout session suspend');
    if (typeof sid === 'string' && sid) {
      if (payload.graceful === true) {
        gracefulSuspendSessions.set(sid, reason);
        const logLine = `SESSION GRACEFUL SUSPEND pending: ${sid}. Reason: ${reason}`;
        console.warn(`[KillSwitch] ${logLine}`);
        appendLog(logLine);
      } else {
        suspendedSessions.add(sid);
        blockedSessions.add(sid);
        const logLine = `SESSION SUSPENDED: ${sid}. Reason: ${reason}`;
        console.warn(`[KillSwitch] ${logLine}`);
        appendLog(logLine);
      }
      void triggerForensicCapture({ ...payload, session_id: sid, reason });
    }
  } else if (payload.action === 'resume_session') {
    const sid = payload.session_id;
    if (typeof sid === 'string' && sid) {
      suspendedSessions.delete(sid);
      gracefulSuspendSessions.delete(sid);
      blockedSessions.delete(sid);
      const logLine = `SESSION RESUMED: ${sid}`;
      console.log(`[KillSwitch] ${logLine}`);
      appendLog(logLine);
    }
  } else if (payload.action === 'capture_forensic') {
    void triggerForensicCapture(payload);
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
    void recordPolicyVersionFromScout('sandbox', payload);
  } else if (payload.action === 'set_tool_policy') {
    if (payload.allowlist_enforced === true) {
      allowlistEnforced = true;
      appendLog('TOOL POLICY: allowlist enforcement enabled');
    } else if (payload.allowlist_enforced === false) {
      allowlistEnforced = false;
      appendLog('TOOL POLICY: allowlist enforcement disabled');
    }
    void recordPolicyVersionFromScout('tool', payload);
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
    subscriber = createRedisSubscriber();
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
  suspendedSessions.clear();
  gracefulSuspendSessions.clear();
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
    applyInstanceControlPayload(JSON.parse(message) as Record<string, unknown>);
  } catch {
    /* malformed */
  }
}
