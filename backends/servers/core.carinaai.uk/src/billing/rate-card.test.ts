import { describe, expect, it } from 'vitest';
import {
  classifyModel,
  computeBillableCredits,
  type RateCard,
} from './rate-card.js';

const balancedCard: RateCard = {
  id: 1,
  modelClass: 'balanced',
  inputWeight: 0.000006,
  outputWeight: 0.000024,
  cacheWeight: 0.0000015,
};

const premiumCard: RateCard = {
  id: 2,
  modelClass: 'premium',
  inputWeight: 0.000020,
  outputWeight: 0.000080,
  cacheWeight: 0.0000050,
};

describe('classifyModel', () => {
  it('maps known models to expected classes', () => {
    expect(classifyModel('gpt-4o-mini')).toBe('mini');
    expect(classifyModel('claude-3-5-haiku-20241022')).toBe('mini');
    expect(classifyModel('gpt-4o')).toBe('balanced');
    expect(classifyModel('claude-sonnet-4-20250514')).toBe('balanced');
    expect(classifyModel('claude-opus-4-20250514')).toBe('premium');
    expect(classifyModel('o3-mini')).toBe('premium');
    expect(classifyModel('gpt-5-preview')).toBe('frontier');
  });

  it('defaults unknown models to balanced', () => {
    expect(classifyModel('some-new-model-v9')).toBe('balanced');
  });
});

describe('computeBillableCredits', () => {
  it('applies directional weights and rounds up to 6 decimals', () => {
    const credits = computeBillableCredits(balancedCard, 1000, 500, 200);
    expect(credits).toBe(0.018301);
  });

  it('burns more credits for premium than balanced at identical token counts', () => {
    const balanced = computeBillableCredits(balancedCard, 1000, 1000, 0);
    const premium = computeBillableCredits(premiumCard, 1000, 1000, 0);
    expect(premium).toBeGreaterThan(balanced);
  });
});
