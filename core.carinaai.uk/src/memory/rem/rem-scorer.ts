export type MemoryTier = 'short_term' | 'long_term' | 'archived';

export interface EpisodeScoreInput {
  role: string;
  content: string;
  priority?: number;
  accessCount?: number;
  createdAt?: Date;
}

const FACT_PATTERNS = [
  /\bmy name is\b/i,
  /\bi (work|live|prefer|always|never|usually)\b/i,
  /\bremember\b/i,
  /\bfavorite\b/i,
  /\btimezone\b/i,
  /\bphone\b/i,
  /\bemail\b/i,
  /\bdeadline\b/i,
  /\bgoal\b/i,
];

const FLUFF_PATTERNS = [
  /^(hi|hello|thanks|thank you|ok|sure)\b/i,
  /\?\s*$/,
  /^how can i help/i,
];

export function distillEpisodeContent(content: string): string {
  const line = content.replace(/\s+/g, ' ').trim();
  if (line.length <= 320) return line;
  return `${line.slice(0, 317)}...`;
}

export function inferPromotionTarget(content: string): 'user' | 'memory' {
  const lower = content.toLowerCase();
  if (/\b(i am|my name|i work|i live|timezone|phone|email|birthday)\b/.test(lower)) {
    return 'user';
  }
  return 'memory';
}

export function scoreEpisode(input: EpisodeScoreInput): number {
  const content = input.content.trim();
  if (content.length < 12) return 0;

  let score = 0.2;

  if (input.role === 'user') score += 0.15;
  if (content.length >= 40 && content.length <= 500) score += 0.1;
  if (content.length > 900) score -= 0.1;

  if (FACT_PATTERNS.some((re) => re.test(content))) score += 0.22;
  if (FLUFF_PATTERNS.some((re) => re.test(content))) score -= 0.25;

  const priority = input.priority ?? 0;
  if (priority > 0) score += Math.min(priority * 0.05, 0.2);

  const access = input.accessCount ?? 0;
  score += Math.min(access * 0.06, 0.24);

  if (input.createdAt) {
    const ageHours = (Date.now() - input.createdAt.getTime()) / (1000 * 60 * 60);
    if (ageHours >= 1 && ageHours <= 72) score += 0.05;
    if (ageHours > 168) score -= 0.08;
  }

  return Math.max(0, Math.min(1, Number(score.toFixed(3))));
}

export function buildPromotionRationale(input: EpisodeScoreInput, score: number): string {
  const bits: string[] = [`score=${score}`];
  if (input.role === 'user') bits.push('user-authored');
  if ((input.accessCount ?? 0) > 0) bits.push(`retrieved ${input.accessCount} times`);
  if (FACT_PATTERNS.some((re) => re.test(input.content))) bits.push('fact-like phrasing');
  return bits.join('; ');
}
