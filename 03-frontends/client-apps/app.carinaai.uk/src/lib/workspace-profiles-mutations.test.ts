import { describe, expect, it } from 'vitest';
import {
  normalizeProfileSlug,
  RESERVED_WORKSPACE_PROFILE_SLUGS,
  validateWorkspaceProfileInput,
} from './workspace-profiles';

describe('workspace profile mutations', () => {
  it('normalizes profile slugs', () => {
    expect(normalizeProfileSlug('  Research Assistant ')).toBe('research-assistant');
    expect(normalizeProfileSlug('Legal / Compliance')).toBe('legal-compliance');
  });

  it('rejects reserved slugs', () => {
    for (const slug of RESERVED_WORKSPACE_PROFILE_SLUGS) {
      const error = validateWorkspaceProfileInput({
        name: 'Test',
        slug,
        systemPrompt: 'You are helpful.',
      });
      expect(error).toContain('reserved');
    }
  });

  it('requires name and system prompt', () => {
    expect(
      validateWorkspaceProfileInput({
        name: '',
        systemPrompt: '',
      }),
    ).toBe('Name is required');

    expect(
      validateWorkspaceProfileInput({
        name: 'Writer',
        systemPrompt: '   ',
      }),
    ).toBe('System prompt is required');
  });

  it('accepts valid custom profile input', () => {
    expect(
      validateWorkspaceProfileInput({
        name: 'Writer',
        description: 'Helps draft copy.',
        systemPrompt: 'You write concise product copy.',
      }),
    ).toBeNull();
  });
});
