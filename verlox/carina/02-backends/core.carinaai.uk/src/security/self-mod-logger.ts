import { reportEvent } from './scout-client.js';
import { SELF_MOD_EVENT_TYPES, EVENT_SEVERITY } from './self-mod-events.js';
import { getRedis } from '../memory/redis.js';

export async function logSelfModEvent(
  type: keyof typeof SELF_MOD_EVENT_TYPES,
  detail: Record<string, unknown>,
): Promise<void> {
  const eventType = SELF_MOD_EVENT_TYPES[type];
  const severity = (EVENT_SEVERITY[eventType] ?? 'info') as 'info' | 'warning' | 'critical';

  // Send to Scout via its event API (Scout stores in security_events)
  try {
    await reportEvent({
      severity,
      source: 'carina-self-mod',
      event_type: eventType,
      description: buildDescription(eventType, detail),
      metadata: detail,
      instance_id: process.env.CARINA_INSTANCE_ID ?? 'carina-core',
    });
  } catch {
    // Scout being down must not crash the self-mod pipeline
  }

  // Publish to Redis for real-time SSE delivery to Scout dashboard
  const redis = getRedis();
  if (redis) {
    try {
      await redis.publish('labyrinth:events', JSON.stringify({
        type: eventType,
        severity,
        detail,
        timestamp: new Date().toISOString(),
      }));
    } catch {
      // Non-fatal
    }
  }

  // Critical events: dispatch immediate Telegram alert
  if (severity === 'critical') {
    await dispatchOperatorAlert(eventType, detail).catch(() => undefined);
  }
}

function buildDescription(eventType: string, detail: Record<string, unknown>): string {
  const suffix = detail.tool_name ? ` [tool: ${String(detail.tool_name)}]` : '';
  return `Self-mod: ${eventType}${suffix}`;
}

async function dispatchOperatorAlert(
  eventType: string,
  detail: Record<string, unknown>,
): Promise<void> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_OPERATOR_CHAT_ID;
  if (!botToken || !chatId) return;

  const label = ({
    'tool_gen.auth_lockout':  '[LOCKOUT]',
    'tool.injection_blocked': '[BLOCKED]',
    'tool.rapid_generation':  '[WARNING]',
    'tool.high_risk_pattern': '[CRITICAL]',
    'scout.auto_quarantine':  '[QUARANTINE]',
    'scout.auto_suspend':     '[SUSPEND]',
  } as Record<string, string>)[eventType] ?? '[ALERT]';

  const reason = String(detail.reason ?? detail.warning ?? detail.error ?? '');
  const action = String(detail.action_taken ?? 'None - operator review required.');

  const text = [
    `${label} Scout: ${eventType}`,
    reason ? `Reason: ${reason}` : '',
    `Action: ${action}`,
    `Tool: ${String(detail.tool_name ?? 'N/A')}`,
    `Time: ${new Date().toISOString()}`,
    `Instance: ${String(detail.instance_id ?? process.env.CARINA_INSTANCE_ID ?? 'carina-core')}`,
  ].filter(Boolean).join('\n');

  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
  } catch {
    // Non-fatal
  }

  await logSelfModEvent('SCOUT_ALERT_SENT', {
    event_type: eventType,
    channel: 'telegram',
    chat_id: chatId,
  }).catch(() => undefined);
}
