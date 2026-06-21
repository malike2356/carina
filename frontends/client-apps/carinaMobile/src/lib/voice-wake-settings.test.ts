import { describe, expect, it } from 'vitest';
import { containsWakePhrase, isPrivacyHour } from './voice-wake-settings';

describe('voice-wake-settings', () => {
  it('isPrivacyHour returns true for hours in overnight window', () => {
    expect(isPrivacyHour(22, 22, 7)).toBe(true);
    expect(isPrivacyHour(23, 22, 7)).toBe(true);
    expect(isPrivacyHour(3, 22, 7)).toBe(true);
    expect(isPrivacyHour(6, 22, 7)).toBe(true);
  });

  it('isPrivacyHour returns false outside overnight window', () => {
    expect(isPrivacyHour(7, 22, 7)).toBe(false);
    expect(isPrivacyHour(12, 22, 7)).toBe(false);
    expect(isPrivacyHour(21, 22, 7)).toBe(false);
  });

  it('isPrivacyHour handles same-day window', () => {
    expect(isPrivacyHour(10, 9, 17)).toBe(true);
    expect(isPrivacyHour(8, 9, 17)).toBe(false);
    expect(isPrivacyHour(18, 9, 17)).toBe(false);
  });

  it('containsWakePhrase detects hey carina', () => {
    expect(containsWakePhrase('Hey Carina what is on today')).toBe(true);
    expect(containsWakePhrase('hello there')).toBe(false);
  });
});
