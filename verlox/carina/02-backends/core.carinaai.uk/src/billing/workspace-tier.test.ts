import { describe, expect, it } from 'vitest';
import {
  isAivaAssignableCheckoutTier,
  isAivaCheckoutTier,
  isAivaSpecialCheckoutTier,
  slotLimitForTier,
  tierDisplayLabel,
} from './workspace-tier.js';

describe('workspace-tier prompt_rate', () => {
  it('treats prompt_rate as special assignable checkout, not public marketing', () => {
    expect(isAivaCheckoutTier('prompt_rate')).toBe(false);
    expect(isAivaSpecialCheckoutTier('prompt_rate')).toBe(true);
    expect(isAivaAssignableCheckoutTier('prompt_rate')).toBe(true);
    expect(slotLimitForTier('prompt_rate')).toBe(2);
    expect(tierDisplayLabel('prompt_rate')).toBe('Prompt Rate');
  });
});
