import TelegramBot from 'node-telegram-bot-api';
import chalk from 'chalk';
import { config } from '../config/index.js';
import { handleGatewayCommand, handleGatewayCommandAsync } from './commands.js';
import { getRouter } from './router.js';
import type { CarinaMessage } from '../types/index.js';

const TELEGRAM_MAX = 4096;
const EDIT_INTERVAL_MS = 1000;

const WELCOME = `Welcome to Carina.

I am an autonomous AI agent by VERLOX Ltd. I can search the web, read and write files, run tools, and remember our conversation.

Commands:
/help - show commands
/clear - reset session memory
/provider [name] - switch LLM provider`;

function splitMessage(text: string, maxLen: number): string[] {
  if (text.length <= maxLen) return [text];
  const chunks: string[] = [];
  let rest = text;
  while (rest.length > 0) {
    chunks.push(rest.slice(0, maxLen));
    rest = rest.slice(maxLen);
  }
  return chunks;
}

async function sendLong(bot: TelegramBot, chatId: number, text: string): Promise<void> {
  for (const chunk of splitMessage(text, TELEGRAM_MAX)) {
    await bot.sendMessage(chatId, chunk);
  }
}

async function streamToTelegram(
  bot: TelegramBot,
  chatId: number,
  generator: AsyncGenerator<string>,
): Promise<void> {
  let fullText = '';
  let messageId: number | null = null;
  let lastEdit = 0;
  let pendingEdit = false;

  const flushEdit = async (): Promise<void> => {
    if (messageId === null || !pendingEdit) return;
    pendingEdit = false;
    lastEdit = Date.now();
    const display = fullText || '...';
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
    await sendLong(bot, chatId, remainder);
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

  if (useWebhook) {
    await bot.setWebHook(config.telegram.webhookUrl);
    console.log(chalk.gray(`Telegram gateway: webhook mode (${config.telegram.webhookUrl})`));
  } else {
    console.log(chalk.gray('Telegram gateway: polling mode'));
  }

  bot.on('message', async (msg) => {
    if (!msg.text || !msg.from) return;

    const chatId = msg.chat.id;
    const userId = msg.from.id.toString();
    const text = msg.text.trim();

    if (handleTelegramCommand(bot, chatId, text)) return;

    // Route shared commands (/provider, /help, /memories, /clear) before hitting the agent
    const asyncCmd = await handleGatewayCommandAsync(text);
    if (asyncCmd.handled) {
      await bot.sendMessage(chatId, asyncCmd.reply);
      return;
    }

    const router = getRouter();
    const sessionId = await router.getSession('telegram', userId);

    if (text === '/clear') {
      await router.clearSession(sessionId);
      await bot.sendMessage(chatId, 'Session memory cleared.');
      return;
    }

    await bot.sendChatAction(chatId, 'typing');

    const carinaMsg: CarinaMessage = {
      id: String(msg.message_id),
      sessionId,
      content: text,
      source: 'telegram',
      timestamp: new Date(msg.date * 1000),
    };

    try {
      await streamToTelegram(bot, chatId, router.handle(carinaMsg));
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      await bot.sendMessage(chatId, `Error: ${errMsg}`);
    }
  });

  console.log(chalk.green('Telegram gateway ready'));
}
