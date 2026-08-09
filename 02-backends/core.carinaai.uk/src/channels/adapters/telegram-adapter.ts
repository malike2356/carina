import fs from 'node:fs/promises';
import path from 'node:path';
import type { ChannelAdapter, InboundMessage, OutboundMessage } from '../types.js';
import {
  chunkTelegramOutbound,
  markdownToTelegramReadable,
} from '../../gateway/telegram-format.js';
import {
  stripSpeakDirective,
  wantsSpokenReply,
} from '../../gateway/telegram-audio.js';
import { listCommands } from '../slash-commands/registry.js';
import '../slash-commands/index.js';

interface TelegramMessageEntity {
  type: string;
  offset: number;
  length: number;
}

interface TelegramUpdate {
  message?: {
    message_id: number;
    text?: string;
    caption?: string;
    date: number;
    entities?: TelegramMessageEntity[];
    caption_entities?: TelegramMessageEntity[];
    from?: { id: number; first_name?: string; username?: string; is_bot?: boolean };
    chat: { id: number; type: string };
    reply_to_message?: {
      from?: { id: number; username?: string; is_bot?: boolean };
    };
    document?: {
      file_id: string;
      file_name?: string;
      mime_type?: string;
      file_size?: number;
    };
    photo?: Array<{ file_id: string; file_size?: number; width?: number; height?: number }>;
  };
}

const botUsernameCache = new Map<string, { username: string; expiresAt: number }>();

/** Resolve @username for a bot token (cached). Used for war-room group mention gating. */
export async function resolveTelegramBotUsername(botToken: string): Promise<string | null> {
  const token = botToken.trim();
  if (!token) return null;
  const cached = botUsernameCache.get(token);
  if (cached && cached.expiresAt > Date.now()) return cached.username;
  try {
    const result = await callTelegramApi(token, 'getMe', {});
    const username = String((result.result as { username?: string } | undefined)?.username ?? '')
      .replace(/^@/, '')
      .toLowerCase();
    if (!username) return null;
    botUsernameCache.set(token, { username, expiresAt: Date.now() + 60 * 60_000 });
    return username;
  } catch (err) {
    console.warn(
      '[telegram-adapter] getMe failed:',
      err instanceof Error ? err.message : String(err),
    );
    return null;
  }
}

/**
 * Whether a group/supergroup update is directed at this worker bot.
 * With BotFather privacy ON, Telegram already filters; this still protects
 * privacy-OFF war rooms so Selorm does not answer every message.
 */
export function isWorkerTelegramGroupDirected(
  msg: NonNullable<TelegramUpdate['message']>,
  botUsername: string | null | undefined,
): boolean {
  const text = msg.text ?? msg.caption ?? '';
  const trimmed = text.trim();
  if (trimmed.startsWith('/')) return true;

  const username = (botUsername ?? '').replace(/^@/, '').toLowerCase();
  const entities = [...(msg.entities ?? []), ...(msg.caption_entities ?? [])];
  if (username) {
    for (const entity of entities) {
      if (entity.type !== 'mention') continue;
      const mention = text
        .slice(entity.offset, entity.offset + entity.length)
        .replace(/^@/, '')
        .toLowerCase();
      if (mention === username) return true;
    }
    const replied = msg.reply_to_message?.from;
    if (replied?.is_bot && replied.username?.replace(/^@/, '').toLowerCase() === username) {
      return true;
    }
    // Text fallback when entities are missing
    if (new RegExp(`@${username}\\b`, 'i').test(text)) return true;
  } else {
    // No username yet: accept replies to bots and any @mention / command only
    if (msg.reply_to_message?.from?.is_bot) return true;
    if (entities.some((entity) => entity.type === 'mention' || entity.type === 'text_mention')) {
      return true;
    }
  }

  return process.env.AIVA_GROUP_OPEN === 'true' || process.env.CARINA_GROUP_OPEN === 'true';
}

type TelegramApiResult = {
  ok?: boolean;
  description?: string;
  result?: unknown;
};

type TelegramCommandScope =
  | { type: 'default' }
  | { type: 'all_private_chats' }
  | { type: 'all_group_chats' }
  | { type: 'chat'; chat_id: number };

const registeredTelegramChats = new Set<string>();

export function telegramMenuCommands(): Array<{ command: string; description: string }> {
  return listCommands()
    .map((entry) => ({
      command: entry.name.toLowerCase().replace(/-/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 32),
      description: entry.description.trim().slice(0, 256),
    }))
    .filter((entry) => entry.command.length > 0 && entry.description.length > 0)
    .slice(0, 100);
}

async function callTelegramApi(
  botToken: string,
  method: string,
  body: Record<string, unknown>,
): Promise<TelegramApiResult> {
  const response = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const result = await response.json() as TelegramApiResult;
  if (!response.ok || !result.ok) {
    throw new Error(`${method} failed: ${result.description ?? `HTTP ${response.status}`}`);
  }
  return result;
}

async function registerTelegramCommandScope(
  botToken: string,
  scope: TelegramCommandScope,
): Promise<void> {
  await callTelegramApi(botToken, 'setMyCommands', {
    commands: telegramMenuCommands(),
    scope,
  });
}

export async function registerTelegramChatCommands(
  botToken: string,
  chatId: string,
): Promise<void> {
  const numericChatId = Number(chatId);
  if (!Number.isSafeInteger(numericChatId)) {
    throw new Error('Telegram chat menu registration requires a numeric private chat id');
  }
  const registrationKey = `${telegramBotIdFromToken(botToken)}:${chatId}`;
  if (registeredTelegramChats.has(registrationKey)) return;
  try {
    await registerTelegramCommandScope(botToken, { type: 'chat', chat_id: numericChatId });
    await callTelegramApi(botToken, 'setChatMenuButton', {
      chat_id: numericChatId,
      menu_button: { type: 'commands' },
    });
    const verified = await callTelegramApi(botToken, 'getChatMenuButton', {
      chat_id: numericChatId,
    });
    if (
      typeof verified.result !== 'object'
      || verified.result === null
      || (verified.result as { type?: string }).type !== 'commands'
    ) {
      throw new Error('Telegram did not confirm the commands menu button');
    }
    registeredTelegramChats.add(registrationKey);
  } catch (err) {
    registeredTelegramChats.delete(registrationKey);
    throw err;
  }
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
    const rawHeader = headers['x-telegram-bot-api-secret-token'];
    const provided = Array.isArray(rawHeader) ? String(rawHeader[0] ?? '') : String(rawHeader ?? '');
    if (!secret) {
      // Recovery: missing local secret must not drop all Aiva Telegram traffic.
      // Prefer setting TELEGRAM_WEBHOOK_SECRET and re-registering webhooks.
      if (provided) {
        console.warn('[telegram] accepting webhook without local TELEGRAM_WEBHOOK_SECRET (header present)');
      }
      return true;
    }
    return provided === secret;
  },

  parse(payload, workerId, workspaceId): InboundMessage | null {
    const update = payload as TelegramUpdate;
    const msg = update.message;
    if (!msg?.from || !msg.chat) return null;
    const hasText = Boolean(msg.text?.trim());
    const hasCaption = Boolean(msg.caption?.trim());
    const hasDocument = Boolean(msg.document?.file_id);
    const hasPhoto = Array.isArray(msg.photo) && msg.photo.length > 0;
    if (!hasText && !hasCaption && !hasDocument && !hasPhoto) return null;

    const chatType = String(msg.chat.type || '').toLowerCase();
    const isPrivate = chatType === 'private';
    const isGroup = chatType === 'group' || chatType === 'supergroup';
    if (!isPrivate && !isGroup) return null;
    // Drop bot-origin chatter (Telegram usually withholds this; belt and braces).
    if (msg.from.is_bot) return null;

    const rawText = (msg.text ?? msg.caption ?? '').trim();
    const preferAudio = wantsSpokenReply(rawText);
    const stripped = preferAudio ? stripSpeakDirective(rawText) : rawText;
    // Keep enough task text for the LLM; never reduce a voice ask to a tiny stub.
    const content =
      preferAudio && stripped.trim().length >= 8
        ? stripped
        : (rawText || (hasDocument || hasPhoto ? '/vault import' : ''));

    const photo = hasPhoto
      ? [...(msg.photo ?? [])].sort((a, b) => (b.file_size ?? 0) - (a.file_size ?? 0))[0]
      : undefined;
    const fileId = msg.document?.file_id || photo?.file_id;
    const filename =
      msg.document?.file_name
      || (photo ? `photo-${msg.message_id}.jpg` : undefined);
    const mime = msg.document?.mime_type || (photo ? 'image/jpeg' : undefined);

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
      metadata: {
        ...(preferAudio ? { preferAudio: 'true', rawUserText: rawText } : {}),
        telegramUserId: String(msg.from.id),
        telegramMessageId: String(msg.message_id),
        chatType: isPrivate ? 'private' : 'group',
        ...(fileId
          ? {
              telegramFileId: fileId,
              vaultFilename: filename || 'upload.bin',
              vaultMime: mime || 'application/octet-stream',
              eventId: `tg:${msg.message_id}`,
            }
          : {}),
      },
    };
  },

  async send(message: OutboundMessage, credentials: Record<string, string>): Promise<void> {
    const botToken = credentials.bot_token ?? credentials.token;
    if (!botToken) throw new Error('Telegram credentials missing bot_token');

    const preferAudio = message.metadata?.preferAudio === 'true';
    const mediaPaths = preferAudio ? extractMediaPaths(message.content) : [];
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
      // Agent often emits only MEDIA: after calling text-to-speech. Prefer a short
      // text fallback over a silent send or a caption-only "Voice reply" audio.
      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: message.contactId,
          text: 'I could not send a text reply for that turn. Please ask again.',
        }),
      });
      return;
    }

    const replyBase = message.replyToThreadId
      ? { reply_to_message_id: Number(message.replyToThreadId) }
      : {};
    const chunks = chunkTelegramOutbound(textOut);
    for (const chunk of chunks) {
      const htmlBody = {
        chat_id: message.contactId,
        text: chunk.text || ' ',
        parse_mode: 'HTML' as const,
        disable_web_page_preview: true,
        ...replyBase,
      };
      const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(htmlBody),
      });
      const result = await response.json() as { ok?: boolean; description?: string };
      if (result.ok) continue;

      const plain = chunk.plain ?? markdownToTelegramReadable(textOut);
      const fallbackBody = {
        chat_id: message.contactId,
        text: plain || ' ',
        disable_web_page_preview: true,
        ...replyBase,
      };
      const fallback = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fallbackBody),
      });
      const fallbackResult = await fallback.json() as { ok?: boolean; description?: string };
      if (fallbackResult.ok) continue;

      // reply_to_message_id can fail (stale / forged webhook ids); still deliver the text.
      const replyMissing = /message to be replied not found/i.test(
        `${fallbackResult.description ?? ''} ${result.description ?? ''}`,
      );
      if (replyMissing && replyBase.reply_to_message_id != null) {
        const bare = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: message.contactId,
            text: plain || ' ',
            disable_web_page_preview: true,
          }),
        });
        const bareResult = await bare.json() as { ok?: boolean; description?: string };
        if (bareResult.ok) continue;
        throw new Error(`Telegram send failed: ${bareResult.description ?? fallbackResult.description ?? 'unknown'}`);
      }

      throw new Error(`Telegram send failed: ${fallbackResult.description ?? result.description ?? 'unknown'}`);
    }
  },
};

const TELEGRAM_TYPING_INTERVAL_MS = 4000;
/** Delay before posting a visible status so fast replies stay clean. */
const TELEGRAM_WORKING_STATUS_DELAY_MS = 1500;
const TELEGRAM_WORKING_STATUS_TEXT = 'Working on it...';

/** Keep Telegram's "typing..." indicator alive while the Aiva is thinking. */
export function startTelegramTypingIndicator(botToken: string, chatId: string): () => void {
  let stopped = false;
  const send = () => {
    if (stopped) return;
    void fetch(`https://api.telegram.org/bot${botToken}/sendChatAction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, action: 'typing' }),
    }).catch(() => undefined);
  };
  send();
  const timer = setInterval(send, TELEGRAM_TYPING_INTERVAL_MS);
  timer.unref?.();
  return () => {
    stopped = true;
    clearInterval(timer);
  };
}

/**
 * Typing indicator plus a delayed "Working on it..." message for clients
 * (e.g. Telegram Web) that do not reliably show bot typing status.
 * Cancelling before the delay skips the status message; after send, cancel deletes it.
 */
export function startTelegramBusyStatus(botToken: string, chatId: string): () => void {
  const stopTyping = startTelegramTypingIndicator(botToken, chatId);
  let stopped = false;
  let statusMessageId: number | null = null;

  const delay = setTimeout(() => {
    if (stopped) return;
    void (async () => {
      try {
        const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: TELEGRAM_WORKING_STATUS_TEXT,
            disable_notification: true,
          }),
        });
        const data = (await response.json().catch(() => null)) as {
          ok?: boolean;
          result?: { message_id?: number };
        } | null;
        if (stopped) {
          const id = data?.result?.message_id;
          if (id != null) {
            await deleteTelegramMessage(botToken, chatId, id);
          }
          return;
        }
        if (data?.ok && data.result?.message_id != null) {
          statusMessageId = Number(data.result.message_id);
        }
      } catch {
        /* best-effort status only */
      }
    })();
  }, TELEGRAM_WORKING_STATUS_DELAY_MS);
  delay.unref?.();

  return () => {
    stopped = true;
    clearTimeout(delay);
    stopTyping();
    if (statusMessageId != null) {
      void deleteTelegramMessage(botToken, chatId, statusMessageId);
      statusMessageId = null;
    }
  };
}

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
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
  await callTelegramApi(botToken, 'setWebhook', {
    url: webhookUrl,
    allowed_updates: ['message'],
    ...(secret ? { secret_token: secret } : {}),
  });

  const scopeResults = await Promise.allSettled([
    registerTelegramCommandScope(botToken, { type: 'default' }),
    registerTelegramCommandScope(botToken, { type: 'all_private_chats' }),
    registerTelegramCommandScope(botToken, { type: 'all_group_chats' }),
    callTelegramApi(botToken, 'setChatMenuButton', {
      menu_button: { type: 'commands' },
    }),
  ]);
  const failures = scopeResults.filter((result) => result.status === 'rejected');
  const hasChatCommands =
    scopeResults[0]?.status === 'fulfilled'
    || scopeResults[1]?.status === 'fulfilled';
  const hasMenuButton = scopeResults[3]?.status === 'fulfilled';
  if (!hasChatCommands || !hasMenuButton) {
    throw new Error('Telegram webhook connected, but command menu registration failed');
  }
  for (const failure of failures) {
    if (failure.status === 'rejected') {
      console.warn(
        '[telegram-adapter] command scope registration failed:',
        failure.reason instanceof Error ? failure.reason.message : String(failure.reason),
      );
    }
  }
}

export function telegramBotIdFromToken(token: string): string {
  return token.split(':')[0] ?? token;
}

/** Best-effort delete of a user message (e.g. after /byok set so the API key leaves the chat). */
export async function deleteTelegramMessage(
  botToken: string,
  chatId: string,
  messageId: string | number,
): Promise<boolean> {
  try {
    await callTelegramApi(botToken, 'deleteMessage', {
      chat_id: Number(chatId),
      message_id: Number(messageId),
    });
    return true;
  } catch (err) {
    console.warn(
      '[telegram] deleteMessage failed:',
      err instanceof Error ? err.message : String(err),
    );
    return false;
  }
}

/** Download a Telegram file by file_id into a Buffer (Document Vault channel import). */
export async function downloadTelegramFile(
  botToken: string,
  fileId: string,
): Promise<{ bytes: Buffer; filePath: string }> {
  const meta = await callTelegramApi(botToken, 'getFile', { file_id: fileId });
  const filePath = String((meta.result as { file_path?: string } | undefined)?.file_path ?? '');
  if (!filePath) throw new Error('Telegram getFile returned no file_path');
  const res = await fetch(`https://api.telegram.org/file/bot${botToken}/${filePath}`);
  if (!res.ok) throw new Error(`Telegram file download failed: HTTP ${res.status}`);
  const ab = await res.arrayBuffer();
  return { bytes: Buffer.from(ab), filePath };
}

/** Send a document attachment to a Telegram chat. */
export async function sendTelegramDocument(input: {
  botToken: string;
  chatId: string;
  filename: string;
  bytes: Buffer;
  caption?: string;
  replyToMessageId?: string | number;
}): Promise<void> {
  const form = new FormData();
  form.append('chat_id', input.chatId);
  if (input.caption) form.append('caption', input.caption.slice(0, 1024));
  if (input.replyToMessageId != null) {
    form.append('reply_to_message_id', String(input.replyToMessageId));
  }
  form.append(
    'document',
    new Blob([Uint8Array.from(input.bytes)]),
    input.filename || 'document.bin',
  );
  const res = await fetch(`https://api.telegram.org/bot${input.botToken}/sendDocument`, {
    method: 'POST',
    body: form,
  });
  const json = (await res.json().catch(() => ({}))) as { ok?: boolean; description?: string };
  if (!res.ok || !json.ok) {
    throw new Error(`sendDocument failed: ${json.description ?? `HTTP ${res.status}`}`);
  }
}
