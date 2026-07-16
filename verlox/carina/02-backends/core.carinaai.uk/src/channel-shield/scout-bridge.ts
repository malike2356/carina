import { config } from '../config/index.js';
import { reportEvent } from '../security/scout-client.js';
import { appendEvent, getMessage, updateMessage } from './store.js';
import type { ShieldChannel, ShieldVerdict } from './types.js';

const killCache = new Map<string, { killed: boolean; at: number }>();

export async function reportShieldEvent(input: {
  eventType: string;
  severity: 'info' | 'warning' | 'critical' | 'low' | 'medium' | 'high';
  workspaceId: string;
  channel: ShieldChannel | string;
  messageId?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const severity =
    input.severity === 'critical' || input.severity === 'high'
      ? 'critical'
      : input.severity === 'warning' || input.severity === 'medium'
        ? 'warning'
        : 'info';

  await reportEvent({
    severity,
    source: `carina:channel-shield:${input.channel}`,
    event_type: input.eventType,
    description: `${input.eventType} channel=${input.channel}`,
    instance_id: config.labyrinth.instanceId,
    metadata: {
      workspaceId: input.workspaceId,
      channel: input.channel,
      messageId: input.messageId,
      ...(input.metadata ?? {}),
    },
  });

  if (input.messageId) {
    const msg = await getMessage(input.messageId);
    if (msg) {
      const ids = [...msg.scoutEventIds, input.eventType];
      await updateMessage(input.messageId, { scoutEventIds: ids.slice(-40) });
    }
  }
}

/** Workspace or protection kill switch (env + optional Scout refs). */
export async function isShieldDeliveryKilled(
  workspaceId: string,
  protectionId: string,
): Promise<boolean> {
  const key = `${workspaceId}:${protectionId}`;
  const cached = killCache.get(key);
  if (cached && Date.now() - cached.at < 15_000) return cached.killed;

  const envKill = process.env.CHANNEL_SHIELD_KILL === 'true';
  const wsKill = (process.env.CHANNEL_SHIELD_KILL_WORKSPACES ?? '')
    .split(',')
    .map((s) => s.trim())
    .includes(workspaceId);
  const protKill = (process.env.CHANNEL_SHIELD_KILL_PROTECTIONS ?? '')
    .split(',')
    .map((s) => s.trim())
    .includes(protectionId);

  let scoutKill = false;
  try {
    const base = config.labyrinth.url.replace(/\/$/, '');
    if (process.env.LABYRINTH_ENABLED === 'true' && config.labyrinth.apiKey) {
      const res = await fetch(`${base}/api/policy/evaluate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Scout-Key': config.labyrinth.apiKey,
        },
        body: JSON.stringify({
          session_id: `channel-shield:${workspaceId}`,
          tool_name: 'channel_shield.deliver',
          params: { workspaceId, protectionId },
          instance_id: config.labyrinth.instanceId,
        }),
        signal: AbortSignal.timeout(3000),
      });
      if (res.ok) {
        const data = (await res.json()) as { decision?: string };
        if (data.decision === 'block' || data.decision === 'deny' || data.decision === 'quarantine') {
          scoutKill = true;
        }
      }
    }
  } catch {
    // local fallback: env flags only
  }

  const killed = envKill || wsKill || protKill || scoutKill;
  killCache.set(key, { killed, at: Date.now() });
  return killed;
}

export async function evaluateShieldDeliverPolicy(
  workspaceId: string,
  channel: string,
  verdict: ShieldVerdict,
): Promise<{ allow: boolean; reason?: string }> {
  if (verdict === 'malicious') return { allow: false, reason: 'malicious' };
  void workspaceId;
  void channel;
  return { allow: true };
}

export async function noteDualControlRelease(
  messageId: string,
  actor: string,
  approver: string,
): Promise<void> {
  await appendEvent(messageId, actor, 'release_requested', { approver });
  await appendEvent(messageId, approver, 'release_approved', { actor });
  await reportShieldEvent({
    eventType: 'channel_shield.released',
    severity: 'warning',
    workspaceId: (await getMessage(messageId))!.workspaceId,
    channel: (await getMessage(messageId))!.channel,
    messageId,
    metadata: { actor, approver, dualControl: true },
  });
}
