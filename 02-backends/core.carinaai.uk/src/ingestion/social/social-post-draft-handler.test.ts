import { describe, expect, it } from 'vitest';
import { isSocialPostAutomation, parseSocialPostChannel } from './social-post-draft-handler.js';

describe('social-post-draft-handler', () => {
  it('detects ilaud social post automation marker', () => {
    expect(isSocialPostAutomation({
      name: 'Weekly post draft',
      description: '[ilaud-social-post:linkedin] Draft one LinkedIn post from recent memory',
    })).toBe(true);
  });

  it('parses channel from marker', () => {
    expect(parseSocialPostChannel('[ilaud-social-post:linkedin] Draft post')).toBe('linkedin');
  });
});
