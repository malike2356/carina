import type TelegramBot from 'node-telegram-bot-api';
import { generateSpeech } from '../utils/tts.js';
import { llm } from '../brain/llm.js';
import type { Message } from '../types/index.js';

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

/** Strip tool status lines and markdown so the string is safe to pass to TTS or the voice-script LLM. */
export function cleanTextForTelegramSpeech(text: string): string {
  return text
    .replace(/\n?\[using [^\]]+\]\n?/g, '\n')
    .replace(/\*\*/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const VOICE_SCRIPT_SYSTEM =
  'Convert the following AI reply into a natural spoken script for text-to-speech. ' +
  'Rules: remove all markdown (no **, no #, no bullet dashes, no code fences); ' +
  'speak the key points conversationally as if explaining to someone face-to-face; ' +
  'keep short replies at roughly the same length, condense long ones to the essential points; ' +
  'no filler phrases like "Great question" or "In summary"; ' +
  'return only the spoken script with no commentary.';

/**
 * Generate a conversational spoken version of a written reply before TTS.
 * Falls back to the cleaned raw text if the LLM call fails.
 */
export async function buildVoiceScript(text: string): Promise<string> {
  const cleaned = cleanTextForTelegramSpeech(text);
  if (cleaned.length < 60) return cleaned;
  try {
    const messages: Message[] = [
      { role: 'system', content: VOICE_SCRIPT_SYSTEM, timestamp: new Date() },
      { role: 'user', content: cleaned, timestamp: new Date() },
    ];
    const res = await llm.chatCheap(messages);
    return res.content.trim() || cleaned;
  } catch {
    return cleaned;
  }
}
