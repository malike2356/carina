export type PlanTier = 'free' | 'carina_ops_starter' | 'carina_ops_team';

export interface PlanFeatureLimits {
  opsConsole: boolean;
  maxMembers: number;
  maxByokProviders: number;
  auditRetentionDays: number;
  monthlyTokenLimit: number;
  deployments: boolean;
  exports: boolean;
}

export const PLAN_FEATURES: Record<PlanTier, PlanFeatureLimits> = {
  free: {
    opsConsole: false,
    maxMembers: 1,
    maxByokProviders: 0,
    auditRetentionDays: 0,
    monthlyTokenLimit: 0,
    deployments: false,
    exports: false,
  },
  carina_ops_starter: {
    opsConsole: true,
    maxMembers: 3,
    maxByokProviders: 3,
    auditRetentionDays: 14,
    monthlyTokenLimit: 500_000,
    deployments: false,
    exports: false,
  },
  carina_ops_team: {
    opsConsole: true,
    maxMembers: 50,
    maxByokProviders: 10,
    auditRetentionDays: 90,
    monthlyTokenLimit: 2_000_000,
    deployments: true,
    exports: true,
  },
};

const PLAN_ALIASES: Record<string, PlanTier> = {
  free: 'free',
  carina_ops_starter: 'carina_ops_starter',
  carina_ops_team: 'carina_ops_team',
};

export function normalizePlanId(raw: string): PlanTier {
  return PLAN_ALIASES[raw] ?? 'free';
}
