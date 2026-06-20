import type { AlertAdapter, AlertChannel, SecurityEvent } from './types.js';

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
        parse_mode: 'Markdown',
      }),
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Telegram API error ${response.status}: ${body}`);
    }
  }

  formatMessage(event: SecurityEvent): string {
    const time = event.created_at.toTimeString().slice(0, 8);
    const dashboardUrl = process.env.SCOUT_DASHBOARD_URL ?? 'http://localhost:4444';

    const isBreach = event.severity === 'breach';
    const severityIcon = isBreach
      ? 'BREACH'
      : event.severity === 'critical'
        ? 'CRITICAL'
        : event.severity.toUpperCase();
    const breachPrefix = isBreach ? '*BREACH DETECTED*\n\n' : '';

    const description =
      event.description.length > 300
        ? event.description.slice(0, 297) + '...'
        : event.description;

    const lines = [
      `${breachPrefix}*LABYRINTH ${severityIcon} -- ${event.event_type}*`,
      `---`,
      `Instance: ${event.instance_id}`,
      `Time: ${time}`,
      `Description: ${description}`,
      `Session: ${event.session_id}`,
      `---`,
      `Dashboard: ${dashboardUrl}`,
    ];

    return lines.join('\n');
  }
}
