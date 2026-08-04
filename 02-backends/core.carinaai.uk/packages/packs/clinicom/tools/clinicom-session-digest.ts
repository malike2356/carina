import type { Tool } from '#core/types/index.js';
import { executeClinicomSessionDigest } from './handlers.js';

export const clinicomSessionDigestTool: Tool = {
  name: 'clinicom-session-digest',
  description: 'Build a bounded session memory digest via the Clinicom sidecar contract.',
  parameters: {
    type: 'object',
    properties: {
      context: { type: 'object', description: 'Session context pack' },
    },
    required: ['context'],
  },
  execute: executeClinicomSessionDigest,
};
