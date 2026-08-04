import { describe, expect, it } from 'vitest';
import {
  AIVA_CHANNEL_OPTIONS,
  AIVA_SOCIAL_CHANNEL_OPTIONS,
} from './aiva-role-templates';

describe('AIVA_CHANNEL_OPTIONS', () => {
  it('includes all social channel ids', () => {
    const ids = AIVA_CHANNEL_OPTIONS.map((option) => option.id);
    expect(ids).toEqual(expect.arrayContaining([
      'linkedin',
      'instagram',
      'messenger',
      'twitter',
      'tiktok',
    ]));
  });

  it('exposes social options with subtitles', () => {
    expect(AIVA_SOCIAL_CHANNEL_OPTIONS).toHaveLength(5);
    expect(AIVA_SOCIAL_CHANNEL_OPTIONS.find((option) => option.id === 'twitter')?.label).toBe(
      'X (Twitter)',
    );
  });
});
