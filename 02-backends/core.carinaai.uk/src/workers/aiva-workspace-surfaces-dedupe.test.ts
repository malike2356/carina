import { describe, expect, it } from 'vitest';
import {
  normalizeReminderDedupeKey,
  remindersLookSimilar,
} from '../workers/aiva-workspace-surfaces.js';

describe('reminder dedupe helpers', () => {
  it('marks masters certificate variants as similar', () => {
    expect(
      remindersLookSimilar(
        'Masters Certificate Application',
        'Apply for masters certificate from the University',
        'Apply for masters certificate',
        'Request your masters certificate from the University. Added after Selorm claimed DONE',
      ),
    ).toBe(true);
  });

  it('does not match unrelated reminders', () => {
    expect(
      remindersLookSimilar(
        'Masters Certificate Application',
        'Apply for masters certificate',
        'Pay electricity bill',
        'Pay the August electricity bill',
      ),
    ).toBe(false);
  });

  it('normalizes noisy wording', () => {
    const key = normalizeReminderDedupeKey(
      'Apply for masters certificate (follow-up ID test)',
      'Request your masters certificate from the University.',
    );
    expect(key).toContain('masters');
    expect(key).toContain('certificate');
    expect(key).not.toContain('follow');
  });
});
