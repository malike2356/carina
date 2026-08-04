import { config } from '../config/index.js';
import { reportEvent } from './scout-client.js';
import { PromptGuard, type SecurityEvent } from './prompt-guard.js';
import { isAgentGuardEnabled, scanWithAgentGuard } from './agent-guard-adapter.js';
import { checkStaleMarkerInput } from './deception-client.js';
import { scanForHoneypotLeak } from './honeypot-client.js';

let guard: PromptGuard | null = null;

function mapSeverity(severity: SecurityEvent['severity']): 'info' | 'warning' | 'critical' | 'breach' {
  if (severity === 'error' || severity === 'critical') return 'critical';
  if (severity === 'warning') return 'warning';
  return 'info';
}

async function scoutReportFn(event: SecurityEvent): Promise<void> {
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
  if (process.env.LABYRINTH_ENABLED !== 'true') return null;
  if (!guard) {
    guard = new PromptGuard({
      llmRouterUrl: process.env.LABYRINTH_LLM_ROUTER_URL ?? config.labyrinth.llmRouterUrl,
      llmModel: process.env.LABYRINTH_JUDGE_MODEL ?? config.labyrinth.judgeModel,
      llmTimeoutMs: config.labyrinth.judgeTimeoutMs,
      instanceId: config.labyrinth.instanceId,
      reportFn: scoutReportFn,
    });
  }
  return guard;
}

const LEAK_BLOCK_MESSAGE =
  'Response withheld: output matched a monitored decoy credential. Security team notified.';

export async function scanUserInput(text: string): Promise<string> {
  if (process.env.LABYRINTH_ENABLED !== 'true') return text;

  const stale = await checkStaleMarkerInput(text);
  if (stale.blocked) {
    return stale.reason ?? 'This request was blocked by the deception security layer.';
  }

  if (isAgentGuardEnabled()) {
    const agentGuard = await scanWithAgentGuard(text);
    if (!agentGuard.skipped && agentGuard.flagged) {
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
      return 'I cannot process this request because it was flagged by the security filter.';
    }
  }

  const g = getGuard();
  if (!g) return text;
  try {
    const result = await g.scanInput(text);
    return result.isMalicious ? (result.message ?? result.sanitized ?? text) : text;
  } catch {
    return text;
  }
}

export async function scanToolOutput(toolName: string, result: string): Promise<string> {
  let output = result;
  const g = getGuard();
  if (g) {
    try {
      const scan = await g.scanToolResult(toolName, result);
      output = scan.isMalicious ? (scan.sanitized ?? result) : result;
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

  return output;
}

export async function scanAgentOutput(text: string, meta?: Record<string, unknown>): Promise<string> {
  if (!text.trim()) return text;

  const leaked = await scanForHoneypotLeak(text, { source: 'agent_output', ...meta });
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

  return text;
}
