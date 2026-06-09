import type { Tool } from '../types/index.js';
import { generateSpeech } from '../utils/tts.js';

export const textToSpeechTool: Tool = {
  name: 'text-to-speech',
  description:
    'Convert text to speech audio via Edge TTS or OpenAI TTS. Returns MEDIA: path to audio file for native delivery on Telegram and other platforms.',
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

    const { filePath } = await generateSpeech(text);
    return { media: filePath, format: 'mp3', message: `MEDIA: ${filePath}` };
  },
};
