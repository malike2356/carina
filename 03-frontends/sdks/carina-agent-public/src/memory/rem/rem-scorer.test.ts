import { describe, expect, it } from 'vitest';
import {
  distillEpisodeContent,
  inferPromotionTarget,
  scoreEpisode,
} from './rem-scorer.js';

describe('rem-scorer', () => {
  it('scores fact-like user messages higher than fluff', () => {
    const fact = scoreEpisode({
      role: 'user',
      content: 'Remember that I prefer morning standups at 9am UK time.',
    });
    const fluff = scoreEpisode({
      role: 'assistant',
      content: 'Hello! How can I help you today?',
    });
    expect(fact).toBeGreaterThan(fluff);
    expect(fact).toBeGreaterThan(0.5);
  });

  it('infers user target for profile facts', () => {
    expect(inferPromotionTarget('My name is Alex and I work in property.')).toBe('user');
    expect(inferPromotionTarget('Deploy uses pnpm test before release.')).toBe('memory');
  });

  it('distills long content', () => {
    const distilled = distillEpisodeContent('a'.repeat(400));
    expect(distilled.length).toBeLessThanOrEqual(320);
  });
});
