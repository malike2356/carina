import { normalizeBrandConfig, type BrandConfig } from '@/lib/brand';

export type WorkspaceOnboardingStep = {
  id: string;
  label: string;
  description: string;
  href: string;
  done: boolean;
};

export type WorkspaceOnboardingChecklist = {
  steps: WorkspaceOnboardingStep[];
  completedCount: number;
  totalCount: number;
  percentComplete: number;
};

export function isBrandConfigured(brand: unknown, defaultProductName = 'Carina Cloud'): boolean {
  const normalized = normalizeBrandConfig(brand);
  if (normalized.logoUrl || normalized.faviconUrl) return true;
  if (normalized.supportEmail || normalized.supportName) return true;
  if (normalized.productName && normalized.productName !== defaultProductName) return true;
  if (normalized.publicSiteTitle && normalized.publicSiteTitle !== defaultProductName) return true;
  if (normalized.colorTokens && Object.keys(normalized.colorTokens).length > 0) return true;
  return false;
}

export function buildWorkspaceOnboardingChecklist(input: {
  keyCount: number;
  brand: unknown;
  activePackCount: number;
  productName?: string;
}): WorkspaceOnboardingChecklist {
  const productName = input.productName?.trim() || 'Carina Cloud';
  const steps: WorkspaceOnboardingStep[] = [
    {
      id: 'keys',
      label: 'Connect a model provider',
      description: 'Add at least one API key so chat can reach your LLM.',
      href: '/settings/keys',
      done: input.keyCount > 0,
    },
    {
      id: 'brand',
      label: 'Configure your brand',
      description: `Set product name, support contact, and colors for ${productName}.`,
      href: '/settings?section=brand',
      done: isBrandConfigured(input.brand, productName),
    },
    {
      id: 'packs',
      label: 'Install skill packs',
      description: 'Enable a vertical bundle that matches what you sell.',
      href: '/packs',
      done: input.activePackCount > 0,
    },
    {
      id: 'handoff',
      label: 'Review handoff guide',
      description: 'Confirm support boundaries before you invite clients.',
      href: '/settings?section=brand',
      done:
        input.keyCount > 0
        && isBrandConfigured(input.brand, productName)
        && input.activePackCount > 0,
    },
  ];

  const completedCount = steps.filter((step) => step.done).length;
  return {
    steps,
    completedCount,
    totalCount: steps.length,
    percentComplete: Math.round((completedCount / steps.length) * 100),
  };
}

export function parseActivePackCount(activeSkillPacks: string): number {
  return activeSkillPacks
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean).length;
}
