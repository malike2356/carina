import { describe, expect, it } from 'vitest';
import {
  BUILTIN_WORKSPACE_PROFILE_IDS,
  loadSupportSystemPrompt,
} from './workspace-profiles';

describe('workspace-profiles', () => {
  it('registers the support builtin profile id', () => {
    expect(BUILTIN_WORKSPACE_PROFILE_IDS.support).toBe('support');
  });

  it('loads the bundled support system prompt', () => {
    const prompt = loadSupportSystemPrompt();
    expect(prompt).toContain('You are Carina, the built-in support assistant');
    expect(prompt).toContain('Labyrinth Scout');
    expect(prompt).toContain('Product knowledge reference');
  });
});
