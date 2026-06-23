import fs from 'fs/promises';
import path from 'path';
import OpenAI from 'openai';
import { config } from '../config/index.js';
import { transcribeAudioLocal } from './transcribe-local.js';

const SUPPORTED_EXT = new Set(['.mp3', '.mp4', '.mpeg', '.mpga', '.m4a', '.wav', '.webm', '.ogg', '.opus']);

export async function transcribeAudioFile(
  filePath: string,
  language?: string,
): Promise<{ text: string } | { error: string }> {
  const ext = path.extname(filePath).toLowerCase();
  if (!SUPPORTED_EXT.has(ext)) {
    return { error: `unsupported audio type: ${ext}` };
  }

  if (config.openai.apiKey) {
    try {
      const client = new OpenAI({ apiKey: config.openai.apiKey });
      const file = await fs.readFile(filePath);
      const blob = new File([file], path.basename(filePath));
      const response = await client.audio.transcriptions.create({
        model: 'whisper-1',
        file: blob,
        ...(language ? { language } : {}),
      });
      return { text: response.text };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[transcribe] OpenAI failed (${msg}), trying local fallback`);
    }
  }

  return transcribeAudioLocal(filePath, language);
}
