import { AIVA_DEFAULT_SIGNED_IN_PATH } from '@/lib/aiva-post-auth';
import {
  fetchOnboardingStart,
  getOnboardingChannelsFromLocal,
  mapCatalogChannelsToOnboardingOptions,
} from '@/lib/onboarding-channels';

export type OnboardingTemplateSummary = {
  templateId: string;
  name: string;
  icon: string;
  tagline: string;
  tier: string;
  tierLabel: string;
  setupTimeSeconds: number;
};

export type OnboardingChannelOption = {
  channelId: string;
  label: string;
  iconName: string;
  setupEase: number;
  configureHref: string;
  quickStartHint: string;
};

export const CUSTOM_ONBOARDING_TEMPLATE: OnboardingTemplateSummary = {
  templateId: 'custom',
  name: 'Custom',
  icon: 'sparkles',
  tagline: 'Describe the role you need in your own words.',
  tier: 'starter',
  tierLabel: 'Starter',
  setupTimeSeconds: 60,
};

export function getOnboardingChannels() {
  return getOnboardingChannelsFromLocal();
}

export async function loadOnboardingStart() {
  const remote = await fetchOnboardingStart();
  if (!remote) {
    return {
      templates: [CUSTOM_ONBOARDING_TEMPLATE] as OnboardingTemplateSummary[],
      channels: getOnboardingChannelsFromLocal(),
      customTemplate: CUSTOM_ONBOARDING_TEMPLATE,
    };
  }
  const marketplaceTemplates = remote.templates.filter((template) => template.templateId !== 'custom');
  return {
    templates: [...marketplaceTemplates, remote.customTemplate ?? CUSTOM_ONBOARDING_TEMPLATE],
    channels: mapCatalogChannelsToOnboardingOptions(remote.channels),
    customTemplate: remote.customTemplate ?? CUSTOM_ONBOARDING_TEMPLATE,
  };
}

export function resolveChannelSetupUrl(channelId: string | undefined, workerId?: string): string | null {
  if (!channelId) return null;
  const channel = getOnboardingChannelsFromLocal().find((entry) => entry.channelId === channelId);
  if (!channel) return null;
  if (workerId) {
    return `/aiva/workers/${workerId}/channels`;
  }
  return channel.configureHref;
}

export function buildOnboardingCompleteRedirect(_workspaceId: string): string {
  return AIVA_DEFAULT_SIGNED_IN_PATH;
}

export function mapMarketplaceTemplates(payload: {
  templates?: Array<{
    templateId: string;
    name: string;
    icon: string;
    tagline: string;
    tier: string;
    tierLabel: string;
    setupTimeSeconds: number;
  }>;
}): OnboardingTemplateSummary[] {
  const templates = (payload.templates ?? []).map((template) => ({
    templateId: template.templateId,
    name: template.name,
    icon: template.icon,
    tagline: template.tagline,
    tier: template.tier,
    tierLabel: template.tierLabel,
    setupTimeSeconds: template.setupTimeSeconds,
  }));
  return [...templates, CUSTOM_ONBOARDING_TEMPLATE];
}
