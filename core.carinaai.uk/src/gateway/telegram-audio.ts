import type TelegramBot from 'node-telegram-bot-api';
import { generateSpeech } from '../utils/tts.js';

export async function sendSpokenReply(
  bot: TelegramBot,
  chatId: number,
  text: string,
  caption?: string,
): Promise<void> {
  try {
    const { filePath, cleanup } = await generateSpeech(text);
    try {
      await bot.sendAudio(chatId, filePath, { caption: caption ?? 'Carina voice reply' });
    } finally {
      await cleanup();
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[telegram-audio] TTS skipped: ${msg}`);
  }
}

export function wantsSpokenReply(text: string): boolean {
  const lower = text.toLowerCase().trim();
  return lower === '/speak' || lower.startsWith('/speak ') || lower.includes('[speak]');
}

export function stripSpeakDirective(text: string): string {
  return text.replace(/^\/?speak\s*/i, '').replace(/\[speak\]\s*/gi, '').trim();
}
