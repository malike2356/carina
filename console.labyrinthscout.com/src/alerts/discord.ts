import type { AlertAdapter, AlertChannel, SecurityEvent } from './types.js';
import { formatAlert } from './templates.js';

/**
 * Discord alert delivery via webhook.
 * TODO: Consolidate with core.carinaai.uk/src/gateway/channels/adapters/discord-adapter.ts
 * once alerting and gateway share a common transport layer.
 */
export class DiscordAdapter implements AlertAdapter {
  async send(event: SecurityEvent, channel: AlertChannel): Promise<void> {
    const webhookUrl =
      process.env.SCOUT_DISCORD_WEBHOOK_URL ??
      process.env.DISCORD_WEBHOOK_URL ??
      channel.config.webhook_url;

    if (!webhookUrl) {
      throw new Error('Discord adapter: missing SCOUT_DISCORD_WEBHOOK_URL or webhook_url config');
    }

    const content =
      formatAlert('discord', event.severity, event) ??
      `**LABYRINTH ${event.severity.toUpperCase()}**; ${event.event_type}\n> ${event.description}`;

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`Discord webhook error ${response.status}: ${text}`);
    }
  }
}
