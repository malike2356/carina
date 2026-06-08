import type { AlertAdapter, AlertChannel, SecurityEvent } from './types.js';

export class SlackAdapter implements AlertAdapter {
  async send(event: SecurityEvent, channel: AlertChannel): Promise<void> {
    const webhookUrl =
      process.env.SCOUT_SLACK_WEBHOOK_URL ??
      process.env.SLACK_WEBHOOK_URL ??
      channel.config.webhook_url;

    if (!webhookUrl) {
      throw new Error('Slack adapter: missing SCOUT_SLACK_WEBHOOK_URL or webhook_url config');
    }

    const color =
      { info: '#3b82f6', warning: '#f59e0b', critical: '#ef4444', breach: '#7c3aed' }[
        event.severity
      ] ?? '#6b7280';
    const dashboardUrl = process.env.SCOUT_DASHBOARD_URL ?? 'http://localhost:4444';

    const body = {
      attachments: [
        {
          color,
          blocks: [
            {
              type: 'header',
              text: {
                type: 'plain_text',
                text: `LABYRINTH ${event.severity.toUpperCase()}: ${event.event_type}`,
              },
            },
            {
              type: 'section',
              fields: [
                { type: 'mrkdwn', text: `*Instance*\n${event.instance_id}` },
                { type: 'mrkdwn', text: `*Time*\n${event.created_at.toISOString()}` },
                { type: 'mrkdwn', text: `*Session*\n${event.session_id}` },
                { type: 'mrkdwn', text: `*Severity*\n${event.severity}` },
              ],
            },
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `*Description*\n${event.description.slice(0, 500)}`,
              },
            },
            {
              type: 'actions',
              elements: [
                {
                  type: 'button',
                  text: { type: 'plain_text', text: 'Open Dashboard' },
                  url: dashboardUrl,
                },
              ],
            },
          ],
        },
      ],
    };

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      throw new Error(`Slack webhook error ${response.status}`);
    }
  }
}
