import type { AlertAdapter, AlertChannel, SecurityEvent } from './types.js';
import { config } from '../config/index.js';
import { findPlaybook } from '../actions/playbook-registry.js';
import { firstEnvValue } from '../lib/env-fallback.js';

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

const METRIC_PLAIN: Record<string, string> = {
  uniquetoolsused: 'number of tools used in a session',
  avgresponselength: 'length of replies',
  messagecount: 'number of messages in a session',
  tokensperminute: 'speed of processing',
  toolerrorrate: 'rate of tool failures',
  sessionduration: 'how long a session lasted',
  failedauths: 'failed login attempts',
  hour_utc: 'time of day when active',
};

const METRIC_CONTEXT: Record<string, string> = {
  uniquetoolsused:
    'Tools let Carina search the web, read files, run code, and more. A sudden spike may mean an intensive task or unexpected automation.',
  avgresponselength:
    'Unusually long replies can indicate verbose output from a tool, data exfiltration attempts, or a stuck loop.',
  messagecount:
    'A high message count in one session may indicate an automated script interacting with Carina rather than a human.',
  tokensperminute:
    'Processing significantly faster than normal may indicate automated input rather than a human typing.',
  toolerrorrate:
    'A high error rate may mean Carina is attempting actions it does not have permission for, or is in an unexpected state.',
  sessionduration: 'A very long session may indicate an unattended automated run.',
  failedauths:
    'Multiple failed logins may indicate a brute-force attempt on the API.',
  hour_utc:
    'Carina is active outside the hours it normally sees traffic. If you were using it at this time, this is expected.',
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
  anomalyType?: string;
  metricName?: string;
  zScore?: number;
  currentValue?: number;
  baselineMean?: number;
  autoAction?: string;
}

function formatHour(h: number): string {
  const suffix = h < 12 ? 'AM' : 'PM';
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hour12}:00 ${suffix}`;
}

function parseAnomalyDescription(raw: string): string {
  try {
    const data = JSON.parse(raw) as AnomalyPayload;

    if (data.anomalyType === 'unusual_hours' && typeof data.currentValue === 'number') {
      const hourLabel = formatHour(data.currentValue);
      const context = METRIC_CONTEXT['hour_utc'] ?? '';
      return `Carina was active at ${hourLabel} UTC. This is outside the hours when it normally runs.\n\n${context}`;
    }

    if (!data.metricName) {
      return 'Labyrinth detected an unusual pattern. Check the technical details below for specifics.';
    }

    const key = data.metricName.toLowerCase();
    const metricLabel = METRIC_PLAIN[key] ?? data.metricName.replace(/_/g, ' ');
    const context = METRIC_CONTEXT[key] ?? '';

    const current = typeof data.currentValue === 'number' ? data.currentValue : null;
    const baseline = typeof data.baselineMean === 'number' ? data.baselineMean : null;

    let main: string;

    if (current !== null && baseline !== null && baseline > 0) {
      const multiplier = current / baseline;
      const currentStr = current % 1 === 0 ? String(current) : current.toFixed(2);
      const baselineStr = baseline < 1 ? baseline.toFixed(2) : baseline.toFixed(1);
      const multiplierStr =
        multiplier >= 10 ? `${Math.round(multiplier)}x` : `${multiplier.toFixed(1)}x`;
      main = `Carina's ${metricLabel} was ${currentStr} in this session. The usual level is about ${baselineStr}, so this is roughly ${multiplierStr} higher than normal.`;
    } else if (current !== null) {
      const deviation =
        typeof data.zScore === 'number'
          ? data.zScore > 5
            ? 'much higher than normal'
            : data.zScore > 3
              ? 'higher than normal'
              : 'slightly higher than normal'
          : 'higher than normal';
      const currentStr = current % 1 === 0 ? String(current) : current.toFixed(2);
      main = `Carina's ${metricLabel} was ${currentStr}, which is ${deviation}.`;
    } else {
      main = `Carina's ${metricLabel} is outside the normal range.`;
    }

    return context ? `${main}\n\n${context}` : main;
  } catch {
    return 'Labyrinth detected an unusual pattern. Check the technical details below for specifics.';
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
      firstEnvValue('SCOUT_TELEGRAM_BOT_TOKEN', 'TELEGRAM_BOT_TOKEN')
      ?? channel.config.bot_token?.trim();
    const chatId =
      firstEnvValue('SCOUT_TELEGRAM_CHAT_ID', 'TELEGRAM_CHAT_ID')
      ?? channel.config.chat_id?.trim();

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
