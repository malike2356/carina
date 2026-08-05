import type { Tool } from '#core/types/index.js';
import { executeClinicomProductHelp } from './handlers.js';

export const clinicomProductHelpTool: Tool = {
  name: 'clinicom-product-help',
  description: 'Answer Clinicom product questions from grounded FAQ/docs corpus plus live sidecar capabilities. Not medical advice.',
  parameters: {
    type: 'object',
    properties: {
      question: { type: 'string', description: 'User product question' },
      grounding_corpus: { type: 'string', description: 'FAQ and allowlisted doc excerpts' },
      capabilities_summary: { type: 'string', description: 'Live /clinicom/capabilities summary' },
    },
    required: ['question'],
  },
  execute: executeClinicomProductHelp,
};
