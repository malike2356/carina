import type { ChannelShieldAdapter, ShieldChannel } from '../types.js';
import { emailShieldAdapter } from './email-adapter.js';
import { slackShieldAdapter } from './slack-adapter.js';
import { teamsShieldAdapter } from './teams-adapter.js';
import { telegramShieldAdapter } from './telegram-adapter.js';
import { whatsappShieldAdapter } from './whatsapp-adapter.js';
import { discordShieldAdapter } from './discord-adapter.js';
import { smsShieldAdapter } from './sms-adapter.js';
import { webShieldAdapter } from './web-adapter.js';

const adapters: Record<ShieldChannel, ChannelShieldAdapter> = {
  email: emailShieldAdapter,
  slack: slackShieldAdapter,
  teams: teamsShieldAdapter,
  telegram: telegramShieldAdapter,
  whatsapp: whatsappShieldAdapter,
  discord: discordShieldAdapter,
  sms: smsShieldAdapter,
  web: webShieldAdapter,
};

export function getShieldAdapter(channel: ShieldChannel | string): ChannelShieldAdapter {
  const adapter = adapters[channel as ShieldChannel];
  if (!adapter) throw new Error(`No Channel Shield adapter for ${channel}`);
  return adapter;
}

export function listShieldAdapters(): ChannelShieldAdapter[] {
  return Object.values(adapters);
}

export async function shieldAdaptersHealth(): Promise<
  Array<{ channel: ShieldChannel; ok: boolean; detail: string }>
> {
  const out: Array<{ channel: ShieldChannel; ok: boolean; detail: string }> = [];
  for (const a of listShieldAdapters()) {
    try {
      const h = await a.health();
      out.push({ channel: a.channel, ...h });
    } catch (err) {
      out.push({
        channel: a.channel,
        ok: false,
        detail: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return out;
}
