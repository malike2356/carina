import { describe, expect, it } from 'vitest';
import {
  extractCommitmentsHeuristic,
  isExplicitReminderRequest,
} from './extractor.js';

describe('commitment extractor', () => {
  it('skips explicit reminder requests', () => {
    expect(isExplicitReminderRequest('remind me tomorrow at 9am')).toBe(true);
    expect(extractCommitmentsHeuristic({
      userMessage: 'remind me tomorrow at 9am about the call',
      assistantText: 'I will set that reminder for you.',
    })).toEqual([]);
  });

  it('infers interview follow-up', () => {
    const rows = extractCommitmentsHeuristic({
      userMessage: 'I have a job interview tomorrow morning and I am nervous.',
      assistantText: 'Good luck. Prepare a few stories about your recent work.',
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].kind).toBe('check_in');
    expect(rows[0].confidence).toBeGreaterThanOrEqual(0.75);
  });

  it('infers care check-in after stress', () => {
    const rows = extractCommitmentsHeuristic({
      userMessage: 'Today was exhausting and I feel completely overwhelmed.',
      assistantText: 'That sounds rough. Rest if you can.',
    });
    expect(rows[0]?.kind).toBe('care');
  });
});
