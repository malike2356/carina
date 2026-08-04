import type { Tool } from '#core/types/index.js';
import { executeClinicomSpecialtySimplify } from './handlers.js';

export const clinicomSpecialtySimplifyTool: Tool = {
  name: 'clinicom-specialty-simplify',
  description: 'Simplify clinical text for a named specialty via the Clinicom sidecar contract.',
  parameters: {
    type: 'object',
    properties: {
      text: { type: 'string', description: 'Clinical or patient-facing text' },
      specialty_pack_id: { type: 'string', description: 'Specialty pack identifier', default: 'general' },
      target_reading_level: { type: 'number', description: 'Target reading level', default: 8 },
      context: { type: 'string', description: 'Clinical context label', default: 'general-practice' },
    },
    required: ['text'],
  },
  execute: executeClinicomSpecialtySimplify,
};
