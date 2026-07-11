import type { HostedUser, InstanceConfig } from '@/api/types';

export type CloudFeatureId = 'memory' | 'packs' | 'billing' | 'remote-push' | 'scout-hosted';

const FEATURE_LABELS: Record<CloudFeatureId, string> = {
  memory: 'Memory browser',
  packs: 'Skill packs',
  billing: 'Usage and billing',
  'remote-push': 'Remote push notifications',
  'scout-hosted': 'Hosted Scout controls',
};

export interface CloudFeatureAccess {
  available: boolean;
  reason: string | null;
  featureLabel: string;
}

export function cloudFeatureAccess(
  feature: CloudFeatureId,
  instance: InstanceConfig | null,
  user: HostedUser | null,
): CloudFeatureAccess {
  const featureLabel = FEATURE_LABELS[feature];

  if (!instance?.baseUrl) {
    return {
      available: false,
      featureLabel,
      reason: 'Connect to a Carina gateway first.',
    };
  }

  if (instance.mode === 'self-hosted') {
    return {
      available: false,
      featureLabel,
      reason:
        `${featureLabel} is scoped to Carina Cloud accounts. Self-hosted mode supports chat, trust telemetry, and tasks only.`,
    };
  }

  if (!user) {
    return {
      available: false,
      featureLabel,
      reason: 'Sign in to Carina Cloud to use this feature.',
    };
  }

  return { available: true, featureLabel, reason: null };
}

export function isApiAuthError(message: string): boolean {
  return /\b(401|403)\b/.test(message) || /not signed in|unauthorized/i.test(message);
}
