import type { SlashCommand } from './registry.js';
import type { ChannelMessage } from '../channel-adapter.interface.js';
import {
  getTelegramChatPrefs,
  setPreferVoiceReplies,
} from '../../telegram-prefs.js';
import { prefersTelegramVoiceReplies } from '../../telegram-audio.js';

function parseVoiceArg(msg: ChannelMessage): string | null {
  const parts = msg.text.trim().split(/\s+/);
  return parts[1]?.toLowerCase() ?? null;
}

function formatOnOff(value: boolean): string {
  return value ? 'on' : 'off';
}

export const voiceCommand: SlashCommand = {
  name: 'voice',
  description: 'Show voice reply preference',
  async handler(msg) {
    const chatId = msg.conversationId;
    const arg = parseVoiceArg(msg);
    if (!arg) {
      const prefs = await getTelegramChatPrefs(chatId);
      const on = prefersTelegramVoiceReplies({ preferVoiceReplies: prefs.preferVoiceReplies });
      return [
        `Prefer voice replies: ${formatOnOff(on)}`,
        '',
        'Pick from the Telegram menu:',
        '/voice_on  - send longer answers as voice',
        '/voice_off - text replies only',
      ].join('\n');
    }

    if (arg === 'on' || arg === 'enable' || arg === 'true' || arg === '1') {
      await setPreferVoiceReplies(chatId, true);
      return 'Prefer voice replies: on. Longer answers and summarise/tell-me asks will be sent as Telegram voice.';
    }
    if (arg === 'off' || arg === 'disable' || arg === 'false' || arg === '0') {
      await setPreferVoiceReplies(chatId, false);
      return 'Prefer voice replies: off. Replies will be sent as text unless you explicitly ask for voice.';
    }

    return 'Unknown option. Use /voice_on or /voice_off from the Telegram menu.';
  },
};

export const voiceOnCommand: SlashCommand = {
  name: 'voice-on',
  description: 'Turn voice replies on',
  async handler(msg) {
    await setPreferVoiceReplies(msg.conversationId, true);
    return 'Prefer voice replies: on. Longer answers and summarise/tell-me asks will be sent as Telegram voice.';
  },
};

export const voiceOffCommand: SlashCommand = {
  name: 'voice-off',
  description: 'Turn voice replies off',
  async handler(msg) {
    await setPreferVoiceReplies(msg.conversationId, false);
    return 'Prefer voice replies: off. Replies will be sent as text unless you explicitly ask for voice.';
  },
};

export const configCommand: SlashCommand = {
  name: 'config',
  description: 'Show Telegram toggles for this chat',
  async handler(msg) {
    const prefs = await getTelegramChatPrefs(msg.conversationId);
    const voiceOn = prefersTelegramVoiceReplies({ preferVoiceReplies: prefs.preferVoiceReplies });
    return [
      'Carina Telegram config:',
      '',
      `Chat: ${msg.conversationId}`,
      `Prefer voice replies: ${formatOnOff(voiceOn)}  (/voice_on or /voice_off)`,
      `BYOK owner claimed: ${prefs.byokOwnerUserId ? 'yes' : 'no'}  (/byok claim)`,
      '',
      'Tip: /byok set <provider> <api_key> for bring-your-own LLM keys.',
    ].join('\n');
  },
};
