import { pool } from '../db.js';
import { getRedis } from '../redis.js';
import type { SecurityEventRow } from '../types.js';
import { TelegramAdapter } from './telegram.js';
import { EmailAdapter } from './email.js';
import { SlackAdapter } from './slack.js';
import { SmsAdapter } from './sms.js';
import { DiscordAdapter } from './discord.js';
import { SEVERITY_RANK } from './types.js';
import type { AlertAdapter, AlertChannel, AlertSeverity, SecurityEvent } from './types.js';
import { getChannelsForSeverity } from './routing.js';
import { shouldSuppress } from './throttle.js';
import { scheduleEscalation } from './escalation.js';

const ADAPTERS: Record<string, AlertAdapter> = {
  telegram: new TelegramAdapter(),
  email: new EmailAdapter(),
  slack: new SlackAdapter(),
  sms: new SmsAdapter(),
  discord: new DiscordAdapter(),
};

const DEDUP_WINDOW_SECONDS = 300;
const DEDUP_MAX_ALERTS = 3;

interface AlertChannelRow {
  id: string;
  channel_type: 'telegram' | 'email' | 'slack';
  severity_threshold: AlertSeverity;
  enabled: boolean;
  config: Record<string, string> | null;
}

export function toSecurityEvent(row: SecurityEventRow): SecurityEvent {
  const r = row as unknown as Record<string, unknown>;
  return {
    id: row.id,
    instance_id: row.instance_id ?? 'unknown',
    session_id: row.session_id ?? 'system',
    event_type: row.event_type,
    severity: row.severity as AlertSeverity,
    description: row.description,
    created_at: new Date(row.created_at),
    acknowledged: r.acknowledged === true,
    acknowledged_by: (r.acknowledged_by as string) ?? null,
    acknowledged_at: r.acknowledged_at
      ? new Date(r.acknowledged_at as string)
      : null,
  };
}

function parseChannel(row: AlertChannelRow): AlertChannel {
  const config =
    row.config && typeof row.config === 'object' && !Array.isArray(row.config)
      ? (row.config as Record<string, string>)
      : {};
  return {
    id: row.id,
    channel_type: row.channel_type,
    severity_threshold: row.severity_threshold,
    enabled: row.enabled,
    config,
  };
}

export const alertDispatcher = {
  async dispatch(event: SecurityEvent): Promise<void> {
    const routedChannels = getChannelsForSeverity(event.severity);

    // Throttle check: suppress duplicates within 5 minutes per tenant+severity+type
    const throttleResult = await shouldSuppress(
      event.instance_id,
      event.severity,
      event.event_type,
    );

    if (throttleResult.suppress) {
      console.info(
        `[AlertDispatcher] Throttled: ${event.event_type} on ${event.instance_id} (count=${throttleResult.aggregatedCount})`,
      );
      return;
    }

    // Schedule escalation for critical/breach alerts
    if (event.severity === 'critical' || event.severity === 'breach') {
      scheduleEscalation(event.id, event.severity, event.instance_id, event.description);
    }

    const results = await Promise.allSettled(
      routedChannels.map((ch) => dispatchToChannel(event, { channel_type: ch } as AlertChannel)),
    );

    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        const ch = routedChannels[index];
        console.error(
          `[AlertDispatcher] Channel ${ch} failed:`,
          result.reason,
        );
      }
    });
  },
};

async function dispatchToChannel(event: SecurityEvent, channel: AlertChannel): Promise<void> {
  const redis = getRedis();
  if (redis) {
    const key = `scout:alert-dedup:${event.instance_id}:${event.event_type}`;
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, DEDUP_WINDOW_SECONDS);
    }
    if (count > DEDUP_MAX_ALERTS) {
      console.info(
        `[AlertDispatcher] Dedup suppressed: ${event.event_type} on ${event.instance_id} (count=${count})`,
      );
      return;
    }
  }

  const adapter = ADAPTERS[channel.channel_type];
  if (!adapter) {
    console.warn(`[AlertDispatcher] No adapter found for channel type '${channel.channel_type}'`);
    return;
  }

  await adapter.send(event, channel);
}
