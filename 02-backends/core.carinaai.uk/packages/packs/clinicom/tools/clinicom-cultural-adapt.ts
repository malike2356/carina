import type { Tool } from '#core/types/index.js';
import { executeClinicomCulturalAdapt } from './handlers.js';

export const clinicomCulturalAdaptTool: Tool = {
  name: 'clinicom-cultural-adapt',
  description: 'Adapt clinical phrasing for cultural context via the Clinicom sidecar contract.',
  parameters: {
    type: 'object',
    properties: {
      text: { type: 'string', description: 'Text to adapt' },
      source_language: { type: 'string', description: 'Source BCP-47 language code', default: 'en' },
      target_language: { type: 'string', description: 'Target BCP-47 language code', default: 'en' },
      context: { type: 'string', description: 'Clinical context label', default: 'general-practice' },
    },
    required: ['text'],
  },
  execute: executeClinicomCulturalAdapt,
};
