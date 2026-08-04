import type { LeadClassification } from './types.js';

/**
 * Fixed reply templates per classification. Templates are intentionally
 * static (no interpolation of price, contact details, or links) so the
 * auto-responder can never leak pricing or contact information, and never
 * impersonates a human; "a member of the team" is the only claim made
 * about follow-up.
 */
export const AUTO_RESPONSE_TEMPLATES: Record<Exclude<LeadClassification, 'spam'>, string> = {
  hot_lead: 'Thanks for reaching out. A member of the team will contact you shortly with more details.',
  warm_lead: 'Great question. Check the link in the description for more information or drop us a DM.',
  cold_lead: 'Thanks for watching, glad you found it useful.',
};

const LEAK_PATTERNS = [
  /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i,
  /(?:\+?\d[\d\s-]{8,}\d)/,
  /[£$€]\s?\d/,
  /\b\d+\s?(gbp|usd|eur|pounds|dollars)\b/i,
];

export function containsLeakedInformation(text: string): boolean {
  return LEAK_PATTERNS.some((pattern) => pattern.test(text));
}

/**
 * Returns the auto-response for a lead classification, or null when no
 * automated reply should be sent (spam is never replied to). Throws if a
 * template were ever changed to leak contact or pricing details, so this
 * guard fails loudly rather than silently shipping a leak.
 */
export function getAutoResponse(classification: LeadClassification): string | null {
  if (classification === 'spam') return null;
  const template = AUTO_RESPONSE_TEMPLATES[classification];
  if (containsLeakedInformation(template)) {
    throw new Error(`Auto-response template for ${classification} leaks contact or pricing information`);
  }
  return template;
}
