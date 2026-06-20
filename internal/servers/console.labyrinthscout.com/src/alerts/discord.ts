import { sendDiscordWebhook } from '@verlox/carina-transport';
import type { AlertAdapter, AlertChannel, SecurityEvent } from './types.js';
import { formatAlert } from './templates.js';

/**
 * Discord alert delivery via webhook.
 * Uses @verlox/carina-transport for the HTTP send; Scout owns templates and severity routing.
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

    await sendDiscordWebhook(webhookUrl, content);
  }
}
