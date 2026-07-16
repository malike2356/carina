import { logSelfModEvent } from './self-mod-logger.js';
import {
  blockSessionByPolicy,
  suspendInstanceByPolicy,
} from './kill-switch-listener.js';
import { RuntimeToolStore } from '../tools/dynamic/tool-store.js';

export const enum ResponseLevel {
  WARNING = 1,
  CRITICAL = 2,
  EMERGENCY = 3,
}

const TRIGGERS: Record<string, ResponseLevel> = {
  'tool.injection_blocked':   ResponseLevel.CRITICAL,
  'tool.rapid_generation':    ResponseLevel.CRITICAL,
  'tool.high_risk_pattern':   ResponseLevel.WARNING,
  'tool_gen.auth_lockout':    ResponseLevel.WARNING,
};

let lastResponseTime = 0;
const COOLDOWN_MS = 60_000;

const autoResponseEnabled = (): boolean =>
  process.env.SCOUT_SELF_MOD_AUTO_RESPONSE !== 'false';

const autoSuspendEnabled = (): boolean =>
  process.env.SCOUT_SELF_MOD_AUTO_SUSPEND !== 'false';

export async function executeAutoResponse(
  eventType: string,
  detail: Record<string, unknown>,
): Promise<void> {
  if (!autoResponseEnabled()) return;

  const level = TRIGGERS[eventType];
  if (!level) return;

  if (Date.now() - lastResponseTime < COOLDOWN_MS) return;
  lastResponseTime = Date.now();

  if (level === ResponseLevel.WARNING) {
    await respondWarning(eventType, detail);
  } else if (level === ResponseLevel.CRITICAL) {
    await respondCritical(eventType, detail);
  } else {
    await respondEmergency(eventType, detail);
  }
}

async function respondWarning(
  eventType: string,
  detail: Record<string, unknown>,
): Promise<void> {
  const toolName = detail.tool_name as string | undefined;
  if (toolName) {
    const store = new RuntimeToolStore();
    const tool = await store.findByName(toolName).catch(() => null);
    if (tool) {
      await store.disable(tool.id).catch(() => undefined);
    }
  }

  await logSelfModEvent('SCOUT_AUTO_QUARANTINE', {
    event_type: eventType,
    tool_name: toolName ?? '(unknown)',
    reason: `Automated quarantine triggered by ${eventType}`,
    action_taken: 'Tool disabled in runtime_tools. Operator alerted.',
  });
}

async function respondCritical(
  eventType: string,
  detail: Record<string, unknown>,
): Promise<void> {
  const sessionId = detail.session_id as string | undefined;
  if (sessionId) {
    blockSessionByPolicy(sessionId, `Auto-response to ${eventType}`);
  }

  // Disable all recently-generated tools that haven't been approved
  const store = new RuntimeToolStore();
  const pending = await store.list({ status: 'pending' }).catch(() => [] as Awaited<ReturnType<typeof store.list>>);
  for (const tool of pending) {
    await store.disable(tool.id).catch(() => undefined);
  }

  await logSelfModEvent('SCOUT_AUTO_QUARANTINE', {
    event_type: eventType,
    tools_quarantined: pending.length,
    session_blocked: sessionId ?? '(none)',
    reason: `Critical event: ${eventType}`,
    action_taken: 'Session blocked. All pending tools disabled. Operator alerted.',
  });
}

async function respondEmergency(
  eventType: string,
  detail: Record<string, unknown>,
): Promise<void> {
  if (!autoSuspendEnabled()) {
    await respondCritical(eventType, detail);
    return;
  }

  const instanceId = process.env.CARINA_INSTANCE_ID ?? 'carina-core';
  suspendInstanceByPolicy(`Emergency auto-response to ${eventType}`);

  await logSelfModEvent('SCOUT_AUTO_SUSPEND', {
    event_type: eventType,
    instance_id: instanceId,
    reason: `Emergency suspension triggered by ${eventType}`,
    action_taken: 'Carina instance suspended. All tool execution blocked.',
  });
}
