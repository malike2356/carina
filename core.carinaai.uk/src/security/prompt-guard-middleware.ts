import { config } from '../config/index.js';
import { reportEvent } from './scout-client.js';
import { PromptGuard, type SecurityEvent } from './prompt-guard.js';

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

export async function scanUserInput(text: string): Promise<string> {
  const g = getGuard();
  if (!g) return text;
  try {
    const result = await g.scanInput(text);
    return result.isMalicious ? (result.sanitized ?? text) : text;
  } catch {
    return text;
  }
}

export async function scanToolOutput(toolName: string, result: string): Promise<string> {
  const g = getGuard();
  if (!g) return result;
  try {
    const scan = await g.scanToolResult(toolName, result);
    return scan.isMalicious ? (scan.sanitized ?? result) : result;
  } catch {
    return result;
  }
}
