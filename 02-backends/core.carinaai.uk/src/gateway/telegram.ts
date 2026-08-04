import TelegramBot from 'node-telegram-bot-api';
import chalk from 'chalk';
import { config } from '../config/index.js';
import { getRouter } from './router.js';
import { getActiveAgentDefinition } from '../workspaces/agent-registry.js';
import { getSessionHistory } from '../memory/store.js';
import type { Memory } from '../types/index.js';
import { channelRegistry } from './channels/channel-registry.js';
import { TelegramAdapter } from './channels/adapters/telegram-adapter.js';
import {
  chunkTelegramOutbound,
  formatTelegramOutbound,
  markdownToTelegramReadable,
} from './telegram-format.js';
import {
  sendSpokenReply,
  wantsSpokenReply,
  stripSpeakDirective,
  buildVoiceScript,
  shouldSendTelegramVoiceReply,
} from './telegram-audio.js';
import { BlockStreamAssembler } from './block-stream-assembler.js';
import './channels/slash-commands/index.js';
import { interceptSlashCommand } from './channels/slash-commands/interceptor.js';
import { getTelegramChatPrefs } from './telegram-prefs.js';
import { registerCarinaTelegramCommands } from './telegram-menu.js';
import { deleteTelegramMessage } from '../channels/adapters/telegram-adapter.js';

const TELEGRAM_MAX = 4096;
const EDIT_INTERVAL_MS = 1000;
/** Telegram typing indicators expire after ~5s; renew sooner so busy turns stay visible. */
const CHAT_ACTION_INTERVAL_MS = 3000;
/** If no streamed tokens yet, post a placeholder so the chat does not look dead. */
const WORKING_PLACEHOLDER_MS = 5000;
const WORKING_PLACEHOLDER = 'Working...';

type TelegramSendOptions = NonNullable<Parameters<TelegramBot['sendMessage']>[2]>;
type TelegramWebhookBot = TelegramBot & {
  processUpdate: (update: unknown) => Promise<void> | void;
};

let telegramBot: TelegramWebhookBot | null = null;
let telegramBotUsername = 'carina';

const WELCOME = `Welcome to Carina.

I am an autonomous AI agent by VERLOX Ltd. I can search the web, read and write files, run tools, and remember our conversation.

Commands:
/help - show commands
/new - start a fresh conversation
/status - system health and active tools
/tools - show active tools and catalogue link
/contacts - search synced contacts or open the Contacts module
/stop - cancel the current task
/history [N] - show recent messages from this chat
/model [provider] [model] - switch LLM provider
/voice_on /voice_off - prefer voice replies for longer answers
/config - show Telegram toggles for this chat
/byok - bring your own LLM API key
/speak [message] - get a voice reply (or add "respond in voice" / [speak] to any message)`;

async function sendTelegramChunks(
  bot: TelegramBot,
  chatId: number,
  raw: string,
  extras: TelegramSendOptions = {},
): Promise<void> {
  const chunks = chunkTelegramOutbound(raw);
  for (const chunk of chunks) {
    try {
      await bot.sendMessage(chatId, chunk.text.slice(0, TELEGRAM_MAX) || ' ', {
        parse_mode: chunk.parseMode,
        link_preview_options: { is_disabled: true },
        ...extras,
      });
    } catch {
      const plain = (chunk.plain ?? markdownToTelegramReadable(raw)).slice(0, TELEGRAM_MAX) || ' ';
      await bot.sendMessage(chatId, plain, {
        link_preview_options: { is_disabled: true },
        ...extras,
      });
    }
  }
}

async function editTelegramHtml(
  bot: TelegramBot,
  chatId: number,
  messageId: number,
  raw: string,
): Promise<void> {
  const formatted = formatTelegramOutbound(raw, { html: true });
  try {
    await bot.editMessageText(formatted.text.slice(0, TELEGRAM_MAX) || ' ', {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'HTML',
      link_preview_options: { is_disabled: true },
    });
  } catch {
    const plain = markdownToTelegramReadable(raw).slice(0, TELEGRAM_MAX) || ' ';
    try {
      await bot.editMessageText(plain, {
        chat_id: chatId,
        message_id: messageId,
        link_preview_options: { is_disabled: true },
      });
    } catch {
      // ignore unchanged / rate-limit edit errors
    }
  }
}

async function sendLong(bot: TelegramBot, chatId: number, text: string): Promise<void> {
  await sendTelegramChunks(bot, chatId, text);
}

type ChatActionController = {
  /** Renew the Telegram busy indicator immediately. */
  nudge: () => void;
  /** Switch action mid-turn (e.g. typing -> record_voice for TTS). */
  setAction: (action: Parameters<TelegramBot['sendChatAction']>[1]) => void;
  stop: () => void;
};

function startTelegramChatAction(
  bot: TelegramBot,
  chatId: number,
  action: Parameters<TelegramBot['sendChatAction']>[1] = 'typing',
): ChatActionController {
  let stopped = false;
  let currentAction = action;
  const send = () => {
    if (stopped) return;
    void bot.sendChatAction(chatId, currentAction).catch(() => undefined);
  };
  send();
  const timer = setInterval(send, CHAT_ACTION_INTERVAL_MS);
  return {
    nudge: send,
    setAction: (next) => {
      currentAction = next;
      send();
    },
    stop: () => {
      stopped = true;
      clearInterval(timer);
    },
  };
}

async function* withTypingNudge(
  generator: AsyncGenerator<string>,
  nudge: () => void,
): AsyncGenerator<string> {
  const iterator = generator[Symbol.asyncIterator]();
  while (true) {
    nudge();
    const next = await iterator.next();
    if (next.done) return;
    yield next.value;
    nudge();
  }
}

async function streamToTelegram(
  bot: TelegramBot,
  chatId: number,
  generator: AsyncGenerator<string>,
  adapter: TelegramAdapter,
  chatAction?: ChatActionController,
): Promise<string> {
  const blockStream = process.env.CARINA_BLOCK_STREAM !== 'false';
  const assembler = blockStream ? new BlockStreamAssembler() : null;
  let fullText = '';
  let messageId: number | null = null;
  let lastEdit = 0;
  let pendingEdit = false;
  let placeholderOnly = false;

  const flushEdit = async (final = false): Promise<void> => {
    if (messageId === null || (!pendingEdit && !final)) return;
    pendingEdit = false;
    lastEdit = Date.now();
    if (final) {
      await editTelegramHtml(bot, chatId, messageId, fullText || '...');
      placeholderOnly = false;
      return;
    }
    const display = markdownToTelegramReadable(fullText || '...').slice(0, TELEGRAM_MAX);
    try {
      await bot.editMessageText(display || '...', {
        chat_id: chatId,
        message_id: messageId,
        link_preview_options: { is_disabled: true },
      });
      placeholderOnly = false;
    } catch {
      // ignore rate limit or unchanged message errors
    }
  };

  const placeholderTimer = setTimeout(() => {
    if (messageId !== null || fullText.trim()) return;
    chatAction?.nudge();
    void bot.sendMessage(chatId, WORKING_PLACEHOLDER)
      .then((sent) => {
        if (messageId === null && !fullText.trim()) {
          messageId = sent.message_id;
          placeholderOnly = true;
          lastEdit = Date.now();
        } else {
          void bot.deleteMessage(chatId, sent.message_id).catch(() => undefined);
        }
      })
      .catch(() => undefined);
  }, WORKING_PLACEHOLDER_MS);

  try {
    for await (const chunk of withTypingNudge(generator, () => chatAction?.nudge())) {
      chatAction?.nudge();
      if (assembler) {
        const { blocks } = assembler.push(chunk);
        if (blocks.length === 0) continue;
        fullText += blocks.join('');
      } else {
        fullText += chunk;
      }

      if (messageId === null) {
        const preview = markdownToTelegramReadable(fullText || '...').slice(0, TELEGRAM_MAX) || '...';
        const sent = await bot.sendMessage(chatId, preview, {
          link_preview_options: { is_disabled: true },
        });
        messageId = sent.message_id;
        placeholderOnly = false;
        lastEdit = Date.now();
        chatAction?.nudge();
        continue;
      }

      const now = Date.now();
      pendingEdit = true;
      if (placeholderOnly || now - lastEdit >= EDIT_INTERVAL_MS) {
        await flushEdit(false);
        chatAction?.nudge();
      }
    }

    if (assembler) {
      const tail = assembler.flush();
      if (tail) fullText += tail;
    }

    if (messageId === null) {
      const trimmed = fullText.trim();
      if (trimmed) {
        await sendTelegramChunks(bot, chatId, trimmed);
      }
    } else if (fullText.trim()) {
      const chunks = chunkTelegramOutbound(fullText);
      const first = chunks[0]!;
      try {
        await bot.editMessageText(first.text.slice(0, TELEGRAM_MAX) || ' ', {
          chat_id: chatId,
          message_id: messageId,
          parse_mode: first.parseMode,
          link_preview_options: { is_disabled: true },
        });
      } catch {
        const plain = (first.plain ?? markdownToTelegramReadable(fullText)).slice(0, TELEGRAM_MAX) || ' ';
        try {
          await bot.editMessageText(plain, {
            chat_id: chatId,
            message_id: messageId,
            link_preview_options: { is_disabled: true },
          });
        } catch {
          // ignore unchanged / rate-limit edit errors
        }
      }
      placeholderOnly = false;
      for (const chunk of chunks.slice(1)) {
        try {
          await bot.sendMessage(chatId, chunk.text.slice(0, TELEGRAM_MAX) || ' ', {
            parse_mode: chunk.parseMode,
            link_preview_options: { is_disabled: true },
          });
        } catch {
          const plain = (chunk.plain ?? markdownToTelegramReadable(chunk.text)).slice(0, TELEGRAM_MAX) || ' ';
          await bot.sendMessage(chatId, plain, { link_preview_options: { is_disabled: true } });
        }
      }
    } else if (placeholderOnly && messageId !== null) {
      try {
        await bot.deleteMessage(chatId, messageId);
      } catch {
        // ignore
      }
      messageId = null;
    }

    return fullText;
  } finally {
    clearTimeout(placeholderTimer);
  }
}

function formatHistoryForTelegram(history: Memory[]): string {
  if (history.length === 0) return 'No messages in this chat yet.';
  const lines = history.map((m) => {
    const label = m.role === 'assistant' ? 'Carina' : 'You';
    const text = m.content.replace(/\s+/g, ' ').trim();
    return `${label}: ${text.slice(0, 400)}`;
  });
  const body = lines.join('\n');
  const header = `*Last ${history.length} message(s):*\n\n`;
  return (header + body).slice(0, TELEGRAM_MAX);
}

async function handleTelegramCommand(
  bot: TelegramBot,
  chatId: number,
  text: string,
): Promise<boolean> {
  if (text === '/start' || text.startsWith('/start@')) {
    void bot.sendMessage(chatId, WELCOME);
    return true;
  }

  if (text.startsWith('/history')) {
    const parts = text.trim().split(/\s+/);
    const count = Math.min(Math.max(parseInt(parts[1] ?? '10', 10) || 10, 1), 30);
    try {
      const router = getRouter();
      const agent = getActiveAgentDefinition();
      const sessionId = await router.getSession(agent.id, 'telegram', String(chatId));
      const history = await getSessionHistory(sessionId, count);
      await bot.sendMessage(chatId, formatHistoryForTelegram(history), { parse_mode: 'Markdown' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await bot.sendMessage(chatId, `Could not load history: ${msg}`);
    }
    return true;
  }

  return false;
}

async function maybeSendVoiceReply(
  bot: TelegramBot,
  chatId: number,
  inboundText: string,
  replyText: string,
  explicitVoiceRequested: boolean,
  chatAction?: ChatActionController,
): Promise<void> {
  const prefs = await getTelegramChatPrefs(String(chatId)).catch(() => ({
    preferVoiceReplies: false,
    byokOwnerUserId: null,
  }));
  const shouldSpeak = shouldSendTelegramVoiceReply({
    preferVoiceReplies: prefs.preferVoiceReplies,
    inboundText,
    replyText,
    explicitVoiceRequested,
  });
  if (!shouldSpeak) return;

  chatAction?.setAction('record_voice');
  const speechText = await buildVoiceScript(replyText);
  if (!speechText) return;
  const voice = await sendSpokenReply(bot, chatId, speechText);
  if (!voice.ok) {
    await bot.sendMessage(chatId, `Voice note unavailable: ${voice.error}`);
  }
}

export async function processTelegramWebhookUpdate(update: unknown): Promise<boolean> {
  if (!telegramBot) return false;
  await telegramBot.processUpdate(update);
  return true;
}

export async function startTelegram(): Promise<void> {
  const token = config.telegram.botToken;
  if (!token) {
    console.warn(chalk.yellow('Telegram gateway skipped: TELEGRAM_BOT_TOKEN not set'));
    return;
  }

  const useWebhook = Boolean(config.telegram.webhookUrl);
  const bot = new TelegramBot(token, useWebhook ? { polling: false as const } : { polling: true as const });
  telegramBot = bot as TelegramWebhookBot;
  const me = await bot.getMe();
  telegramBotUsername = me.username ?? 'carina';
  const adapter = new TelegramAdapter(true, bot, telegramBotUsername);
  channelRegistry.register(adapter);

  try {
    await registerCarinaTelegramCommands(token);
    console.log(chalk.gray('Telegram gateway: BotFather command menu registered'));
  } catch (err) {
    console.warn(
      chalk.yellow('Telegram gateway: command menu registration failed:'),
      err instanceof Error ? err.message : String(err),
    );
  }

  if (useWebhook) {
    await bot.setWebHook(config.telegram.webhookUrl);
    console.log(chalk.gray(`Telegram gateway: webhook mode (${config.telegram.webhookUrl})`));
  } else {
    try {
      await bot.deleteWebHook({ drop_pending_updates: false });
    } catch {
      // ignore, this is a best-effort cleanup when switching back to polling
    }
    console.log(chalk.gray('Telegram gateway: polling mode'));
  }

  bot.on('message', async (msg) => {
    if (!msg.text || !msg.from) return;

    const chatId = msg.chat.id;
    const rawText = msg.text.trim();
    const speakRequested = wantsSpokenReply(rawText);
    const text = speakRequested ? stripSpeakDirective(rawText) : rawText;

    if (await handleTelegramCommand(bot, chatId, text)) return;

    if (text.startsWith('/')) {
      const parsed = adapter.parseInbound(msg);
      if (parsed) {
        const slashResult = await interceptSlashCommand(parsed);
        if (slashResult.handled) {
          await sendTelegramChunks(bot, chatId, slashResult.response ?? '');
          if (slashResult.deleteInbound && token) {
            await deleteTelegramMessage(token, String(chatId), msg.message_id);
          }
          return;
        }
      }
    }

    // Show typing immediately so the chat never looks idle while prefs/tools run.
    const chatAction = startTelegramChatAction(bot, chatId, 'typing');

    try {
      const prefs = await getTelegramChatPrefs(String(chatId)).catch(() => ({
        preferVoiceReplies: false,
        byokOwnerUserId: null,
      }));
      chatAction.nudge();

      const inboundMsg = speakRequested || prefs.preferVoiceReplies
        ? {
            ...msg,
            text:
              `${text || 'Give me a brief spoken summary.'}\n\n`
              + '[Channel note: Telegram may deliver this reply as audio when voice is preferred. '
              + 'Reply in plain text only; do not call text-to-speech.]',
          }
        : msg;
      const generator = getRouter().handleInbound('telegram', inboundMsg);
      const fullReply = await streamToTelegram(bot, chatId, generator, adapter, chatAction);
      await maybeSendVoiceReply(bot, chatId, rawText, fullReply, speakRequested, chatAction);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      // Redis blips used to surface as a scary footer after a successful reply.
      if (/connection is closed/i.test(errMsg)) {
        console.warn('[telegram] suppressed closed-connection error after turn:', errMsg);
        return;
      }
      await bot.sendMessage(chatId, `Error: ${errMsg}`);
    } finally {
      chatAction.stop();
    }
  });

  console.log(chalk.green('Telegram gateway ready'));
}

export function getTelegramBotUsername(): string {
  return telegramBotUsername;
}
