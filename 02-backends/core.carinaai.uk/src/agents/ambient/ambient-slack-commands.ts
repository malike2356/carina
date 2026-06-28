import { config } from '../../config/index.js';
import {
  getAmbientChannelSettings,
  parseQuietDuration,
  saveAmbientChannelSettings,
  type ChannelResponseMode,
} from './ambient-channel-settings.js';
import { bindChannelAgent } from './channel-agent-bindings.js';

export async function handleAmbientSlashCommand(input: {
  channelId: string;
  channelName: string;
  text: string;
  userId: string;
}): Promise<string> {
  const parts = input.text.trim().split(/\s+/).filter(Boolean);
  const sub = (parts[0] ?? 'status').toLowerCase();
  const settings = await getAmbientChannelSettings(input.channelId, input.channelName);

  switch (sub) {
    case 'on':
      settings.passiveReadingEnabled = true;
      settings.ambientChecksEnabled = true;
      settings.quietUntil = null;
      await saveAmbientChannelSettings(settings);
      return `Ambient mode enabled for ${settings.channelName || input.channelId}.`;

    case 'off':
      settings.passiveReadingEnabled = false;
      settings.ambientChecksEnabled = false;
      await saveAmbientChannelSettings(settings);
      return `Ambient mode disabled for ${settings.channelName || input.channelId}.`;

    case 'quiet': {
      const duration = parts[1] ?? '4h';
      const ms = parseQuietDuration(duration);
      if (!ms) return 'Usage: /ambient quiet 4h (supports h, m, d).';
      settings.quietUntil = new Date(Date.now() + ms).toISOString();
      await saveAmbientChannelSettings(settings);
      return `Ambient checks snoozed until ${settings.quietUntil}.`;
    }

    case 'frequency':
      return `Check interval: ${config.ambient.checkIntervalMs} ms (set CARINA_AMBIENT_CHECK_INTERVAL_MS to change).`;

    case 'dismiss': {
      const checkId = parts[1];
      if (!checkId) return 'Usage: /ambient dismiss <check-id>';
      if (!settings.dismissedCheckIds.includes(checkId)) {
        settings.dismissedCheckIds.push(checkId);
      }
      await saveAmbientChannelSettings(settings);
      return `Dismissed ambient check ${checkId}.`;
    }

    case 'status':
    default:
      return [
        `Ambient status for ${settings.channelName || input.channelId}:`,
        `- passive reading: ${settings.passiveReadingEnabled ? 'on' : 'off'}`,
        `- proactive checks: ${settings.ambientChecksEnabled ? 'on' : 'off'}`,
        `- quiet until: ${settings.quietUntil ?? 'not snoozed'}`,
        `- response mode: ${settings.responseMode}`,
      ].join('\n');
  }
}

export async function handleCarinaChannelConfigCommand(input: {
  channelId: string;
  channelName: string;
  text: string;
}): Promise<string> {
  const parts = input.text.trim().split(/\s+/).filter(Boolean);
  if (parts[0] !== 'channel-config') {
    return 'Usage: /carina channel-config mode thread|channel|ephemeral';
  }

  const settings = await getAmbientChannelSettings(input.channelId, input.channelName);
  const field = parts[1]?.toLowerCase();
  const value = parts[2]?.toLowerCase();

  if (field === 'mode' && value) {
    if (!['thread', 'channel', 'ephemeral'].includes(value)) {
      return 'Mode must be thread, channel, or ephemeral.';
    }
    settings.responseMode = value as ChannelResponseMode;
    await saveAmbientChannelSettings(settings);
    return `Response mode set to ${settings.responseMode}.`;
  }

  if (field === 'broadcast' && value) {
    settings.broadcastOnComplete = value === 'true';
    await saveAmbientChannelSettings(settings);
    return `Broadcast on complete: ${settings.broadcastOnComplete ? 'on' : 'off'}.`;
  }

  if (field === 'mention-required' && value) {
    settings.mentionRequired = value === 'true';
    await saveAmbientChannelSettings(settings);
    return `Mention required: ${settings.mentionRequired ? 'on' : 'off'}.`;
  }

  if (field === 'bind-agent' && value) {
    await bindChannelAgent(input.channelId, input.channelName, value);
    return `Channel bound to agent ${value}.`;
  }

  return [
    'Channel config commands:',
    '/carina channel-config mode thread|channel|ephemeral',
    '/carina channel-config broadcast true|false',
    '/carina channel-config mention-required true|false',
    '/carina channel-config bind-agent <agent-id>',
  ].join('\n');
}
