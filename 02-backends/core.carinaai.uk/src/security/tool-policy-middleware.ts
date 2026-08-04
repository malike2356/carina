import type { Redis } from 'ioredis';
import { config } from '../config/index.js';
import { getRedis } from '../memory/redis.js';
import { reportEvent } from './scout-client.js';
import {
  ToolPolicyEnforcer,
  ToolBlockedError,
  DangerousCommandError,
  RateLimitError,
  ConfirmationRequiredError,
  type EnforceParams,
  type SecurityEvent,
} from './tool-policy.js';

export {
  ToolBlockedError,
  DangerousCommandError,
  RateLimitError,
  ConfirmationRequiredError,
};

let enforcer: ToolPolicyEnforcer | null = null;

function mapSeverity(severity: SecurityEvent['severity']): 'info' | 'warning' | 'critical' | 'breach' {
  if (severity === 'error' || severity === 'critical') return 'critical';
  if (severity === 'warning') return 'warning';
  return 'info';
}

async function scoutReportFn(event: SecurityEvent): Promise<void> {
  await reportEvent({
    severity: mapSeverity(event.severity),
    source: 'tool-policy',
    event_type: event.event_type,
    description: `Tool policy event: ${event.event_type}`,
    metadata: event.metadata,
    instance_id: event.instance_id,
  });
}

function getEnforcer(): ToolPolicyEnforcer | null {
  if (process.env.LABYRINTH_ENABLED !== 'true') return null;
  const redis = getRedis();
  if (!redis) return null;
  if (!enforcer) {
    enforcer = new ToolPolicyEnforcer(redis, scoutReportFn, undefined, config.labyrinth.instanceId);
  }
  return enforcer;
}

export async function enforceToolPolicy(
  toolName: string,
  params: EnforceParams,
  sessionId: string,
): Promise<{ error: string; code: string } | null> {
  const active = getEnforcer();
  if (!active) return null;

  try {
    await active.enforce(toolName, params, sessionId);
    return null;
  } catch (err) {
    if (
      err instanceof ToolBlockedError ||
      err instanceof DangerousCommandError ||
      err instanceof RateLimitError ||
      err instanceof ConfirmationRequiredError
    ) {
      return { error: err.message, code: err.code };
    }
    throw err;
  }
}

/** Reset singleton (tests only). */
export function _resetToolPolicyEnforcer(): void {
  enforcer = null;
}
