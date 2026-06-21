import type { AlertAdapter, AlertChannel, SecurityEvent } from './types.js';
import { config } from '../config/index.js';

export class EmailAdapter implements AlertAdapter {
  async send(event: SecurityEvent, channel: AlertChannel): Promise<void> {
    const apiKey =
      channel.config.resend_api_key ??
      channel.config.api_key ??
      process.env.SCOUT_RESEND_API_KEY ??
      process.env.RESEND_API_KEY ??
      '';
    const toAddress =
      channel.config.to_address ??
      process.env.SCOUT_ALERT_TO_EMAIL ??
      process.env.ALERT_EMAIL_TO ??
      '';
    const fromAddress =
      channel.config.from_address ??
      process.env.SCOUT_ALERT_FROM_EMAIL ??
      process.env.ALERT_EMAIL_FROM ??
      'hello@carinaai.uk';

    if (!apiKey || !toAddress) {
      throw new Error('Email adapter: missing SCOUT_RESEND_API_KEY or to_address config');
    }

    const subject = `[LABYRINTH] ${event.severity.toUpperCase()}: ${event.event_type}`;
    const html = this.renderHtml(event);

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: fromAddress, to: [toAddress], subject, html }),
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Resend API error ${response.status}: ${body}`);
    }
  }

  private renderHtml(event: SecurityEvent): string {
    const dashboardUrl = config.console.dashboardUrl;
    const severityColor = {
      info: '#3b82f6',
      warning: '#f59e0b',
      critical: '#ef4444',
      breach: '#7c3aed',
    }[event.severity] ?? '#6b7280';

    return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>
  body { margin: 0; padding: 0; background: #0f172a; font-family: 'Courier New', monospace; color: #e2e8f0; }
  .wrapper { max-width: 600px; margin: 32px auto; background: #1e293b; border-radius: 8px; overflow: hidden; }
  .header { background: ${severityColor}; padding: 20px 24px; }
  .header h1 { margin: 0; font-size: 18px; color: #fff; letter-spacing: 1px; }
  .body { padding: 24px; }
  .field { margin-bottom: 12px; }
  .label { font-size: 11px; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; }
  .value { font-size: 14px; color: #e2e8f0; margin-top: 2px; word-break: break-all; }
  .footer { padding: 16px 24px; border-top: 1px solid #334155; }
  .footer a { color: ${severityColor}; text-decoration: none; font-size: 13px; }
</style></head>
<body>
<div class="wrapper">
  <div class="header">
    <h1>LABYRINTH SCOUT - ${event.severity.toUpperCase()}: ${event.event_type}</h1>
  </div>
  <div class="body">
    <div class="field"><div class="label">Instance</div><div class="value">${escapeHtml(event.instance_id)}</div></div>
    <div class="field"><div class="label">Time</div><div class="value">${event.created_at.toISOString()}</div></div>
    <div class="field"><div class="label">Session</div><div class="value">${escapeHtml(event.session_id)}</div></div>
    <div class="field"><div class="label">Description</div><div class="value">${escapeHtml(event.description)}</div></div>
  </div>
  <div class="footer"><a href="${dashboardUrl}">Open Labyrinth Scout Dashboard</a></div>
</div>
</body></html>`;
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
