import { describe, expect, it } from 'vitest';
import { getProfileStarterTemplate, PROFILE_STARTER_TEMPLATES } from './profile-templates';

describe('profile-templates', () => {
  it('includes starter templates for common personas', () => {
    expect(PROFILE_STARTER_TEMPLATES.map((template) => template.id)).toEqual([
      'blank',
      'research',
      'writer',
      'coding',
      'briefing',
    ]);
  });

  it('resolves a template by id', () => {
    const template = getProfileStarterTemplate('writer');
    expect(template?.name).toBe('Writer');
    expect(template?.systemPrompt).toContain('writing assistant');
  });
});
