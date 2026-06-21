import type TelegramBot from 'node-telegram-bot-api';
import { generateSpeech } from '../utils/tts.js';

const VOICE_HINT_RE = /\b(?:voice(?:\s+note|\s+reply)?|audio(?:\s+voice)?|spoken(?:\s+reply)?|text[\s-]to[\s-]speech|tts)\b/i;

export type SpokenReplyResult =
  | { ok: true }
  | { ok: false; error: string };

export async function sendSpokenReply(
  bot: TelegramBot,
  chatId: number,
  text: string,
  caption?: string,
): Promise<SpokenReplyResult> {
  try {
    const { filePath, cleanup } = await generateSpeech(text);
    try {
      await bot.sendAudio(chatId, filePath, { caption: caption ?? 'Carina voice reply' });
      return { ok: true };
    } finally {
      await cleanup();
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[telegram-audio] TTS skipped: ${msg}`);
    return { ok: false, error: msg };
  }
}

export function wantsSpokenReply(text: string): boolean {
  const lower = text.toLowerCase().trim();
  if (lower === '/speak' || lower.startsWith('/speak ') || lower.includes('[speak]')) {
    return true;
  }
  return VOICE_HINT_RE.test(text);
}

export function stripSpeakDirective(text: string): string {
  return text
    .replace(/^\/?speak\s*/i, '')
    .replace(/\[speak\]\s*/gi, '')
    .replace(
      /\s*[,;-]?\s*(?:please\s+)?(?:respond|reply|answer|say\s+(?:it|that))?\s*(?:in|with|as)\s+(?:an?\s+)?(?:audio\s+voice|voice(?:\s+note)?|audio|speech|tts)\s*$/i,
      '',
    )
    .replace(/\s*[,;-]?\s*(?:please\s+)?(?:respond|reply|answer)\s+in\s+voice\s*$/i, '')
    .replace(/\s*[,;-]?\s*(?:in|with|as)\s+(?:an?\s+)?(?:audio\s+voice|voice(?:\s+note)?|audio|speech|tts)\s*$/i, '')
    .trim();
}

/** Strip tool status lines before TTS so audio does not read bracketed tool names. */
export function cleanTextForTelegramSpeech(text: string): string {
  return text
    .replace(/\n?\[using [^\]]+\]\n?/g, '\n')
    .replace(/\*\*/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
