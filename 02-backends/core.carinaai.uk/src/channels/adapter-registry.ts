import type { ChannelAdapter, AivaChannelName } from './types.js';
import { whatsappAdapter } from './adapters/whatsapp-adapter.js';
import { emailAdapter } from './adapters/email-adapter.js';
import { slackAdapter } from './adapters/slack-adapter.js';
import { telegramAdapter } from './adapters/telegram-adapter.js';
import { webAdapter } from './adapters/web-adapter.js';
import { smsAdapter } from './adapters/sms-adapter.js';
import { discordAdapter } from './adapters/discord-adapter.js';
import { teamsAdapter } from './adapters/teams-adapter.js';
import { linkedinWorkerAdapter } from './adapters/linkedin-worker-adapter.js';
import {
  instagramWorkerAdapter,
  messengerWorkerAdapter,
} from './adapters/meta-worker-adapter.js';
import { twitterWorkerAdapter } from './adapters/twitter-worker-adapter.js';
import { tiktokWorkerAdapter } from './adapters/tiktok-worker-adapter.js';

const adapters = new Map<AivaChannelName, ChannelAdapter>([
  ['whatsapp', whatsappAdapter],
  ['email', emailAdapter],
  ['slack', slackAdapter],
  ['telegram', telegramAdapter],
  ['web', webAdapter],
  ['sms', smsAdapter],
  ['discord', discordAdapter],
  ['teams', teamsAdapter],
  ['linkedin', linkedinWorkerAdapter],
  ['instagram', instagramWorkerAdapter],
  ['messenger', messengerWorkerAdapter],
  ['twitter', twitterWorkerAdapter],
  ['tiktok', tiktokWorkerAdapter],
]);

export function getAdapter(channel: AivaChannelName): ChannelAdapter | undefined {
  return adapters.get(channel);
}

export function listAdapters(): ChannelAdapter[] {
  return [...adapters.values()];
}
