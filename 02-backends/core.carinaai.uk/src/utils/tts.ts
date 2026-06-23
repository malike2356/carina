import fs from 'fs/promises';
import fsSync from 'fs';
import os from 'os';
import path from 'path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config/index.js';

const execFileAsync = promisify(execFile);

export function resolveEdgeTtsBin(): string {
  const fromEnv = process.env.EDGE_TTS_BIN?.trim();
  if (fromEnv) return fromEnv;
  const home = process.env.HOME?.trim() || os.homedir();
  const userLocal = path.join(home, '.local/bin/edge-tts');
  if (fsSync.existsSync(userLocal)) return userLocal;
  return 'edge-tts';
}

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

async function synthesizeOpenAi(text: string, filePath: string): Promise<void> {
  if (!config.openai.apiKey) {
    throw new Error('OpenAI API key not configured for TTS fallback');
  }
  const OpenAI = (await import('openai')).default;
  const client = new OpenAI({ apiKey: config.openai.apiKey });
  const response = await client.audio.speech.create({
    model: 'tts-1',
    voice: 'nova',
    input: text,
  });
  const buffer = Buffer.from(await response.arrayBuffer());
  await fs.writeFile(filePath, buffer);
}

async function synthesizeEdge(text: string, filePath: string): Promise<void> {
  const edgeBin = resolveEdgeTtsBin();
  await execFileAsync(
    edgeBin,
    ['--voice', config.tts.voice, '--text', text, '--write-media', filePath],
    { timeout: 30_000 },
  );
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
    if (provider === 'openai') {
      await synthesizeOpenAi(cleaned, filePath);
    } else {
      try {
        await synthesizeEdge(cleaned, filePath);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        const edgeMissing = msg.includes('ENOENT') || /edge-tts.*not found/i.test(msg);
        if (edgeMissing && config.openai.apiKey) {
          try {
            await synthesizeOpenAi(cleaned, filePath);
          } catch (openAiErr) {
            const openAiMsg = openAiErr instanceof Error ? openAiErr.message : String(openAiErr);
            throw new Error(
              `TTS generation failed: edge-tts unavailable and OpenAI fallback failed (${openAiMsg}).`,
            );
          }
        } else if (edgeMissing) {
          throw new Error(
            'TTS generation failed: edge-tts CLI not found. Run: pip3 install edge-tts, or set OPENAI_API_KEY for OpenAI TTS fallback.',
          );
        } else {
          throw new Error(`TTS generation failed: ${msg}`);
        }
      }
    }
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('TTS generation failed')) {
      throw err;
    }
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`TTS generation failed: ${msg}`);
  }

  return {
    filePath,
    cleanup: async () => {
      await fs.rm(filePath, { force: true });
    },
  };
}
