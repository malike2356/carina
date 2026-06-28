import { describe, expect, it } from 'vitest';
import {
  BUILTIN_WORKSPACE_PROFILE_DEFINITIONS,
  BUILTIN_WORKSPACE_PROFILE_IDS,
  BUILTIN_WORKSPACE_PROFILE_LIST,
  getBuiltinWorkspaceProfileDefinition,
  isBuiltinWorkspaceProfileId,
} from './builtin-workspace-profiles';

describe('builtin-workspace-profiles', () => {
  it('registers the shipped built-in profile ids', () => {
    expect(BUILTIN_WORKSPACE_PROFILE_IDS.support).toBe('support');
    expect(BUILTIN_WORKSPACE_PROFILE_IDS.research).toBe('research');
    expect(BUILTIN_WORKSPACE_PROFILE_IDS.coding).toBe('coding');
    expect(BUILTIN_WORKSPACE_PROFILE_IDS.briefing).toBe('briefing');
  });

  it('keeps catalog entries aligned with ids and prompt paths', () => {
    expect(BUILTIN_WORKSPACE_PROFILE_LIST).toHaveLength(4);
    for (const definition of BUILTIN_WORKSPACE_PROFILE_LIST) {
      expect(definition.id).toBe(definition.slug);
      expect(definition.promptRelativePath.endsWith('.md')).toBe(true);
      expect(getBuiltinWorkspaceProfileDefinition(definition.id).name).toBe(definition.name);
    }
    expect(Object.keys(BUILTIN_WORKSPACE_PROFILE_DEFINITIONS)).toEqual([
      'support',
      'research',
      'coding',
      'briefing',
    ]);
  });

  it('validates builtin profile ids', () => {
    expect(isBuiltinWorkspaceProfileId('research')).toBe(true);
    expect(isBuiltinWorkspaceProfileId('custom')).toBe(false);
  });
});
