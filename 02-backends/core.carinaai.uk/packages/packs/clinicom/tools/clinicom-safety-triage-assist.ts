import type { Tool } from '#core/types/index.js';
import { executeClinicomSafetyTriageAssist } from './handlers.js';

export const clinicomSafetyTriageAssistTool: Tool = {
  name: 'clinicom-safety-triage-assist',
  description: 'Return a safety triage assist payload via the Clinicom sidecar contract.',
  parameters: {
    type: 'object',
    properties: {
      text: { type: 'string', description: 'Message to evaluate for safety triage' },
      safety_terms: { type: 'array', items: { type: 'string' }, description: 'Safety terms to highlight' },
      context: { type: 'string', description: 'Clinical context label', default: 'general-practice' },
    },
    required: ['text'],
  },
  execute: executeClinicomSafetyTriageAssist,
};
