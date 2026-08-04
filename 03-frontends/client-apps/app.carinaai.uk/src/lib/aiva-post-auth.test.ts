import { describe, expect, it } from 'vitest';
import { resolveAivaPostAuthPath, resolveAivaSignedInPath } from './aiva-post-auth';

describe('resolveAivaPostAuthPath', () => {
  it('routes /aiva through onboarding resume', () => {
    expect(resolveAivaPostAuthPath('/aiva')).toBe('/api/workspace/onboarding-resume');
    expect(resolveAivaPostAuthPath('/aiva/workers')).toBe('/api/workspace/onboarding-resume');
  });

  it('keeps explicit non-aiva destinations', () => {
    expect(resolveAivaPostAuthPath('/settings')).toBe('/settings');
    expect(resolveAivaPostAuthPath('/billing/aiva')).toBe('/billing/aiva');
  });

  it('defaults empty callbacks to onboarding resume', () => {
    expect(resolveAivaPostAuthPath(null)).toBe('/api/workspace/onboarding-resume');
    expect(resolveAivaPostAuthPath('')).toBe('/api/workspace/onboarding-resume');
  });
});

describe('resolveAivaSignedInPath', () => {
  it('sends incomplete users to onboarding', () => {
    expect(resolveAivaSignedInPath({ onboardingCompletedAt: null })).toBe('/onboarding');
    expect(resolveAivaSignedInPath({})).toBe('/onboarding');
  });

  it('sends completed users to the Aiva home', () => {
    expect(resolveAivaSignedInPath({ onboardingCompletedAt: new Date() })).toBe('/aiva');
  });
});
