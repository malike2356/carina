import type { Tool } from '#core/types/index.js';
import { executeClinicomConfidenceExplain } from './handlers.js';

export const clinicomConfidenceExplainTool: Tool = {
  name: 'clinicom-confidence-explain',
  description: 'Explain the confidence score for a Clinicom pipeline turn.',
  parameters: {
    type: 'object',
    properties: {
      score: { type: 'number', description: 'Confidence score to explain', default: 0 },
      provider_sources: { type: 'object', description: 'Provider source map' },
      pipeline_timing: { type: 'object', description: 'Pipeline timing map' },
      step_status: { type: 'array', items: { type: 'object' }, description: 'Pipeline step status list' },
      context: { type: 'string', description: 'Clinical context label', default: 'general-practice' },
    },
  },
  execute: executeClinicomConfidenceExplain,
};
