import TelegramBot from 'node-telegram-bot-api';
import chalk from 'chalk';
import { config } from '../config/index.js';
import { getRouter } from './router.js';
import { channelRegistry } from './channels/channel-registry.js';
import { TelegramAdapter } from './channels/adapters/telegram-adapter.js';
import { formatForPlatform } from './formatting.js';
import { sendSpokenReply, wantsSpokenReply, stripSpeakDirective, buildVoiceScript } from './telegram-audio.js';
import { BlockStreamAssembler } from './block-stream-assembler.js';

const TELEGRAM_MAX = 4096;
const EDIT_INTERVAL_MS = 1000;

type TelegramWebhookBot = TelegramBot & {
  processUpdate: (update: unknown) => Promise<void> | void;
};

let telegramBot: TelegramWebhookBot | null = null;
let telegramBotUsername = 'carina';

const WELCOME = `Welcome to Carina.

I am an autonomous AI agent by VERLOX Ltd. I can search the web, read and write files, run tools, and remember our conversation.

Commands:
/help - show commands
/clear - reset session memory
/model [provider] [model] - switch LLM provider
/speak [message] - get a voice reply (or add "respond in voice" / [speak] to any message)`;

async function sendLong(bot: TelegramBot, chatId: number, text: string, adapter: TelegramAdapter): Promise<void> {
  const formatted = formatForPlatform(text, 'telegram');
  const chunks = Array.isArray(formatted) ? formatted : adapter.formatForChannel(formatted);
  for (const chunk of chunks) {
    await bot.sendMessage(chatId, chunk);
  }
}

async function streamToTelegram(
  bot: TelegramBot,
  chatId: number,
  generator: AsyncGenerator<string>,
  adapter: TelegramAdapter,
): Promise<string> {
  const blockStream = process.env.CARINA_BLOCK_STREAM !== 'false';
  const assembler = blockStream ? new BlockStreamAssembler() : null;
  let fullText = '';
  let messageId: number | null = null;
  let lastEdit = 0;
  let pendingEdit = false;

  const flushEdit = async (): Promise<void> => {
    if (messageId === null || !pendingEdit) return;
    pendingEdit = false;
    lastEdit = Date.now();
    const formatted = formatForPlatform(fullText || '...', 'telegram');
    const display = Array.isArray(formatted) ? formatted[0] : formatted;
    try {
      await bot.editMessageText(display.slice(0, TELEGRAM_MAX), {
        chat_id: chatId,
        message_id: messageId,
      });
    } catch {
      // ignore rate limit or unchanged message errors
    }
  };

  for await (const chunk of generator) {
    if (assembler) {
      const { blocks } = assembler.push(chunk);
      if (blocks.length === 0) continue;
      fullText += blocks.join('');
    } else {
      fullText += chunk;
    }

    if (messageId === null) {
      const sent = await bot.sendMessage(chatId, fullText.slice(0, TELEGRAM_MAX) || '...');
      messageId = sent.message_id;
      lastEdit = Date.now();
      continue;
    }

    const now = Date.now();
    pendingEdit = true;
    if (now - lastEdit >= EDIT_INTERVAL_MS) {
      await flushEdit();
    }
  }

  if (assembler) {
    const tail = assembler.flush();
    if (tail) fullText += tail;
  }

  if (messageId === null) {
    const trimmed = fullText.trim();
    if (trimmed) {
      const formatted = formatForPlatform(trimmed, 'telegram');
      const display = Array.isArray(formatted) ? formatted[0] : formatted;
      await bot.sendMessage(chatId, display.slice(0, TELEGRAM_MAX));
    }
  } else {
    await flushEdit();
  }

  if (fullText.length > TELEGRAM_MAX && messageId !== null) {
    const remainder = fullText.slice(TELEGRAM_MAX);
    await sendLong(bot, chatId, remainder, adapter);
  }

  return fullText;
}

function handleTelegramCommand(
  bot: TelegramBot,
  chatId: number,
  text: string,
): boolean {
  if (text === '/start') {
    void bot.sendMessage(chatId, WELCOME);
    return true;
  }
  return false;
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
    const isGroup = msg.chat.type === 'group' || msg.chat.type === 'supergroup';

    if (handleTelegramCommand(bot, chatId, text)) return;

    await bot.sendChatAction(chatId, speakRequested ? 'record_voice' : 'typing');

    try {
      const inboundMsg = speakRequested ? { ...msg, text: text || 'Give me a brief spoken summary.' } : msg;
      const generator = getRouter().handleInbound('telegram', inboundMsg);

      if (speakRequested) {
        const fullReply = await streamToTelegram(bot, chatId, generator, adapter);
        const speechText = await buildVoiceScript(fullReply);
        if (speechText) {
          const voice = await sendSpokenReply(bot, chatId, speechText);
          if (!voice.ok) {
            await bot.sendMessage(
              chatId,
              `Voice note unavailable: ${voice.error}`,
            );
          }
        }
      } else {
        await streamToTelegram(bot, chatId, generator, adapter);
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      await bot.sendMessage(chatId, `Error: ${errMsg}`);
    }
  });

  console.log(chalk.green('Telegram gateway ready'));
}

export function getTelegramBotUsername(): string {
  return telegramBotUsername;
}
