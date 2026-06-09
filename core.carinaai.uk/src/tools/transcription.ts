import fs from 'fs/promises';
import path from 'path';
import OpenAI from 'openai';
import type { Tool } from '../types/index.js';
import { config } from '../config/index.js';
import { expandPath, isSafePath, resolveResourcePath } from './path-utils.js';

const MAX_AUDIO_BYTES = 25 * 1024 * 1024;
const SUPPORTED_EXT = new Set(['.mp3', '.mp4', '.mpeg', '.mpga', '.m4a', '.wav', '.webm', '.ogg']);

export const transcriptionTool: Tool = {
  name: 'transcription',
  description:
    'Transcribe audio or video to text using OpenAI Whisper. Supports mp3, wav, m4a, webm, and other common formats.',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Absolute or ~/ path to the audio/video file' },
      language: { type: 'string', description: 'Optional ISO-639-1 language hint (e.g. en)' },
    },
    required: ['path'],
  },
  execute: async (params) => {
    const filePath = resolveResourcePath(expandPath(String(params.path ?? '')));
    const language = params.language ? String(params.language) : undefined;

    if (!isSafePath(filePath)) return { error: 'path is not allowed' };

    const ext = path.extname(filePath).toLowerCase();
    if (!SUPPORTED_EXT.has(ext)) {
      return { error: `unsupported audio type: ${ext}` };
    }

    if (!config.openai.apiKey) {
      return { error: 'OPENAI_API_KEY required for transcription' };
    }

    let stat;
    try {
      stat = await fs.stat(filePath);
    } catch {
      return { error: `file not found: ${filePath}` };
    }
    if (!stat.isFile()) return { error: 'path is not a file' };
    if (stat.size > MAX_AUDIO_BYTES) {
      return { error: `audio exceeds ${MAX_AUDIO_BYTES} byte limit` };
    }

    try {
      const client = new OpenAI({ apiKey: config.openai.apiKey });
      const file = await fs.readFile(filePath);
      const blob = new File([file], path.basename(filePath));
      const response = await client.audio.transcriptions.create({
        model: 'whisper-1',
        file: blob,
        ...(language ? { language } : {}),
      });
      return {
        text: response.text,
        path: filePath,
        provider: 'openai',
        model: 'whisper-1',
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { error: `transcription failed: ${msg}` };
    }
  },
};
