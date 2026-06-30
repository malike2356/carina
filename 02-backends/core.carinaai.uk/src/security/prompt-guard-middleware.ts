import { config } from '../config/index.js';
import { reportEvent } from './scout-client.js';
import { PromptGuard, type SecurityEvent } from './prompt-guard.js';
import { isAgentGuardEnabled, scanWithAgentGuard } from './agent-guard-adapter.js';
import { checkStaleMarkerInput } from './deception-client.js';
import { scanForHoneypotLeak } from './honeypot-client.js';
import { appendSecurityAudit } from './security-audit.js';
import { redactSensitiveText } from './redaction.js';
import { sanitizeCarinaProse } from './writing-style.js';
import {
  isSecretExfiltrationRequest,
  scanAssistantOutputForSecretLeak,
} from './secret-refusal-guard.js';
import { emitRaspSignal, signalFromPromptGuard } from './rasp/index.js';

let guard: PromptGuard | null = null;
let auditPreview = '';

export type PromptGuardScanOptions = {
  sessionId?: string;
};

export type InputBlockInfo = {
  message: string;
  ref?: string;
  source: 'prompt-guard' | 'agent-guard' | 'deception';
  layer?: 1 | 2 | 3;
  patterns?: string[];
  patternIds?: string[];
};

export type InputScanResult = {
  allowed: boolean;
  text: string;
  block?: InputBlockInfo;
};

export function isPromptGuardEnabled(): boolean {
  return process.env.CARINA_PROMPT_GUARD !== 'false';
}

export function isScoutReportingEnabled(): boolean {
  return process.env.LABYRINTH_ENABLED === 'true';
}

function mapSeverity(severity: SecurityEvent['severity']): 'info' | 'warning' | 'critical' | 'breach' {
  if (severity === 'error' || severity === 'critical') return 'critical';
  if (severity === 'warning') return 'warning';
  return 'info';
}

function recordPromptInjectionAudit(
  event: SecurityEvent,
  preview: string,
): void {
  appendSecurityAudit({
    category: 'prompt_injection',
    action: event.event_type.includes('blocked') ? 'block' : 'detect',
    detail: String(event.metadata.blocked_message ?? event.event_type),
    metadata: {
      ...event.metadata,
      scout_event_type: event.event_type,
      severity: event.severity,
      instance_id: event.instance_id,
      preview: preview.slice(0, 200),
    },
  });
}

async function scoutReportFn(event: SecurityEvent, preview: string): Promise<void> {
  recordPromptInjectionAudit(event, preview);
  if (!isScoutReportingEnabled()) return;
  await reportEvent({
    severity: mapSeverity(event.severity),
    source: 'prompt-guard',
    event_type: event.event_type,
    description: `PromptGuard event: ${event.event_type}`,
    metadata: event.metadata,
    instance_id: event.instance_id,
  });
}

function getGuard(): PromptGuard | null {
  if (!isPromptGuardEnabled()) return null;
  if (!guard) {
    guard = new PromptGuard({
      llmRouterUrl: process.env.LABYRINTH_LLM_ROUTER_URL ?? config.labyrinth.llmRouterUrl,
      llmModel: process.env.LABYRINTH_JUDGE_MODEL ?? config.labyrinth.judgeModel,
      llmTimeoutMs: config.labyrinth.judgeTimeoutMs,
      instanceId: config.labyrinth.instanceId,
      reportFn: async (event) => scoutReportFn(event, auditPreview),
    });
  }
  return guard;
}

const LEAK_BLOCK_MESSAGE =
  'Response withheld: output matched a monitored decoy credential. Security team notified.';

function blockedResult(block: InputBlockInfo): InputScanResult {
  return { allowed: false, text: block.message, block };
}

function mapPromptGuardConfidence(confidence: number): number {
  return Math.min(1, Math.max(0.5, confidence / 100));
}

function emitPromptGuardRaspSignal(input: {
  sessionId?: string;
  eventType: string;
  confidence: number;
  patterns?: string[];
  patternIds?: string[];
  ref?: string;
}): void {
  void emitRaspSignal(signalFromPromptGuard({
    sessionId: input.sessionId,
    type: input.eventType,
    severity: mapPromptGuardConfidence(input.confidence),
    confidence: mapPromptGuardConfidence(input.confidence),
    patterns: input.patterns,
    patternId: input.patternIds?.[0],
    ref: input.ref,
  }));
}

export async function scanUserInput(
  text: string,
  options?: PromptGuardScanOptions,
): Promise<InputScanResult> {
  if (!isPromptGuardEnabled()) {
    return { allowed: true, text };
  }

  if (process.env.CARINA_DECEPTION_ENABLED === 'true' || isScoutReportingEnabled()) {
    const stale = await checkStaleMarkerInput(text);
    if (stale.blocked) {
      const message = stale.reason ?? 'This request was blocked by the deception security layer.';
      appendSecurityAudit({
        category: 'prompt_injection',
        action: 'block',
        detail: message,
        metadata: { source: 'deception', preview: text.slice(0, 200) },
      });
      return blockedResult({ message, source: 'deception' });
    }
  }

  if (isAgentGuardEnabled()) {
    const agentGuard = await scanWithAgentGuard(text);
    if (!agentGuard.skipped && agentGuard.flagged) {
      const message = 'I cannot process this request because it was flagged by the security filter.';
      appendSecurityAudit({
        category: 'prompt_injection',
        action: 'block',
        detail: message,
        metadata: {
          source: 'agent-guard',
          score: agentGuard.score,
          preview: text.slice(0, 200),
        },
      });
      if (isScoutReportingEnabled()) {
        await reportEvent({
          severity: 'warning',
          source: 'agent-guard',
          event_type: 'prompt_injection_blocked',
          description: 'Agent Guard flagged input before LLM processing',
          metadata: {
            score: agentGuard.score,
            preview: text.slice(0, 500),
          },
        });
      }
      return blockedResult({ message, source: 'agent-guard' });
    }
  }

  const g = getGuard();
  if (!g) return { allowed: true, text };
  try {
    auditPreview = text;
    const result = await g.scanInput(text);
    if (result.isMalicious) {
      const message = result.message ?? result.sanitized ?? 'This request was blocked by the security shield.';
      emitPromptGuardRaspSignal({
        sessionId: options?.sessionId,
        eventType: 'injection_blocked',
        confidence: result.confidence,
        patterns: result.patterns,
        patternIds: result.patternIds,
        ref: result.ref,
      });
      return blockedResult({
        message,
        ref: result.ref,
        source: 'prompt-guard',
        layer: result.layer,
        patterns: result.patterns,
        patternIds: result.patternIds,
      });
    }
    return { allowed: true, text };
  } catch {
    return { allowed: true, text };
  }
}

export async function scanToolOutput(
  toolName: string,
  result: string,
  options?: PromptGuardScanOptions,
): Promise<string> {
  let output = result;
  const g = getGuard();
  if (g) {
    try {
      const scan = await g.scanToolResult(toolName, result);
      output = scan.isMalicious ? (scan.sanitized ?? result) : result;
      if (scan.isMalicious) {
        emitPromptGuardRaspSignal({
          sessionId: options?.sessionId,
          eventType: 'tool_result_injection_blocked',
          confidence: scan.confidence,
          patterns: scan.patterns,
          patternIds: scan.patternIds,
          ref: scan.ref,
        });
        appendSecurityAudit({
          category: 'prompt_injection',
          action: 'block',
          detail: scan.message ?? 'Tool output injection blocked',
          toolName,
          metadata: {
            source: 'prompt-guard',
            layer: scan.layer,
            patterns: scan.patterns,
            shield_ref: scan.ref,
          },
        });
      }
    } catch {
      output = result;
    }
  }

  const leaked = await scanForHoneypotLeak(output, { source: 'tool_output', tool_name: toolName });
  if (leaked) {
    await reportEvent({
      severity: 'breach',
      source: 'honeypot',
      event_type: 'honeypot_output_leak',
      description: `Decoy credential leaked in tool output from ${toolName}`,
      metadata: { tool_name: toolName },
    });
    return LEAK_BLOCK_MESSAGE;
  }

  return sanitizeCarinaProse(redactSensitiveText(output));
}

export async function scanAgentOutput(text: string, meta?: Record<string, unknown>): Promise<string> {
  if (!text.trim()) return text;

  const userMessage = typeof meta?.user_message === 'string' ? meta.user_message : '';
  const leak = scanAssistantOutputForSecretLeak(userMessage, text);
  if (leak.blocked) return leak.safeText;

  const redacted = sanitizeCarinaProse(redactSensitiveText(text));
  const leaked = await scanForHoneypotLeak(redacted, { source: 'agent_output', ...meta });
  if (leaked) {
    await reportEvent({
      severity: 'breach',
      source: 'honeypot',
      event_type: 'honeypot_output_leak',
      description: 'Decoy credential leaked in agent response',
      metadata: meta ?? {},
    });
    return LEAK_BLOCK_MESSAGE;
  }

  return redacted;
}

export function _resetPromptGuardForTests(): void {
  guard = null;
  auditPreview = '';
}
