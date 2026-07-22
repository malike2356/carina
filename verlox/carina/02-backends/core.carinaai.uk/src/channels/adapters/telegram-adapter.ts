import fs from 'node:fs/promises';
import path from 'node:path';
import type { ChannelAdapter, InboundMessage, OutboundMessage } from '../types.js';
import {
  stripSpeakDirective,
  wantsSpokenReply,
} from '../../gateway/telegram-audio.js';

interface TelegramUpdate {
  message?: {
    message_id: number;
    text?: string;
    date: number;
    from?: { id: number; first_name?: string; username?: string };
    chat: { id: number; type: string };
  };
}

const MEDIA_PATH_RE =
  /(?:MEDIA:\s*)?((?:\.\/)?data\/tts\/[a-f0-9-]+\.mp3)\b/gi;

function extractMediaPaths(text: string): string[] {
  const found: string[] = [];
  for (const match of text.matchAll(MEDIA_PATH_RE)) {
    const p = match[1]?.trim();
    if (p && !found.includes(p)) found.push(p);
  }
  return found;
}

function stripMediaArtifacts(text: string): string {
  return text
    .replace(/\[Listen to audio[^\]]*\]\([^)]*data\/tts\/[^)]+\)/gi, '')
    .replace(MEDIA_PATH_RE, '')
    .replace(/MEDIA:\s*/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function resolveExistingMediaPath(relativeOrAbsolute: string): Promise<string | null> {
  const candidates = [
    relativeOrAbsolute,
    path.resolve(process.cwd(), relativeOrAbsolute),
    path.resolve(process.cwd(), relativeOrAbsolute.replace(/^\.\//, '')),
  ];
  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      /* try next */
    }
  }
  return null;
}

export const telegramAdapter: ChannelAdapter = {
  channel: 'telegram',

  verify(headers) {
    const secret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
    if (!secret) return process.env.NODE_ENV !== 'production';
    return headers['x-telegram-bot-api-secret-token'] === secret;
  },

  parse(payload, workerId, workspaceId): InboundMessage | null {
    const update = payload as TelegramUpdate;
    const msg = update.message;
    if (!msg?.text || !msg.from || !msg.chat) return null;
    if (msg.chat.type !== 'private') return null;

    const rawText = msg.text.trim();
    const preferAudio = wantsSpokenReply(rawText);
    const stripped = preferAudio ? stripSpeakDirective(rawText) : rawText;
    // Keep enough task text for the LLM; never reduce a voice ask to a tiny stub.
    const content =
      preferAudio && stripped.trim().length >= 8
        ? stripped
        : rawText;

    return {
      channel: 'telegram',
      workerId,
      workspaceId,
      contactId: String(msg.chat.id),
      contactName: msg.from.first_name ?? msg.from.username,
      content,
      rawPayload: payload,
      timestamp: new Date(msg.date * 1000),
      threadId: String(msg.message_id),
      metadata: preferAudio
        ? { preferAudio: 'true', rawUserText: rawText }
        : undefined,
    };
  },

  async send(message: OutboundMessage, credentials: Record<string, string>): Promise<void> {
    const botToken = credentials.bot_token ?? credentials.token;
    if (!botToken) throw new Error('Telegram credentials missing bot_token');

    const preferAudio = message.metadata?.preferAudio === 'true';
    const mediaPaths = extractMediaPaths(message.content);
    let audioSent = false;

    // Prefer uploading tool-generated MEDIA files when present.
    for (const mediaPath of mediaPaths) {
      const absolute = await resolveExistingMediaPath(mediaPath);
      if (!absolute) continue;
      try {
        const { sendTelegramAudioFile } = await import('../../workers/summary-tts.js');
        await sendTelegramAudioFile(botToken, message.contactId, absolute, 'Voice reply');
        audioSent = true;
        break;
      } catch (err) {
        console.warn(
          '[telegram-adapter] MEDIA upload failed:',
          err instanceof Error ? err.message : String(err),
        );
      }
    }

    if (!audioSent && preferAudio) {
      audioSent = await sendTelegramSpokenOutbound({
        botToken,
        chatId: message.contactId,
        text: stripMediaArtifacts(message.content),
      });
      if (audioSent) return;
    }

    if (audioSent && preferAudio) {
      // Voice request satisfied; do not also dump paths / listen links as text.
      return;
    }

    const textOut = stripMediaArtifacts(message.content);
    if (!textOut) {
      if (audioSent) return;
      throw new Error('Telegram send skipped: empty text after media strip');
    }

    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: message.contactId,
        text: textOut,
        ...(message.replyToThreadId ? { reply_to_message_id: Number(message.replyToThreadId) } : {}),
      }),
    });

    const result = await response.json() as { ok?: boolean; description?: string };
    if (!result.ok) throw new Error(`Telegram send failed: ${result.description ?? 'unknown'}`);
  },
};

async function sendTelegramSpokenOutbound(input: {
  botToken: string;
  chatId: string;
  text: string;
}): Promise<boolean> {
  const speechSource = input.text.trim();
  if (!speechSource || speechSource.length < 12) return false;
  try {
    const { buildVoiceScript } = await import('../../gateway/telegram-audio.js');
    const {
      synthesizeSummaryAudio,
      sendTelegramAudioFile,
    } = await import('../../workers/summary-tts.js');

    const speechText = await buildVoiceScript(speechSource);
    const { filePath, cleanup } = await synthesizeSummaryAudio(speechText);
    try {
      await sendTelegramAudioFile(
        input.botToken,
        input.chatId,
        filePath,
        'Voice reply',
      );
    } finally {
      await cleanup();
    }
    return true;
  } catch (err) {
    console.warn(
      '[telegram-adapter] spoken reply failed, falling back to text:',
      err instanceof Error ? err.message : String(err),
    );
    return false;
  }
}

export async function registerTelegramWebhook(botToken: string, workerId: string): Promise<void> {
  const coreUrl = (process.env.CORE_URL ?? process.env.CARINA_CORE_URL ?? 'https://core.carinaai.uk').replace(/\/$/, '');
  const webhookUrl = `${coreUrl}/api/channels/webhook/telegram/${workerId}`;
  const commands = [
    { command: 'start', description: 'Start or resume the conversation' },
    { command: 'help', description: 'Show what this Aiva can do' },
    { command: 'research', description: 'Run research and save it to the workspace' },
    { command: 'document', description: 'Create a document in the workspace' },
    { command: 'schedule', description: 'Create a scheduled task or reminder' },
    { command: 'memory', description: 'Show or update what Aiva should remember' },
    { command: 'handoff', description: 'Ask for human help' },
  ];
  const response = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: webhookUrl,
      allowed_updates: ['message'],
      secret_token: process.env.TELEGRAM_WEBHOOK_SECRET,
    }),
  });
  const result = await response.json() as { ok?: boolean; description?: string };
  if (!result.ok) {
    throw new Error(`Telegram webhook registration failed: ${result.description ?? 'unknown'}`);
  }
  try {
    await fetch(`https://api.telegram.org/bot${botToken}/setMyCommands`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commands }),
    });
    await fetch(`https://api.telegram.org/bot${botToken}/setChatMenuButton`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ menu_button: { type: 'commands' } }),
    });
  } catch (err) {
    console.warn(
      '[telegram-adapter] command menu registration failed:',
      err instanceof Error ? err.message : String(err),
    );
  }
}

export function telegramBotIdFromToken(token: string): string {
  return token.split(':')[0] ?? token;
}

export async function sendTelegramChatAction(input: {
  botToken: string;
  chatId: string;
  action?: 'typing' | 'upload_voice';
}): Promise<void> {
  const response = await fetch(`https://api.telegram.org/bot${input.botToken}/sendChatAction`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: input.chatId,
      action: input.action ?? 'typing',
    }),
  });
  const result = await response.json() as { ok?: boolean; description?: string };
  if (!result.ok) {
    throw new Error(`Telegram chat action failed: ${result.description ?? 'unknown'}`);
  }
}
