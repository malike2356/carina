import type { Tool } from '#core/types/index.js';
import { executeClinicomSpeak } from './handlers.js';

export const clinicomSpeakTool: Tool = {
  name: 'clinicom-speak',
  description: 'Synthesize spoken output via the Clinicom sidecar contract (returns base64 audio metadata).',
  parameters: {
    type: 'object',
    properties: {
      text: { type: 'string', description: 'Text to speak' },
      language: { type: 'string', description: 'BCP-47 language code' },
      voice: { type: 'string', description: 'Voice id or auto', default: 'auto' },
      speed: { type: 'number', description: 'Playback speed multiplier', default: 0.9 },
    },
    required: ['text', 'language'],
  },
  execute: executeClinicomSpeak,
};
