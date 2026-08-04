import { mergeEnvLines, carinaEnvPath } from '../cli/provider-bootstrap.js';
import { recommendedChannelSecurityEnvLines } from './gateway-exposure.js';

const MESSENGER_STARTER_CHANNELS = new Set([
  'telegram',
  'discord',
  'slack',
  'whatsapp',
]);

export function starterChannelNeedsSecurityDefaults(channel: string): boolean {
  return MESSENGER_STARTER_CHANNELS.has(channel);
}

export async function persistChannelSecurityDefaults(
  channel: string,
  envPath = carinaEnvPath(),
): Promise<string[]> {
  if (!starterChannelNeedsSecurityDefaults(channel)) return [];
  const lines = recommendedChannelSecurityEnvLines();
  await mergeEnvLines(lines, envPath);
  for (const line of lines) {
    const [key, value] = line.split('=');
    if (key && value !== undefined) process.env[key] = value;
  }
  return lines;
}
