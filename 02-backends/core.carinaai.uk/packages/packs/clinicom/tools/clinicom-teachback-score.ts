import type { Tool } from '#core/types/index.js';
import { executeClinicomTeachbackScore } from './handlers.js';

export const clinicomTeachbackScoreTool: Tool = {
  name: 'clinicom-teachback-score',
  description: 'Score patient teach-back against key points via the Clinicom sidecar contract.',
  parameters: {
    type: 'object',
    properties: {
      patient_response: { type: 'string', description: 'Teach-back response text' },
      key_points: { type: 'array', items: { type: 'string' }, description: 'Key points to check' },
      context: { type: 'string', description: 'Clinical context label', default: 'general-practice' },
    },
    required: ['patient_response'],
  },
  execute: executeClinicomTeachbackScore,
};
