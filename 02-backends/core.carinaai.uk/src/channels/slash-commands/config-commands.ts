import type { SlashCommand } from './registry.js';
import { getWorkerById, updateWorker } from '../../workers/worker-store.js';
import { prefersTelegramVoiceReplies } from '../../gateway/telegram-audio.js';
import { getSocialSettings } from '../../ingestion/social/social-settings-store.js';
import type { InboundMessage } from '../types.js';
import type { WorkerConfig } from '../../types/index.js';
import {
  isWorkerIncognito,
  setWorkerIncognito,
} from '../../workers/incognito.js';

function parseToggleArg(msg: InboundMessage): string | null {
  const parts = (msg.content?.trim() ?? '').split(/\s+/);
  return parts[1]?.toLowerCase() ?? null;
}

function formatOnOff(value: boolean): string {
  return value ? 'on' : 'off';
}

async function loadWorkerOrError(workerId: string): Promise<
  { worker: NonNullable<Awaited<ReturnType<typeof getWorkerById>>> } | { error: string }
> {
  const worker = await getWorkerById(workerId);
  if (!worker) return { error: 'Worker not found.' };
  return { worker };
}

export async function setPreferVoiceReplies(
  workerId: string,
  workspaceId: string,
  preferVoiceReplies: boolean,
): Promise<string> {
  const loaded = await loadWorkerOrError(workerId);
  if ('error' in loaded) return loaded.error;
  const { worker } = loaded;

  const current = (worker.workerConfig ?? {}) as WorkerConfig;
  const nextConfig: WorkerConfig = {
    ...current,
    telegram: {
      ...(current.telegram ?? {}),
      preferVoiceReplies,
    },
  };

  await updateWorker(workspaceId, workerId, { workerConfig: nextConfig });
  return preferVoiceReplies
    ? 'Prefer voice replies: on. Longer answers and summarise/tell-me asks will be sent as Telegram voice.'
    : 'Prefer voice replies: off. Replies will be sent as text unless you explicitly ask for voice.';
}

function sessionOpts(msg: InboundMessage) {
  return {
    channel: msg.channel,
    contactId: msg.contactId,
  };
}

export const voiceCommand: SlashCommand = {
  name: 'voice',
  description: 'Show voice reply preference',
  async handler(msg, workerId) {
    const arg = parseToggleArg(msg);
    if (!arg) {
      const loaded = await loadWorkerOrError(workerId);
      if ('error' in loaded) return loaded.error;
      const on = prefersTelegramVoiceReplies(loaded.worker.workerConfig?.telegram);
      return [
        `Prefer voice replies: ${formatOnOff(on)}`,
        '',
        'Pick from the Telegram menu:',
        '/voice_on  - send longer answers as voice',
        '/voice_off - text replies only',
      ].join('\n');
    }

    if (arg === 'on' || arg === 'enable' || arg === 'true' || arg === '1') {
      return setPreferVoiceReplies(workerId, msg.workspaceId, true);
    }
    if (arg === 'off' || arg === 'disable' || arg === 'false' || arg === '0') {
      return setPreferVoiceReplies(workerId, msg.workspaceId, false);
    }

    return 'Unknown option. Use /voice_on or /voice_off from the Telegram menu.';
  },
};

export const voiceOnCommand: SlashCommand = {
  name: 'voice-on',
  description: 'Turn voice replies on',
  async handler(msg, workerId) {
    return setPreferVoiceReplies(workerId, msg.workspaceId, true);
  },
};

export const voiceOffCommand: SlashCommand = {
  name: 'voice-off',
  description: 'Turn voice replies off',
  async handler(msg, workerId) {
    return setPreferVoiceReplies(workerId, msg.workspaceId, false);
  },
};

export const incognitoCommand: SlashCommand = {
  name: 'incognito',
  description: 'Show or set incognito (do not save chats)',
  async handler(msg, workerId) {
    const arg = parseToggleArg(msg);
    if (!arg) {
      const loaded = await loadWorkerOrError(workerId);
      if ('error' in loaded) return loaded.error;
      const on = isWorkerIncognito(loaded.worker.workerConfig);
      return [
        `Incognito: ${formatOnOff(on)}`,
        '',
        on
          ? 'Chats are not saved on our servers right now.'
          : 'Chats are saved as usual.',
        '',
        '/incognito_on  - stop saving this Aiva\'s chats',
        '/incognito_off - save chats again',
      ].join('\n');
    }

    if (arg === 'on' || arg === 'enable' || arg === 'true' || arg === '1') {
      return setWorkerIncognito(workerId, msg.workspaceId, true, sessionOpts(msg));
    }
    if (arg === 'off' || arg === 'disable' || arg === 'false' || arg === '0') {
      return setWorkerIncognito(workerId, msg.workspaceId, false, sessionOpts(msg));
    }

    return 'Unknown option. Use /incognito_on or /incognito_off.';
  },
};

export const incognitoOnCommand: SlashCommand = {
  name: 'incognito-on',
  description: 'Turn incognito on (do not save chats)',
  async handler(msg, workerId) {
    return setWorkerIncognito(workerId, msg.workspaceId, true, sessionOpts(msg));
  },
};

export const incognitoOffCommand: SlashCommand = {
  name: 'incognito-off',
  description: 'Turn incognito off (save chats again)',
  async handler(msg, workerId) {
    return setWorkerIncognito(workerId, msg.workspaceId, false, sessionOpts(msg));
  },
};

export const configCommand: SlashCommand = {
  name: 'config',
  description: 'Show current Aiva toggles for this chat',
  async handler(msg, workerId) {
    const loaded = await loadWorkerOrError(workerId);
    if ('error' in loaded) return loaded.error;
    const { worker } = loaded;
    const social = await getSocialSettings(msg.workspaceId);
    const voiceOn = prefersTelegramVoiceReplies(worker.workerConfig?.telegram);
    const incognitoOn = isWorkerIncognito(worker.workerConfig);

    return [
      `Config for ${worker.name}:`,
      '',
      `Status: ${worker.status}`,
      `Prefer voice replies: ${formatOnOff(voiceOn)}  (/voice_on or /voice_off)`,
      `Incognito: ${formatOnOff(incognitoOn)}  (/incognito_on or /incognito_off)`,
      `Social require approval: ${formatOnOff(social.socialRequireApproval)}`,
      `Social auto-reply allowlist: ${formatOnOff(social.socialAutoReplyEnabled)}`,
      '',
      'Tip: open Aiva settings in the app for the full checkbox list.',
    ].join('\n');
  },
};
