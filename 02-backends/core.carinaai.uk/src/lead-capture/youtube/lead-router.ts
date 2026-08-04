import type { DetectedContactInfo, LeadClassification, LeadRoutingDestination } from './types.js';

const SOURCING_PATTERNS = [/looking for/i, /deal/i, /available/i, /source/i, /off.?market/i];
const JOINT_VENTURE_PATTERNS = [/\bjv\b/i, /joint venture/i, /\broi\b/i, /\byield\b/i, /\bportfolio\b/i, /invest(or)?/i];
const TRAINING_PATTERNS = [/how (do|can) i/i, /beginner/i, /new to/i, /where (do|should) i start/i, /first time/i];

/**
 * Routes a classified lead to the correct workspace pipeline. Spam is never
 * routed. Cold leads are not routed either (they are engagement, not a
 * pipeline-ready signal); only warm and hot leads are handed to a
 * destination pipeline.
 */
export function routeLead(input: { classification: LeadClassification; text: string; signals: string[] }): LeadRoutingDestination {
  if (input.classification === 'spam' || input.classification === 'cold_lead') return 'none';

  if (JOINT_VENTURE_PATTERNS.some((p) => p.test(input.text))) return 'joint_venture_calls';
  if (TRAINING_PATTERNS.some((p) => p.test(input.text))) return 'training_pipeline';
  if (SOURCING_PATTERNS.some((p) => p.test(input.text))) return 'sourcing_funnel';

  // Default: any remaining warm/hot lead without a specific angle still
  // needs a human, so it goes to the sourcing funnel as the general intake.
  return 'sourcing_funnel';
}

export function describeDestination(destination: LeadRoutingDestination): string {
  switch (destination) {
    case 'sourcing_funnel':
      return 'Workspace deal pipeline (sourcing funnel)';
    case 'joint_venture_calls':
      return 'Workspace meeting scheduler (joint venture calls)';
    case 'training_pipeline':
      return 'Workspace education funnel (training pipeline)';
    default:
      return 'Not routed';
  }
}

export function hasUsableContactInfo(contactInfo: DetectedContactInfo): boolean {
  return Boolean(contactInfo.email || contactInfo.phone || contactInfo.website);
}
