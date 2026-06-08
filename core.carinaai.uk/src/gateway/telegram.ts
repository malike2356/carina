import TelegramBot from 'node-telegram-bot-api';
import chalk from 'chalk';
import { config } from '../config/index.js';
import { getRouter } from './router.js';
import { channelRegistry } from './channels/channel-registry.js';
import { TelegramAdapter } from './channels/adapters/telegram-adapter.js';
import { formatForPlatform } from './formatting.js';

const TELEGRAM_MAX = 4096;
const EDIT_INTERVAL_MS = 1000;

const WELCOME = `Welcome to Carina.

I am an autonomous AI agent by VERLOX Ltd. I can search the web, read and write files, run tools, and remember our conversation.

Commands:
/help - show commands
/clear - reset session memory
/model [provider] [model] - switch LLM provider`;

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
): Promise<void> {
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
    fullText += chunk;

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

  await flushEdit();

  if (fullText.length > TELEGRAM_MAX && messageId !== null) {
    const remainder = fullText.slice(TELEGRAM_MAX);
    await sendLong(bot, chatId, remainder, adapter);
  }
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

export async function startTelegram(): Promise<void> {
  const token = config.telegram.botToken;
  if (!token) {
    console.warn(chalk.yellow('Telegram gateway skipped: TELEGRAM_BOT_TOKEN not set'));
    return;
  }

  const useWebhook = Boolean(config.telegram.webhookUrl);
  const bot = new TelegramBot(token, { polling: !useWebhook });
  const me = await bot.getMe();
  const botUsername = me.username ?? 'carina';
  const adapter = new TelegramAdapter(true, bot, botUsername);
  channelRegistry.register(adapter);

  if (useWebhook) {
    await bot.setWebHook(config.telegram.webhookUrl);
    console.log(chalk.gray(`Telegram gateway: webhook mode (${config.telegram.webhookUrl})`));
  } else {
    console.log(chalk.gray('Telegram gateway: polling mode'));
  }

  bot.on('message', async (msg) => {
    if (!msg.text || !msg.from) return;

    const chatId = msg.chat.id;
    const text = msg.text.trim();
    const isGroup = msg.chat.type === 'group' || msg.chat.type === 'supergroup';

    if (handleTelegramCommand(bot, chatId, text)) return;

    await bot.sendChatAction(chatId, 'typing');
    if (isGroup && adapter.parseInbound(msg)?.isMention) {
      await bot.setMessageReaction(chatId, msg.message_id, {
        reaction: [{ type: 'emoji', emoji: '👀' }],
      }).catch(() => undefined);
    }

    try {
      await streamToTelegram(bot, chatId, getRouter().handleInbound('telegram', msg), adapter);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      await bot.sendMessage(chatId, `Error: ${errMsg}`);
    }
  });

  console.log(chalk.green('Telegram gateway ready'));
}
