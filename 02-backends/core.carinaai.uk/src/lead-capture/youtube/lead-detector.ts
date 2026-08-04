import type { ChannelDomainId } from '../../content/script-generator/niches.js';
import type { DetectedContactInfo, LeadDetectionResult } from './types.js';

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;
const PHONE_RE = /(?:\+?\d[\d\s-]{8,}\d)/;
const WEBSITE_RE = /\b(?:https?:\/\/|www\.)[^\s]+\b/i;

const QUESTION_PATTERNS: RegExp[] = [
  /how much/i,
  /interested in/i,
  /looking for/i,
  /what'?s the (price|cost)/i,
  /can (you|i) (get|know|find out)/i,
];

const CTA_ENGAGEMENT_PATTERNS: RegExp[] = [/dm me/i, /send (me )?(the )?details/i, /get in touch/i, /message me/i, /contact me/i];

const PROPERTY_INQUIRY_PATTERNS: RegExp[] = [/is (this|it) (still )?available/i, /price on this/i, /viewing/i, /is this for sale/i];

const INVESTOR_PATTERNS: RegExp[] = [/\broi\b/i, /\byield\b/i, /\bdeal\b/i, /\bportfolio\b/i, /joint venture/i, /\bjv\b/i];

const SPAM_PATTERNS: RegExp[] = [
  /subscribe (to|back) my channel/i,
  /check out my (channel|page)/i,
  /click (the )?link in my bio/i,
  /make \$?\d+ (a|per) (day|week)/i,
  /crypto|forex signals|bitcoin giveaway/i,
];

function detectContactInfo(text: string): DetectedContactInfo {
  const info: DetectedContactInfo = {};
  const email = text.match(EMAIL_RE)?.[0];
  const website = text.match(WEBSITE_RE)?.[0];
  const phone = text.match(PHONE_RE)?.[0];
  if (email) info.email = email;
  if (website) info.website = website;
  if (phone && phone.replace(/\D/g, '').length >= 9) info.phone = phone.trim();
  return info;
}

function matchesAny(patterns: RegExp[], text: string): string[] {
  return patterns.filter((p) => p.test(text)).map((p) => p.source);
}

/**
 * Classifies a YouTube comment into hot/warm/cold lead or spam.
 * Property sale / investor heuristics apply only when domainId is property
 * (or unspecified for legacy runs).
 */
export function classifyComment(
  text: string,
  options: { domainId?: ChannelDomainId } = {},
): LeadDetectionResult {
  const trimmed = text.trim();
  const contactInfo = detectContactInfo(trimmed);
  const hasContactInfo = Boolean(contactInfo.email || contactInfo.phone || contactInfo.website);

  const spamSignals = matchesAny(SPAM_PATTERNS, trimmed);
  if (spamSignals.length > 0) {
    return { classification: 'spam', signals: spamSignals, contactInfo, confidence: 0.9 };
  }

  const domainId = options.domainId ?? 'property';
  const questionSignals = matchesAny(QUESTION_PATTERNS, trimmed);
  const ctaSignals = matchesAny(CTA_ENGAGEMENT_PATTERNS, trimmed);
  const inquirySignals =
    domainId === 'property' ? matchesAny(PROPERTY_INQUIRY_PATTERNS, trimmed) : [];
  const investorSignals =
    domainId === 'property' ? matchesAny(INVESTOR_PATTERNS, trimmed) : [];
  const intentSignals = [...questionSignals, ...ctaSignals, ...inquirySignals, ...investorSignals];

  if (intentSignals.length === 0 && !hasContactInfo) {
    return { classification: 'cold_lead', signals: [], contactInfo, confidence: 0.3 };
  }

  const hasBuyingIntent = intentSignals.length > 0;

  if (hasContactInfo && hasBuyingIntent) {
    return {
      classification: 'hot_lead',
      signals: intentSignals,
      contactInfo,
      confidence: 0.9,
    };
  }

  if (hasContactInfo || intentSignals.length > 0) {
    return {
      classification: 'warm_lead',
      signals: intentSignals.length > 0 ? intentSignals : ['contact_info_present'],
      contactInfo,
      confidence: 0.6,
    };
  }

  return { classification: 'cold_lead', signals: [], contactInfo, confidence: 0.3 };
}
