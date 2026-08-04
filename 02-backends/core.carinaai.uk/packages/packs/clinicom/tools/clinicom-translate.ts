import type { Tool } from '#core/types/index.js';
import { executeClinicomTranslate } from './handlers.js';

export const clinicomTranslateTool: Tool = {
  name: 'clinicom-translate',
  description: 'Translate clinical dialogue via the Clinicom sidecar contract.',
  parameters: {
    type: 'object',
    properties: {
      text: { type: 'string', description: 'Text to translate' },
      source_language: { type: 'string', description: 'Source BCP-47 language code' },
      target_language: { type: 'string', description: 'Target BCP-47 language code' },
      context: { type: 'string', description: 'Clinical context label', default: 'general-practice' },
    },
    required: ['text', 'source_language', 'target_language'],
  },
  execute: executeClinicomTranslate,
};
