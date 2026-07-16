import { pool } from '../db.js';
import { getRedis } from '../redis.js';
import type { SecurityEventRow } from '../types.js';
import { TelegramAdapter } from './telegram.js';
import { EmailAdapter } from './email.js';
import { SlackAdapter } from './slack.js';
import { SmsAdapter } from './sms.js';
import { DiscordAdapter } from './discord.js';
import { WhatsAppAdapter } from './whatsapp.js';
import { SEVERITY_RANK } from './types.js';
import type { AlertAdapter, AlertChannel, AlertSeverity, SecurityEvent } from './types.js';
import { getChannelsForSeverity } from './routing.js';
import { loadDispatchChannels } from '../lib/alert-channels.js';
import { getAccountSubscriptionPlan, isScoutProPlan } from '../lib/subscription-plan.js';
import { shouldSuppress } from './throttle.js';
import { scheduleEscalation } from './escalation.js';
import { getConnectorRouter } from '../connectors/router.js';

const ADAPTERS: Record<string, AlertAdapter> = {
  telegram: new TelegramAdapter(),
  email: new EmailAdapter(),
  slack: new SlackAdapter(),
  sms: new SmsAdapter(),
  discord: new DiscordAdapter(),
  whatsapp: new WhatsAppAdapter(),
};

const DEDUP_WINDOW_SECONDS = 300;
const DEDUP_MAX_ALERTS = 3;

/** Security events that must always notify operators (never throttled). */
export const NEVER_THROTTLE_EVENT_TYPES = new Set([
  'honeypot_triggered',
  'stale_marker_detected',
  'repeated_injection_blocks',
  'risk_score_spike',
  'trust_attestation_failed',
  'trust_verification_failed',
]);

interface AlertChannelRow {
  id: string;
  channel_type: string;
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

function isAdapterChannel(channelType: string): channelType is AlertChannel['channel_type'] {
  return Object.prototype.hasOwnProperty.call(ADAPTERS, channelType);
}

function parseChannel(row: AlertChannelRow): AlertChannel | null {
  if (!isAdapterChannel(row.channel_type)) return null;
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
  async dispatch(
    event: SecurityEvent,
    opts?: { accountId?: string; metadata?: Record<string, unknown> },
  ): Promise<void> {
    if (opts?.accountId) {
      const plan = await getAccountSubscriptionPlan(opts.accountId);
      if (!isScoutProPlan(plan)) {
        return;
      }
    }

    const routedChannels = await loadChannelsForSeverity(event.severity);

    if (!NEVER_THROTTLE_EVENT_TYPES.has(event.event_type)) {
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
    }

    // Schedule escalation for critical/breach alerts
    if (event.severity === 'critical' || event.severity === 'breach') {
      scheduleEscalation(event.id, event.severity, event.instance_id, event.description);
    }

    const results = await Promise.allSettled(
      routedChannels.map((ch) => dispatchToChannel(event, ch)),
    );

    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        const ch = routedChannels[index];
        console.error(
          `[AlertDispatcher] Channel ${ch?.channel_type ?? 'unknown'} failed:`,
          result.reason,
        );
      }
    });

    if (opts?.accountId) {
      const connectorRouter = getConnectorRouter();
      const metadata = opts.metadata ?? {};
      const pushAlert = NEVER_THROTTLE_EVENT_TYPES.has(event.event_type);
      void connectorRouter
        .pushFromSecurityEvent(event, opts.accountId, metadata, { pushAlert })
        .catch((err) => {
          console.error('[AlertDispatcher] Connector routing error:', err);
        });
    }
  },
};

async function loadChannelsForSeverity(severity: AlertSeverity): Promise<AlertChannel[]> {
  try {
    const fromDb = await loadDispatchChannels(severity);
    if (fromDb.length > 0) {
      return fromDb
        .filter((row) => isAdapterChannel(row.channel_type))
        .map((row) => ({
          id: row.id,
          channel_type: row.channel_type,
          severity_threshold: row.severity_threshold,
          enabled: row.enabled,
          config: row.config,
        }));
    }

    const result = await pool.query<AlertChannelRow>(
      `SELECT id, channel_type, severity_threshold, enabled, config
       FROM alert_channels
       WHERE enabled = TRUE`,
    );
    const legacy = result.rows
      .map(parseChannel)
      .filter((channel): channel is AlertChannel => channel !== null)
      .filter((channel) => SEVERITY_RANK[severity] >= SEVERITY_RANK[channel.severity_threshold]);
    if (legacy.length > 0) return legacy;
    return [];
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('[AlertDispatcher] Channel lookup failed; using env fallback:', msg);
  }

  return getChannelsForSeverity(severity)
    .filter(isAdapterChannel)
    .map((channel_type) => ({
      id: `default-${channel_type}`,
      channel_type,
      severity_threshold: severity,
      enabled: true,
      config: {},
    }));
}

async function dispatchToChannel(event: SecurityEvent, channel: AlertChannel): Promise<void> {
  const redis = getRedis();
  if (redis && !NEVER_THROTTLE_EVENT_TYPES.has(event.event_type)) {
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
