import type { Tool } from '#core/types/index.js';
import { executeClinicomTranscribe } from './handlers.js';

export const clinicomTranscribeTool: Tool = {
  name: 'clinicom-transcribe',
  description: 'Transcribe interpreter audio via the Clinicom sidecar contract (returns JSON transcript payload).',
  parameters: {
    type: 'object',
    properties: {
      audio: { type: 'string', description: 'Base64-encoded audio bytes' },
      mime_type: { type: 'string', description: 'Audio MIME type', default: 'audio/webm' },
      language_hint: { type: 'string', description: 'Optional BCP-47 language hint' },
      context: { type: 'string', description: 'Clinical context label', default: 'general-practice' },
    },
    required: ['audio'],
  },
  execute: executeClinicomTranscribe,
};
