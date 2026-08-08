import { describe, expect, it } from 'vitest';
import { dangerTone, successTone, warnTone } from './ui-tones';

describe('ui-tones', () => {
  it('uses dual-mode warn text (dark on light, light on dark)', () => {
    expect(warnTone.text).toContain('text-amber-950');
    expect(warnTone.text).toContain('dark:text-amber-100');
    expect(warnTone.chipSoft).toContain('text-amber-900');
    expect(warnTone.chipSoft).toContain('dark:text-amber-300');
  });

  it('keeps danger and success chips dual-mode', () => {
    expect(dangerTone.text).toContain('text-red-800');
    expect(dangerTone.text).toContain('dark:text-red-200');
    expect(successTone.chipSoft).toContain('text-emerald-800');
    expect(successTone.chipSoft).toContain('dark:text-emerald-300');
  });
});
