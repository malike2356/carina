export type BuiltinWorkspaceProfileDefinition = {
  id: string;
  slug: string;
  name: string;
  description: string;
  promptRelativePath: string;
};

export const BUILTIN_WORKSPACE_PROFILE_DEFINITIONS = {
  support: {
    id: 'support',
    slug: 'support',
    name: 'Support',
    description: 'Carina AI and Labyrinth Scout product support with embedded knowledge.',
    promptRelativePath: 'support/system-prompt.md',
  },
  research: {
    id: 'research',
    slug: 'research',
    name: 'Research Assistant',
    description: 'Structured reports, source comparison, and clear summaries.',
    promptRelativePath: 'builtin-profiles/research.md',
  },
  coding: {
    id: 'coding',
    slug: 'coding',
    name: 'Coding Assistant',
    description: 'Precise help with code, debugging, and technical trade-offs.',
    promptRelativePath: 'builtin-profiles/coding.md',
  },
  briefing: {
    id: 'briefing',
    slug: 'briefing',
    name: 'Daily Briefing',
    description: 'Morning priorities, schedule notes, and focused follow-ups.',
    promptRelativePath: 'builtin-profiles/briefing.md',
  },
} as const satisfies Record<string, BuiltinWorkspaceProfileDefinition>;

export const BUILTIN_WORKSPACE_PROFILE_IDS = {
  support: BUILTIN_WORKSPACE_PROFILE_DEFINITIONS.support.id,
  research: BUILTIN_WORKSPACE_PROFILE_DEFINITIONS.research.id,
  coding: BUILTIN_WORKSPACE_PROFILE_DEFINITIONS.coding.id,
  briefing: BUILTIN_WORKSPACE_PROFILE_DEFINITIONS.briefing.id,
} as const;

export type BuiltinWorkspaceProfileId =
  (typeof BUILTIN_WORKSPACE_PROFILE_IDS)[keyof typeof BUILTIN_WORKSPACE_PROFILE_IDS];

export const BUILTIN_WORKSPACE_PROFILE_LIST = Object.values(BUILTIN_WORKSPACE_PROFILE_DEFINITIONS);

export function isBuiltinWorkspaceProfileId(value: string): value is BuiltinWorkspaceProfileId {
  return Object.values(BUILTIN_WORKSPACE_PROFILE_IDS).includes(value as BuiltinWorkspaceProfileId);
}

export function getBuiltinWorkspaceProfileDefinition(
  builtinId: BuiltinWorkspaceProfileId,
): BuiltinWorkspaceProfileDefinition {
  const definition = BUILTIN_WORKSPACE_PROFILE_LIST.find((entry) => entry.id === builtinId);
  if (!definition) {
    throw new Error(`Unknown built-in workspace profile: ${builtinId}`);
  }
  return definition;
}
