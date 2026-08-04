import type { Tool } from '../types/index.js';
import { generateSpeech } from '../utils/tts.js';

export const textToSpeechTool: Tool = {
  name: 'text-to-speech',
  description:
    'Convert text to speech and return a path to the generated MP3. Provider is set by config.tts.provider: "edge" uses the edge-tts CLI (pip3 install edge-tts) with the voice from config.tts.voice; "openai" uses OpenAI tts-1 with the nova voice. Text is cleaned (markdown stripped) and truncated to 4000 characters before synthesis. Returns { media, format, message } where message starts with "MEDIA:" so Telegram and other media-capable channels deliver it as an audio file. Returns { error } if the provider is misconfigured or the CLI is not installed.',
  parameters: {
    type: 'object',
    properties: {
      text: { type: 'string', description: 'Text to convert to speech' },
    },
    required: ['text'],
  },
  execute: async (params) => {
    const text = String(params.text ?? '').trim();
    if (!text) return { error: 'text is required.' };
    try {
      const { filePath } = await generateSpeech(text);
      return { media: filePath, format: 'mp3', message: `MEDIA: ${filePath}` };
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  },
};
