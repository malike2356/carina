import { config } from '../../config/index.js';
import { isPassiveReadingEnabledForChannel } from './ambient-channel-settings.js';

function parseList(values: string[]): Set<string> {
  return new Set(values.map((v) => v.trim()).filter(Boolean));
}

export function isSlackAmbientEnabled(): boolean {
  return config.ambient.enabled && config.ambient.slack.passiveReading;
}

export function isChannelAllowedForAmbient(
  channelId: string,
  channelName = '',
): boolean {
  if (!isSlackAmbientEnabled()) return false;

  const excluded = parseList(config.ambient.slack.excludeChannels);
  if (excluded.has(channelId) || (channelName && excluded.has(channelName))) {
    return false;
  }

  const allowed = parseList(config.ambient.slack.allowedChannels);
  if (allowed.size > 0 && !allowed.has(channelId) && !(channelName && allowed.has(channelName))) {
    return false;
  }

  return true;
}

export async function isChannelAllowedForPassiveReading(
  channelId: string,
  channelName = '',
): Promise<boolean> {
  if (!isChannelAllowedForAmbient(channelId, channelName)) return false;
  return isPassiveReadingEnabledForChannel(channelId, channelName);
}
