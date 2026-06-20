import { describe, expect, it } from 'vitest';
import { sanitizeCarinaProse } from './writing-style.js';

describe('sanitizeCarinaProse', () => {
  it('replaces em dashes with semicolons', () => {
    expect(sanitizeCarinaProse('I\u2019m good \u2014 just wrapped up.')).toBe(
      'I\u2019m good; just wrapped up.',
    );
    expect(sanitizeCarinaProse('Hey \u2014 doing well, thanks.')).toBe(
      'Hey; doing well, thanks.',
    );
  });

  it('replaces en dashes with hyphens', () => {
    expect(sanitizeCarinaProse('Pages 10\u201320')).toBe('Pages 10-20');
  });

  it('strips emojis and keeps plain labels where mapped', () => {
    expect(sanitizeCarinaProse('\u2705 Saved')).toBe('Done: Saved');
    expect(sanitizeCarinaProse('Hello \u{1F44B}')).toBe('Hello ');
  });

  it('handles html entities', () => {
    expect(sanitizeCarinaProse('One;two')).toBe('One;two');
  });
});
