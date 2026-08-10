import { describe, expect, it } from 'vitest';
import { aivaQualityProfile, aivaQualitySettings, listAivaQualityProfiles } from './aiva-quality-profiles.js';

describe('Aiva quality profiles', () => {
  it('keeps greetings fast while preserving a full owner loop for work', () => {
    expect(aivaQualityProfile({ simpleTurn: true })).toBe('social_fast');
    expect(aivaQualitySettings(aivaQualityProfile()).useFullAgentLoop).toBe(true);
    expect(aivaQualitySettings(aivaQualityProfile({ deepTask: true })).profile).toBe('owner_deep');
  });

  it('bounds public customer work without downgrading owner work', () => {
    const customer = aivaQualitySettings(aivaQualityProfile({ audiencePrincipal: true }));
    const owner = aivaQualitySettings(aivaQualityProfile());
    expect(customer.profile).toBe('customer_safe');
    expect(customer.blockExpensiveModels).toBe(true);
    expect(owner.blockExpensiveModels).toBe(false);
    expect(owner.maxTurns).toBeGreaterThan(customer.maxTurns);
  });

  it('exposes a finite documented profile catalogue', () => {
    expect(listAivaQualityProfiles().map((profile) => profile.profile)).toEqual([
      'social_fast', 'owner_standard', 'owner_deep', 'customer_safe', 'fallback_full',
    ]);
  });
});
