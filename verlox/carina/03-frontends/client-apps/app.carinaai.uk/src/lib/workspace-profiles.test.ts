import { describe, expect, it } from 'vitest';
import {
  BUILTIN_WORKSPACE_PROFILE_IDS,
  loadBuiltinProfilePrompt,
  loadSupportSystemPrompt,
} from './workspace-profiles';

describe('workspace-profiles', () => {
  it('registers the support builtin profile id', () => {
    expect(BUILTIN_WORKSPACE_PROFILE_IDS.support).toBe('support');
    expect(BUILTIN_WORKSPACE_PROFILE_IDS.research).toBe('research');
  });

  it('loads bundled built-in profile prompts', () => {
    const supportPrompt = loadSupportSystemPrompt();
    expect(supportPrompt).toContain('What is Carina AI?');

    const researchPrompt = loadBuiltinProfilePrompt('builtin-profiles/research.md');
    expect(researchPrompt).toContain('Research Assistant mode');
  });
});
