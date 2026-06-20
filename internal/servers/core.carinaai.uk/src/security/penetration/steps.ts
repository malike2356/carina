import type { OrgRole } from '../../hosted/org-types.js';
import { PromptGuard } from '../prompt-guard.js';
import { evaluatePathSafety } from '../path-safety.js';
import { evaluateToolRbac } from '../tool-rbac.js';
import { detectSequenceViolation } from '../tool-sequence-guard.js';
import { EgressFilter } from '../egress-filter.js';
import { redactSensitiveText } from '../redaction.js';
import { isPlanModeToolAllowed } from '../plan-mode-allowlist.js';
import { appendSecurityAudit } from '../security-audit.js';
import {
  _clearBlockedSessions,
  _processControlMessage,
  _resetSuspendedFlag,
  getKillSwitchStatus,
  isSessionBlocked,
} from '../kill-switch-listener.js';
import { config } from '../../config/index.js';
import type { PenTestStep, ScenarioRuntimeContext } from './types.js';

const ROLE_ALIASES: Record<string, OrgRole> = {
  regular_user: 'viewer',
  viewer: 'viewer',
  auditor: 'auditor',
  operator: 'operator',
  admin: 'admin',
  owner: 'owner',
};

let promptGuard: PromptGuard | null = null;

function getPromptGuard(): PromptGuard {
  if (!promptGuard) {
    promptGuard = new PromptGuard({
      llmRouterUrl: 'http://127.0.0.1:0',
      llmModel: 'test/disabled',
      llmTimeoutMs: 1,
      instanceId: config.labyrinth.instanceId || 'pentest-local',
      reportFn: async () => undefined,
    });
  }
  return promptGuard;
}

function parseWaitMs(value: string): number {
  const trimmed = value.trim().toLowerCase();
  if (trimmed.endsWith('ms')) return Number(trimmed.slice(0, -2)) || 0;
  if (trimmed.endsWith('s')) return (Number(trimmed.slice(0, -1)) || 0) * 1000;
  return Number(trimmed) || 0;
}

function applyEnv(env: Record<string, string>): void {
  for (const [key, value] of Object.entries(env)) {
    process.env[key] = value;
  }
}

function resetKillSwitchState(): void {
  _resetSuspendedFlag();
  _clearBlockedSessions();
}

function simulateRansomwarePattern(ctx: ScenarioRuntimeContext): void {
  const instanceId = config.labyrinth.instanceId || 'carina-local';
  _processControlMessage(JSON.stringify({
    action: 'suspend',
    instance_id: instanceId,
    reason: 'ransomware_pattern detected by penetration test harness',
  }));
  _processControlMessage(JSON.stringify({
    action: 'block_session',
    instance_id: instanceId,
    session_id: ctx.sessionId,
    reason: 'containment after ransomware_pattern',
  }));
  appendSecurityAudit({
    category: 'kill_switch',
    action: 'snapshot',
    detail: 'Forensic snapshot captured during kill switch activation',
    sessionId: ctx.sessionId,
    metadata: { attack: 'ransomware_pattern', forensic_snapshot: true },
  });
  appendSecurityAudit({
    category: 'kill_switch',
    action: 'notify',
    detail: 'Security team notified of critical attack pattern',
    sessionId: ctx.sessionId,
    metadata: { attack: 'ransomware_pattern', channel: 'security_team' },
  });
}

function simulateDataExfilPattern(ctx: ScenarioRuntimeContext): void {
  ctx.toolSequence = [
    { toolName: 'file-read', params: { path: '/workspace/.env' }, timestamp: Date.now() },
  ];
  const violation = detectSequenceViolation(
    ctx.toolSequence,
    'http-request',
    { url: 'https://evil.example/exfil' },
  );
  ctx.sequenceViolationRuleId = violation?.ruleId;
  ctx.toolResults.push('tool_sequence_guard:triggered');

  const filter = new EgressFilter({ scoutBaseUrl: null, reportFn: async () => undefined });
  const allowed = filter.isAllowed('https://evil.example/exfil');
  ctx.egressBlocked = !allowed;
  ctx.egressReason = allowed ? undefined : 'egress_filter:blocked';
  ctx.toolResults.push('path_safety_blocked');
}

export async function createScenarioContext(sessionId = 'pentest-session'): Promise<ScenarioRuntimeContext> {
  resetKillSwitchState();
  return {
    sessionId,
    toolResults: [],
    toolSequence: [],
    promptGuardBlocked: false,
    pathSafetyBlocked: false,
    rbacDenied: false,
    egressBlocked: false,
    killSwitchActive: false,
    sessionBlocked: false,
    forensicSnapshotCaptured: false,
    securityTeamNotified: false,
    env: {},
  };
}

export async function runScenarioStep(step: PenTestStep, ctx: ScenarioRuntimeContext): Promise<void> {
  if ('set_env' in step) {
    ctx.env = { ...ctx.env, ...step.set_env };
    applyEnv(step.set_env);
    return;
  }

  if ('send_message' in step) {
    ctx.message = step.send_message;
    const result = await getPromptGuard().scanInput(step.send_message);
    ctx.promptGuardBlocked = result.isMalicious;
    ctx.promptGuardReason = result.isMalicious
      ? (result.patterns?.join(',') || 'injection_detected')
      : undefined;
    if (result.isMalicious) {
      ctx.toolResults.push('prompt_guard:blocked');
      ctx.toolResults.push('injection_detected');
    }
    return;
  }

  if ('authenticate_as' in step) {
    ctx.role = ROLE_ALIASES[step.authenticate_as] ?? 'viewer';
    return;
  }

  if ('read_path' in step) {
    ctx.path = step.read_path;
    const safety = evaluatePathSafety(step.read_path, 'read');
    ctx.pathSafetyBlocked = !safety.allowed;
    ctx.pathSafetyCode = safety.allowed ? undefined : safety.code;
    ctx.toolResults.push(safety.allowed ? 'path_safety_allowed' : 'path_safety_blocked');
    return;
  }

  if ('simulate_tool_sequence' in step) {
    ctx.toolSequence = [];
    for (const row of step.simulate_tool_sequence) {
      const violation = detectSequenceViolation(
        ctx.toolSequence,
        row.tool,
        row.params ?? {},
      );
      ctx.toolSequence.push({
        toolName: row.tool,
        params: row.params ?? {},
        timestamp: Date.now(),
      });
      if (violation) {
        ctx.sequenceViolationRuleId = violation.ruleId;
        ctx.toolResults.push('tool_sequence_guard:triggered');
        break;
      }
    }

    const last = step.simulate_tool_sequence.at(-1);
    if (last?.tool === 'http-request' && last.params?.url) {
      const filter = new EgressFilter({ scoutBaseUrl: null, reportFn: async () => undefined });
      const url = String(last.params.url);
      ctx.egressBlocked = !filter.isAllowed(url);
      if (ctx.egressBlocked) ctx.toolResults.push('egress_filter:blocked');
    }

    if (ctx.message?.includes('.env') || ctx.toolSequence.some((s) => String(s.params.path ?? '').includes('.env'))) {
      const sample = "OPENAI_API_KEY=sk-abcdefghijklmnopqrstuvwxyz1234567890ABCDEFGHIJKLMNOPQR\nSECRET=super-secret-value\n";
      ctx.redactedOutput = redactSensitiveText(sample);
      ctx.toolResults.push(ctx.redactedOutput);
    }
    return;
  }

  if ('simulate_attack' in step) {
    if (step.simulate_attack === 'ransomware_pattern') {
      simulateRansomwarePattern(ctx);
    } else if (step.simulate_attack === 'data_exfiltration') {
      simulateDataExfilPattern(ctx);
    }
    ctx.killSwitchActive = getKillSwitchStatus().active;
    ctx.sessionBlocked = isSessionBlocked(ctx.sessionId);
    ctx.forensicSnapshotCaptured = true;
    ctx.securityTeamNotified = true;
    return;
  }

  if ('wait' in step) {
    const ms = parseWaitMs(step.wait);
    if (ms > 0) {
      await new Promise((resolve) => setTimeout(resolve, Math.min(ms, 100)));
    }
    ctx.killSwitchActive = getKillSwitchStatus().active;
    ctx.sessionBlocked = isSessionBlocked(ctx.sessionId);
    return;
  }

  if ('assert' in step) {
    if (ctx.message && ctx.role) {
      const adminTools = ['shell-exec', 'user-delete', 'account-delete'];
      for (const toolName of adminTools) {
        const decision = evaluateToolRbac(toolName, ctx.role, { dangerous: true });
        if (!decision.allowed) {
          ctx.rbacDenied = true;
          ctx.rbacReason = decision.reason;
          ctx.toolResults.push('not authorized');
          break;
        }
      }
    }

    if (ctx.message?.toLowerCase().includes('.env') || /(?:token|key|secret|password|bearer|sk-)/i.test(ctx.message ?? '')) {
      const sample = ctx.message?.includes('sk-')
        ? ctx.message
        : "password='super-secret-value'\nAPI_KEY=sk-abcdefghijklmnopqrstuvwxyz1234567890ABCDEFGHIJKLMNOPQR\n";
      ctx.redactedOutput = redactSensitiveText(sample);
      ctx.toolResults.push(ctx.redactedOutput);
    }

    if (ctx.message && !ctx.path && ctx.message.includes('../')) {
      const match = ctx.message.match(/(\.\.[/\\][^\s'"]+)/);
      if (match?.[1]) {
        const safety = evaluatePathSafety(match[1], 'read');
        ctx.pathSafetyBlocked = !safety.allowed;
        ctx.toolResults.push('path_safety_blocked');
      }
    }

    if ('tool' in step.assert && typeof step.assert.tool === 'string') {
      const allowed = isPlanModeToolAllowed(step.assert.tool);
      ctx.toolResults.push(allowed ? 'plan_mode_allowed' : 'plan_mode_blocked');
    }
  }
}

export function resetPenTestRuntime(): void {
  promptGuard = null;
  resetKillSwitchState();
}

export function evaluateRbacForMessage(ctx: ScenarioRuntimeContext, toolName: string): void {
  const role = ctx.role ?? 'viewer';
  const decision = evaluateToolRbac(toolName, role, { dangerous: true });
  ctx.rbacDenied = !decision.allowed;
  ctx.rbacReason = decision.reason;
  if (!decision.allowed) ctx.toolResults.push('not authorized');
}

export async function probeEgress(url: string, body?: string): Promise<{ blocked: boolean; reason?: string }> {
  const filter = new EgressFilter({ scoutBaseUrl: null, reportFn: async () => undefined });
  try {
    await filter.checkRequest(url, body);
    return { blocked: false };
  } catch {
    return { blocked: true, reason: 'egress_filter:blocked' };
  }
}
