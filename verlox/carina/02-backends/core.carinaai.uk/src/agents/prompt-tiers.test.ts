import { describe, expect, it } from 'vitest';
import {
  buildSessionMetadataLine,
  emptyPromptTiers,
  joinPromptTiers,
  pushPromptTier,
} from './prompt-tiers.js';

describe('prompt-tiers', () => {
  it('orders stable, context, then volatile', () => {
    const tiers = emptyPromptTiers();
    pushPromptTier(tiers, 'stable', 'identity');
    pushPromptTier(tiers, 'context', 'workspace');
    pushPromptTier(tiers, 'volatile', 'checklist');

    expect(joinPromptTiers(tiers)).toBe('identity\n\n---\n\nworkspace\n\n---\n\nchecklist');
  });

  it('builds session metadata line', () => {
    const line = buildSessionMetadataLine({
      sessionId: 'sess-1',
      provider: 'openai',
      model: 'gpt-4o',
      platform: 'web',
    });
    expect(line).toContain('Session: sess-1');
    expect(line).toContain('Provider: openai');
    expect(line).toContain('Surface: web');
  });
});
