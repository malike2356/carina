import { describe, expect, it } from 'vitest';
import { getAivaProductTools, ONBOARDING_PLANS } from './aiva-parity-store.js';

describe('aiva parity catalog bridge', () => {
  it('bridges config catalog into getAivaProductTools', () => {
    const tools = getAivaProductTools();
    expect(tools.length).toBeGreaterThanOrEqual(35);
    expect(tools.some((tool) => tool.slug === 'gmail')).toBe(true);
    expect(tools.some((tool) => tool.slug === 'browser')).toBe(true);
  });

  it('ships EA calendar and helpdesk onboarding plans', () => {
    expect(ONBOARDING_PLANS.map((plan) => plan.id)).toEqual(['ea-calendar', 'helpdesk']);
  });
});
