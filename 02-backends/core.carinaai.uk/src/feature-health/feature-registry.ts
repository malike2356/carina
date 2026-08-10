/**
 * Feature inventory for health audits and fix-before-build gates.
 */

export type FeatureStatus = 'healthy' | 'degraded' | 'broken';

export type FeatureHealth = {
  name: string;
  status: FeatureStatus;
  activeUsers7d: number;
  errorRate7d: number;
  adoptionRate: number;
  lastDeployed: string | null;
  lastTested: string | null;
};

export type FeatureDefinition = {
  name: string;
  endpoints: string[];
  owner: string;
  /** Payments, auth, or other revenue-critical path. */
  criticalPath?: boolean;
  revenueImpact?: number;
  lastDeployed?: string | null;
};

export type RegisteredFeature = FeatureDefinition & {
  health: FeatureHealth;
};

const registry = new Map<string, RegisteredFeature>();

function emptyHealth(name: string, lastDeployed: string | null = null): FeatureHealth {
  return {
    name,
    status: 'healthy',
    activeUsers7d: 0,
    errorRate7d: 0,
    adoptionRate: 0,
    lastDeployed,
    lastTested: null,
  };
}

export function registerFeature(
  name: string,
  endpoints: string[],
  owner: string,
  opts?: {
    criticalPath?: boolean;
    revenueImpact?: number;
    lastDeployed?: string | null;
  },
): RegisteredFeature {
  const key = name.trim().toLowerCase();
  if (!key) throw new Error('feature name required');
  const existing = registry.get(key);
  const row: RegisteredFeature = {
    name: key,
    endpoints: [...endpoints],
    owner: owner.trim() || 'unassigned',
    criticalPath: opts?.criticalPath ?? existing?.criticalPath ?? false,
    revenueImpact: opts?.revenueImpact ?? existing?.revenueImpact ?? 0,
    lastDeployed: opts?.lastDeployed ?? existing?.lastDeployed ?? null,
    health: existing?.health
      ?? emptyHealth(key, opts?.lastDeployed ?? null),
  };
  if (opts?.lastDeployed !== undefined) {
    row.health.lastDeployed = opts.lastDeployed;
  }
  registry.set(key, row);
  return row;
}

export function updateFeatureHealth(
  name: string,
  patch: Partial<FeatureHealth>,
): RegisteredFeature | null {
  const key = name.trim().toLowerCase();
  const row = registry.get(key);
  if (!row) return null;
  row.health = { ...row.health, ...patch, name: key };
  return row;
}

export function getFeature(name: string): RegisteredFeature | null {
  return registry.get(name.trim().toLowerCase()) ?? null;
}

export function getAllFeatures(): RegisteredFeature[] {
  return [...registry.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function clearFeatureRegistry(): void {
  registry.clear();
}

export function trafficLight(status: FeatureStatus): 'green' | 'yellow' | 'red' {
  if (status === 'healthy') return 'green';
  if (status === 'degraded') return 'yellow';
  return 'red';
}
