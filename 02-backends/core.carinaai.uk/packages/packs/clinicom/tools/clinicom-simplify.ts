import type { Tool } from '#core/types/index.js';
import { executeClinicomSimplify } from './handlers.js';

export const clinicomSimplifyTool: Tool = {
  name: 'clinicom-simplify',
  description: 'Simplify clinical text to plain language via the Clinicom sidecar contract.',
  parameters: {
    type: 'object',
    properties: {
      text: { type: 'string', description: 'Clinical or patient-facing text' },
      direction: { type: 'string', description: 'Simplification direction', default: 'to-plain' },
      target_reading_level: { type: 'number', description: 'Target US grade reading level (3-12)', default: 8 },
      context: { type: 'string', description: 'Clinical context label', default: 'general-practice' },
    },
    required: ['text'],
  },
  execute: executeClinicomSimplify,
};
