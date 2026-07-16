export type DetailsSection = 'thinking' | 'tools' | 'agents' | 'activity' | 'approvals';
export type DetailsMode = 'hidden' | 'collapsed' | 'expanded';

export type DetailsPreferences = Record<DetailsSection, DetailsMode>;

const DEFAULT_DETAILS_PREFERENCES: DetailsPreferences = {
  thinking: 'collapsed',
  tools: 'collapsed',
  agents: 'collapsed',
  activity: 'collapsed',
  approvals: 'collapsed',
};

let preferences: DetailsPreferences = { ...DEFAULT_DETAILS_PREFERENCES };

export function getDetailsPreferences(): DetailsPreferences {
  return { ...preferences };
}

export function setDetailsPreference(section: DetailsSection, mode: DetailsMode): DetailsPreferences {
  preferences = { ...preferences, [section]: mode };
  return getDetailsPreferences();
}

export function parseDetailsPreference(input: string): { section: DetailsSection; mode: DetailsMode } | undefined {
  const [section, mode] = input.trim().toLowerCase().split(/\s+/);
  if (!isDetailsSection(section) || !isDetailsMode(mode)) return undefined;
  return { section, mode };
}

function isDetailsSection(value: string | undefined): value is DetailsSection {
  return value === 'thinking' || value === 'tools' || value === 'agents' || value === 'activity' || value === 'approvals';
}

function isDetailsMode(value: string | undefined): value is DetailsMode {
  return value === 'hidden' || value === 'collapsed' || value === 'expanded';
}
