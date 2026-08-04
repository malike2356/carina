import fs from 'fs/promises';
import path from 'path';
import { cleanForSpeech, generateSpeech } from '../utils/tts.js';

/** Max characters passed to TTS for daily summaries (Edge/OpenAI limits). */
export const SUMMARY_TTS_MAX_CHARS = Math.max(
  400,
  Number(process.env.AIVA_SUMMARY_TTS_MAX_CHARS ?? 1500),
);

export function truncateSummaryForTts(text: string): string {
  const cleaned = cleanForSpeech(text);
  if (cleaned.length <= SUMMARY_TTS_MAX_CHARS) {
    return cleaned;
  }
  const truncated = cleaned.slice(0, SUMMARY_TTS_MAX_CHARS);
  const lastSpace = truncated.lastIndexOf(' ');
  const base = lastSpace > 400 ? truncated.slice(0, lastSpace) : truncated;
  return `${base}. End of summary.`;
}

export async function sendTelegramAudioFile(
  botToken: string,
  chatId: string,
  filePath: string,
  caption?: string,
): Promise<void> {
  const buffer = await fs.readFile(filePath);
  const form = new FormData();
  form.append('chat_id', chatId);
  form.append('audio', new Blob([buffer], { type: 'audio/mpeg' }), path.basename(filePath));
  if (caption) {
    form.append('caption', caption.slice(0, 200));
  }

  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendAudio`, {
    method: 'POST',
    body: form,
  });

  const result = await response.json() as { ok?: boolean; description?: string };
  if (!result.ok) {
    throw new Error(`Telegram sendAudio failed: ${result.description ?? 'unknown'}`);
  }
}

export async function synthesizeSummaryAudio(text: string): Promise<{ filePath: string; cleanup: () => Promise<void> }> {
  return generateSpeech(truncateSummaryForTts(text));
}
