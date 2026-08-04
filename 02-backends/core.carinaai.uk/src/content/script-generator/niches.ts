import {
  GENERATED_DOMAIN_IDS,
  GENERATED_DOMAINS,
  GENERATED_NICHE_IDS,
  GENERATED_NICHES,
} from './channel-catalogue.generated.js';
import type {
  ChannelDomainDefinition,
  ChannelDomainId,
  ChannelNicheDefinition,
  ChannelNicheId,
} from './channel-types.js';

export type {
  ChannelDomainDefinition,
  ChannelDomainId,
  ChannelNicheDefinition,
  ChannelNicheId,
} from './channel-types.js';

/** Property niche ids retained for existing runs and calendars. */
export const PROPERTY_NICHE_IDS = [
  'buy-to-let-investment',
  'house-flipping-renovation',
  'commercial-property',
  'hmo-multi-let',
  'property-sourcing',
  'first-time-buyer-guides',
  'landlord-tips-legislation',
  'property-market-analysis',
  'auction-property-walkthroughs',
] as const;

export type PropertyNicheId = (typeof PROPERTY_NICHE_IDS)[number];

/** @deprecated Prefer ChannelNicheDefinition */
export type PropertyNicheDefinition = ChannelNicheDefinition;

export const CHANNEL_DOMAIN_IDS = GENERATED_DOMAIN_IDS as readonly ChannelDomainId[];

export const CHANNEL_DOMAINS = GENERATED_DOMAINS as Record<ChannelDomainId, ChannelDomainDefinition>;

export const CHANNEL_NICHE_IDS = GENERATED_NICHE_IDS as ChannelNicheId[];

export const CHANNEL_NICHES = GENERATED_NICHES as Record<ChannelNicheId, ChannelNicheDefinition>;

/** @deprecated Prefer CHANNEL_NICHES */
export const PROPERTY_NICHES = Object.fromEntries(
  PROPERTY_NICHE_IDS.map((id) => [id, CHANNEL_NICHES[id]]),
) as Record<PropertyNicheId, ChannelNicheDefinition>;

export function listDomains(): ChannelDomainDefinition[] {
  return CHANNEL_DOMAIN_IDS.map((id) => CHANNEL_DOMAINS[id]!);
}

export function getDomain(id: ChannelDomainId): ChannelDomainDefinition {
  const domain = CHANNEL_DOMAINS[id];
  if (!domain) throw new Error(`Unknown channel domain: ${id}`);
  return domain;
}

export function isChannelDomainId(value: string): value is ChannelDomainId {
  return (CHANNEL_DOMAIN_IDS as readonly string[]).includes(value);
}

export function getNiche(id: ChannelNicheId | string): ChannelNicheDefinition {
  const niche = CHANNEL_NICHES[id];
  if (!niche) throw new Error(`Unknown channel niche: ${id}`);
  return niche;
}

export function listNiches(domainId?: ChannelDomainId): ChannelNicheDefinition[] {
  const all = CHANNEL_NICHE_IDS.map((id) => CHANNEL_NICHES[id]!);
  if (!domainId) return all;
  return all.filter((niche) => niche.domainId === domainId);
}

export function isChannelNicheId(value: string): value is ChannelNicheId {
  return Object.prototype.hasOwnProperty.call(CHANNEL_NICHES, value);
}

/** @deprecated Prefer isChannelNicheId */
export function isPropertyNicheId(value: string): value is PropertyNicheId {
  return (PROPERTY_NICHE_IDS as readonly string[]).includes(value);
}

export function nicheBelongsToDomain(nicheId: string, domainId: string): boolean {
  if (!isChannelNicheId(nicheId) || !isChannelDomainId(domainId)) return false;
  return CHANNEL_NICHES[nicheId]!.domainId === domainId;
}

export function resolveDomainForNiche(nicheId: ChannelNicheId): ChannelDomainId {
  return CHANNEL_NICHES[nicheId]!.domainId;
}
