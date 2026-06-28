import { describe, expect, it } from 'vitest';
import { shouldLoadAivaSubscription } from './aiva-subscription-context';

describe('shouldLoadAivaSubscription', () => {
  it('skips generic Aiva host routes like settings and chat', () => {
    expect(shouldLoadAivaSubscription('/settings', 'aiva')).toBe(false);
    expect(shouldLoadAivaSubscription('/chat/abc', 'aiva')).toBe(false);
  });

  it('loads on Aiva onboarding for the Aiva product host', () => {
    expect(shouldLoadAivaSubscription('/onboarding', 'aiva')).toBe(true);
  });

  it('skips Carina cloud chat and launcher routes', () => {
    expect(shouldLoadAivaSubscription('/chat/5d1c496c', 'cloud')).toBe(false);
    expect(shouldLoadAivaSubscription('/launcher', 'cloud')).toBe(false);
    expect(shouldLoadAivaSubscription('/dashboard', 'cloud')).toBe(false);
  });

  it('loads on cloud host when visiting Aiva or Aiva billing routes', () => {
    expect(shouldLoadAivaSubscription('/aiva/workers', 'cloud')).toBe(true);
    expect(shouldLoadAivaSubscription('/billing/aiva', 'cloud')).toBe(true);
  });
});
