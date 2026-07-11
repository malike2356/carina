import type { RiskTier, SecuritySeverity } from '@/api/types';
import { colors } from '@/theme/tokens';

export const RISK_TIER_COLORS: Record<RiskTier, string> = {
  low: colors.success,
  moderate: colors.amber,
  elevated: '#e67e22',
  high: colors.danger,
  critical: colors.danger,
};

export const SEVERITY_COLORS: Record<SecuritySeverity, string> = {
  info: colors.tealLight,
  warning: colors.amber,
  critical: colors.danger,
  breach: colors.danger,
};

export function riskTierColor(tier: RiskTier | string | undefined): string {
  if (tier && tier in RISK_TIER_COLORS) {
    return RISK_TIER_COLORS[tier as RiskTier];
  }
  return colors.tealLight;
}

export function severityColor(severity: SecuritySeverity | string): string {
  if (severity in SEVERITY_COLORS) {
    return SEVERITY_COLORS[severity as SecuritySeverity];
  }
  return colors.silver;
}
