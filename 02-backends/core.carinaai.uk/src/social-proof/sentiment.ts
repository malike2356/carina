/**
 * Sentiment scoring and fingerprint / de-dupe helpers.
 */
import { createHash } from 'node:crypto';
import type { SentimentLabel, Testimonial } from './types.js';

const POSITIVE = [
  'love',
  'amazing',
  'great',
  'excellent',
  'helpful',
  'saved',
  'thank',
  'awesome',
  'recommend',
  'brilliant',
  'works',
  'fast',
  'reliable',
  'impressed',
];
const NEGATIVE = [
  'hate',
  'terrible',
  'awful',
  'broken',
  'bug',
  'slow',
  'useless',
  'scam',
  'fraud',
  'worst',
  'disappointed',
];

export function normalizeQuote(text: string): string {
  return String(text || '')
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function fingerprintTestimonial(input: {
  text: string;
  author?: string;
  url?: string;
}): string {
  const base = `${normalizeQuote(input.text)}|${String(input.author || '').toLowerCase().trim()}|${String(input.url || '').trim()}`;
  return createHash('sha256').update(base).digest('hex').slice(0, 32);
}

export function scoreSentiment(text: string): { label: SentimentLabel; score: number } {
  const words = normalizeQuote(text).split(' ').filter(Boolean);
  let score = 0;
  for (const w of words) {
    if (POSITIVE.includes(w)) score += 1;
    if (NEGATIVE.includes(w)) score -= 1;
  }
  const label: SentimentLabel = score > 0 ? 'positive' : score < 0 ? 'negative' : 'neutral';
  return { label, score };
}

export function isDuplicate(
  existing: Testimonial[],
  candidate: { text: string; author?: string; url?: string },
): boolean {
  const fp = fingerprintTestimonial(candidate);
  return existing.some((t) => t.fingerprint === fp);
}
