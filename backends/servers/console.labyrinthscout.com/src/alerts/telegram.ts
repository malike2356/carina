import type { AlertAdapter, AlertChannel, SecurityEvent } from './types.js';
import { config } from '../config/index.js';
import { findPlaybook } from '../actions/playbook-registry.js';

const EVENT_TYPE_LABELS: Record<string, string> = {
  alert_test: 'Test alert',
  alert_escalated: 'Alert not yet reviewed',
  anomaly_detected: 'Unusual activity detected',
  breach_detected: 'Security breach',
  threat_detected: 'Potential threat',
  killswitch_armed: 'Agent halt armed',
  killswitch_disarmed: 'Agent halt lifted',
  session_terminated: 'Session ended by Labyrinth',
};

const SEVERITY_LABELS: Record<string, string> = {
  info: 'Notice',
  warning: 'Warning',
  critical: 'Alert',
  breach: 'Security Breach',
};

const METRIC_DESCRIPTIONS: Record<string, string> = {
  uniquetoolsused: 'unique tools used per session',
  avgresponselength: 'average response length',
  messagecount: 'messages per session',
  tokensperminute: 'tokens per minute',
  toolerrorrate: 'tool error rate',
  sessionduration: 'session duration',
  failedauths: 'failed authentication attempts',
};

function escHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function humanizeEventType(eventType: string): string {
  return (
    EVENT_TYPE_LABELS[eventType] ??
    eventType.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase())
  );
}

interface AnomalyPayload {
  metricName?: string;
  zScore?: number;
  currentValue?: number;
  baselineMean?: number;
}

function parseAnomalyDescription(raw: string): string | null {
  try {
    const data = JSON.parse(raw) as AnomalyPayload;
    if (!data.metricName) return null;

    const metricLabel =
      METRIC_DESCRIPTIONS[data.metricName.toLowerCase()] ??
      data.metricName.replace(/_/g, ' ');

    const current =
      typeof data.currentValue === 'number'
        ? data.currentValue % 1 === 0
          ? String(data.currentValue)
          : data.currentValue.toFixed(2)
        : null;

    const baseline =
      typeof data.baselineMean === 'number' ? data.baselineMean.toFixed(2) : null;

    const deviation =
      typeof data.zScore === 'number'
        ? data.zScore > 5
          ? 'far outside normal range'
          : data.zScore > 3
            ? 'outside normal range'
            : 'slightly above normal'
        : 'outside normal range';

    let summary = `Carina's ${metricLabel} is ${deviation}.`;
    if (current !== null && baseline !== null) {
      summary += ` Current value: ${current} (expected around ${baseline}).`;
    }
    return summary;
  } catch {
    return null;
  }
}

function buildSummary(event: SecurityEvent): string {
  const raw = event.description;
  const cleanRaw = raw.replace(/^UNACKNOWLEDGED;\s*ESCALATING:\s*/i, '').trim();

  if (event.event_type === 'alert_test') {
    return 'This is a test notification confirming that Labyrinth alerts are working correctly.';
  }

  if (event.event_type === 'alert_escalated') {
    const inner = cleanRaw ? ` The original alert reported: ${cleanRaw}` : '';
    return (
      'An earlier alert has not been acknowledged. Labyrinth is following up' +
      ' to make sure someone reviews it.' +
      inner
    );
  }

  if (event.event_type === 'anomaly_detected') {
    const parsed = parseAnomalyDescription(cleanRaw);
    if (parsed) return parsed;
  }

  return cleanRaw || 'Labyrinth detected an event that requires attention.';
}

function friendlyTime(date: Date): string {
  try {
    return (
      date.toLocaleString('en-GB', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'UTC',
      }) + ' UTC'
    );
  } catch {
    return date.toTimeString().slice(0, 8);
  }
}

function shortenDesc(desc: string, maxLen = 60): string {
  if (desc.length <= maxLen) return desc;
  const cut = desc.slice(0, maxLen);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > 20 ? cut.slice(0, lastSpace) : cut) + '...';
}

function buildActionGuidance(event: SecurityEvent): string {
  const playbook = findPlaybook(event.event_type, event.severity);
  if (!playbook) return '';

  if (playbook.category === 'monitor') {
    return 'No action needed. This is for your awareness only.';
  }

  if (playbook.category === 'auto') {
    const autoActions = playbook.actions
      .filter((a) => a.type === 'button')
      .map((a) => a.label)
      .slice(0, 3);
    if (autoActions.length === 0) return '';
    return 'Labyrinth has already: ' + autoActions.join(', ') + '.';
  }

  if (playbook.category === 'human') {
    const topActions = playbook.actions.slice(0, 3);
    if (topActions.length === 0) return '';

    const lines = topActions.map((a) => {
      const prefix = a.destructive ? 'High impact: ' : '';
      return prefix + a.label + ' - ' + shortenDesc(a.description);
    });

    return 'What you can do:\n' + lines.map((l) => '- ' + l).join('\n');
  }

  return '';
}

export class TelegramAdapter implements AlertAdapter {
  async send(event: SecurityEvent, channel: AlertChannel): Promise<void> {
    const token =
      process.env.SCOUT_TELEGRAM_BOT_TOKEN ??
      process.env.TELEGRAM_BOT_TOKEN ??
      channel.config.bot_token;
    const chatId =
      process.env.SCOUT_TELEGRAM_CHAT_ID ??
      process.env.TELEGRAM_CHAT_ID ??
      channel.config.chat_id;

    if (!token || !chatId) {
      throw new Error('Telegram adapter: missing bot_token or chat_id');
    }

    const text = this.formatMessage(event);
    const url = `https://api.telegram.org/bot${token}/sendMessage`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        link_preview_options: { is_disabled: true },
      }),
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Telegram API error ${response.status}: ${body}`);
    }
  }

  formatMessage(event: SecurityEvent): string {
    const dashboardUrl = config.console.dashboardUrl;
    const severityLabel = SEVERITY_LABELS[event.severity] ?? event.severity.toUpperCase();
    const eventLabel = humanizeEventType(event.event_type);
    const summary = buildSummary(event);
    const guidance = buildActionGuidance(event);
    const time = friendlyTime(event.created_at);

    const rawDesc =
      event.description.length > 400
        ? event.description.slice(0, 397) + '...'
        : event.description;

    const techDetails = [
      `Type: ${event.event_type}`,
      `Severity: ${event.severity}`,
      `Instance: ${event.instance_id}`,
      `Session: ${event.session_id}`,
      `Raw: ${rawDesc}`,
    ].join('\n');

    const parts: string[] = [
      `<b>${escHtml(severityLabel)}: ${escHtml(eventLabel)}</b>`,
      '',
      escHtml(summary),
    ];

    if (guidance) {
      parts.push('');
      parts.push(escHtml(guidance));
    }

    parts.push('');
    parts.push(`<i>${escHtml(time)}</i>`);
    parts.push(`<a href="${escHtml(dashboardUrl + '/dashboard?tab=actions')}">Review in Labyrinth dashboard</a>`);
    parts.push('');
    parts.push(`<tg-spoiler>Technical details:\n${escHtml(techDetails)}</tg-spoiler>`);

    return parts.join('\n');
  }
}
