import { BILLING_PLANS } from '../billing/plans.js';

export type EnterpriseSupportTier = 'community' | 'carina_ops_team' | 'scout_pro' | 'enterprise';

export type SupportSla = {
  tier: EnterpriseSupportTier;
  name: string;
  responseHours: number | null;
  uptimeSla: string | null;
  channels: string[];
  includes: string[];
  mitKernel: boolean;
  contractRequired: boolean;
};

export const ENTERPRISE_SUPPORT_SLAS: Record<EnterpriseSupportTier, SupportSla> = {
  community: {
    tier: 'community',
    name: 'MIT Community (self-host)',
    responseHours: null,
    uptimeSla: null,
    channels: ['github-issues', 'docs'],
    includes: [
      'MIT-licensed @verlox/carina-core kernel',
      'Community docs and hub marketplace',
      'No SLA; best-effort community support',
    ],
    mitKernel: true,
    contractRequired: false,
  },
  carina_ops_team: {
    tier: 'carina_ops_team',
    name: 'Carina Ops Team',
    responseHours: 24,
    uptimeSla: '99.5%',
    channels: ['email', 'in-app'],
    includes: [
      'Hosted workspace billing and usage metering',
      'Team seat management',
      'Kernel updates via managed deploy',
    ],
    mitKernel: true,
    contractRequired: false,
  },
  scout_pro: {
    tier: 'scout_pro',
    name: 'Scout Pro',
    responseHours: 8,
    uptimeSla: '99.9%',
    channels: ['email', 'slack'],
    includes: [
      ...BILLING_PLANS.scout_pro.features,
      'Scout security layer on Carina kernel',
    ],
    mitKernel: true,
    contractRequired: false,
  },
  enterprise: {
    tier: 'enterprise',
    name: 'Carina Enterprise Supported',
    responseHours: 4,
    uptimeSla: '99.9%',
    channels: ['email', 'slack', 'dedicated-csm'],
    includes: [
      ...BILLING_PLANS.enterprise.features,
      'Red Hat model: MIT kernel stays free; support and compliance are paid',
      'Built on Carina certification review',
      'Optional on-premise kernel deployment',
    ],
    mitKernel: true,
    contractRequired: true,
  },
};

export function resolveActiveSupportTier(): EnterpriseSupportTier {
  if (process.env.CARINA_ENTERPRISE_CONTRACT === 'true') return 'enterprise';
  if (process.env.CARINA_OPS_PLAN === 'carina_ops_team') return 'carina_ops_team';
  if (process.env.LABYRINTH_ENABLED === 'true') return 'scout_pro';
  return 'community';
}

export function describeEnterpriseOffering(): {
  model: string;
  activeTier: EnterpriseSupportTier;
  sla: SupportSla;
  kernelLicense: 'MIT';
  paidLayers: string[];
} {
  const activeTier = resolveActiveSupportTier();
  return {
    model: 'MIT kernel (free) + commercial security (Scout) + commercial hosting (Carina Ops) + Enterprise support contract',
    activeTier,
    sla: ENTERPRISE_SUPPORT_SLAS[activeTier],
    kernelLicense: 'MIT',
    paidLayers: ['Scout security', 'Carina Ops hosting', 'Enterprise support SLA'],
  };
}
