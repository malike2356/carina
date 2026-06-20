export enum WorkspaceTier {
  SELF_HOSTED = 'self-hosted',
  CLOUD = 'cloud',
  MONITOR = 'monitor',
  GOVERN = 'govern',
  ENTERPRISE = 'enterprise',
}

export const TIER_ORDER: Record<WorkspaceTier, number> = {
  [WorkspaceTier.SELF_HOSTED]: 0,
  [WorkspaceTier.CLOUD]: 1,
  [WorkspaceTier.MONITOR]: 2,
  [WorkspaceTier.GOVERN]: 3,
  [WorkspaceTier.ENTERPRISE]: 4,
};

export interface TierInfo {
  id: WorkspaceTier;
  name: string;
  toolCount: number;
  description: string;
}

export const UPGRADE_URL = process.env.SCOUT_UPGRADE_URL || 'https://labyrinthscout.com/pricing';
export const ENTERPRISE_URL = process.env.SCOUT_ENTERPRISE_URL || 'https://labyrinthscout.com/enterprise';

export const TIER_INFO: Record<WorkspaceTier, TierInfo> = {
  [WorkspaceTier.SELF_HOSTED]: {
    id: WorkspaceTier.SELF_HOSTED,
    name: 'Self-Hosted Carina',
    toolCount: 8,
    description: 'Basic reconnaissance tools. Discover targets, map surfaces.',
  },
  [WorkspaceTier.CLOUD]: {
    id: WorkspaceTier.CLOUD,
    name: 'Cloud Carina',
    toolCount: 20,
    description: 'Vulnerability scanning and OSINT. Find CVEs, discover exposures.',
  },
  [WorkspaceTier.MONITOR]: {
    id: WorkspaceTier.MONITOR,
    name: 'Scout Monitor',
    toolCount: 55,
    description: 'Full exploitation, wireless, and traffic analysis.',
  },
  [WorkspaceTier.GOVERN]: {
    id: WorkspaceTier.GOVERN,
    name: 'Scout Govern',
    toolCount: 72,
    description: 'Complete forensics pipeline and compliance.',
  },
  [WorkspaceTier.ENTERPRISE]: {
    id: WorkspaceTier.ENTERPRISE,
    name: 'Enterprise',
    toolCount: 72,
    description: 'SSO, data residency, SLA, dedicated infrastructure.',
  },
};

export function getUpgradePath(currentTier: WorkspaceTier): TierInfo[] {
  const currentLevel = TIER_ORDER[currentTier];
  return Object.values(TIER_INFO)
    .filter((t) => TIER_ORDER[t.id] > currentLevel)
    .sort((a, b) => TIER_ORDER[a.id] - TIER_ORDER[b.id]);
}

export function parseWorkspaceTier(raw: string | undefined): WorkspaceTier | null {
  if (!raw) return null;
  const normalized = raw.trim().toLowerCase();
  const values = Object.values(WorkspaceTier);
  return values.includes(normalized as WorkspaceTier) ? normalized as WorkspaceTier : null;
}
