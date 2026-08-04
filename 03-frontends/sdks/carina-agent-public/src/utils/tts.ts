import fs from 'fs/promises';
import path from 'path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config/index.js';

const execFileAsync = promisify(execFile);

export function cleanForSpeech(text: string): string {
  let cleaned = text.replace(/[*_`#]/g, '');
  cleaned = cleaned.replace(/^[\s]*[-•]\s+/gm, ', ');
  cleaned = cleaned.replace(/^[\s]*\d+\.\s+/gm, ', ');
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  if (cleaned.length <= 4000) return cleaned;

  const truncated = cleaned.slice(0, 4000);
  const lastSpace = truncated.lastIndexOf(' ');
  return lastSpace > 0 ? truncated.slice(0, lastSpace) : truncated;
}

export async function generateSpeech(
  text: string,
): Promise<{ filePath: string; cleanup: () => Promise<void> }> {
  const provider = config.tts.provider;
  if (provider !== 'edge' && provider !== 'openai') {
    throw new Error(`Unsupported TTS provider: ${provider}`);
  }

  const cleaned = cleanForSpeech(text);
  const id = uuidv4();
  const filePath = path.join('data', 'tts', `${id}.mp3`);
  await fs.mkdir(path.dirname(filePath), { recursive: true });

  try {
    if (provider === 'edge') {
      await execFileAsync(
        'edge-tts',
        ['--voice', config.tts.voice, '--text', cleaned, '--write-media', filePath],
        { timeout: 30_000 },
      );
    } else {
      const OpenAI = (await import('openai')).default;
      const client = new OpenAI({ apiKey: config.openai.apiKey });
      const response = await client.audio.speech.create({
        model: 'tts-1',
        voice: 'nova',
        input: cleaned,
      });
      const buffer = Buffer.from(await response.arrayBuffer());
      await fs.writeFile(filePath, buffer);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('ENOENT')) {
      throw new Error(
        'TTS generation failed: edge-tts CLI not found. Run: pip3 install edge-tts',
      );
    }
    throw new Error(`TTS generation failed: ${msg}`);
  }

  return {
    filePath,
    cleanup: async () => {
      await fs.rm(filePath, { force: true });
    },
  };
}
