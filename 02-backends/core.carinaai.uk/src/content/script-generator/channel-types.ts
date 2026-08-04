export const CHANNEL_DOMAIN_IDS = [] as string[];
// Runtime domain ids come from GENERATED_DOMAIN_IDS; type is open string for pack growth.
export type ChannelDomainId = string;

export interface ChannelDomainDefinition {
  id: ChannelDomainId;
  label: string;
  description: string;
  focusLabel: string;
  focusPlaceholder: string;
}

export type ChannelNicheId = string;

export interface ChannelNicheDefinition {
  id: ChannelNicheId;
  domainId: ChannelDomainId;
  label: string;
  description: string;
  keywords: string[];
  weeklyThemes: string[];
  hookTemplates: string[];
  ctaTemplates: string[];
}
