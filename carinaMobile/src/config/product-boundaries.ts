/**
 * Vertical packs excluded from Carina mobile defaults.
 * property-uk is owned by the Propreneur assistant product.
 */
export const PROPRIETARY_VERTICAL_PACKS = ['property-uk'] as const;

export type ProprietaryVerticalPack = (typeof PROPRIETARY_VERTICAL_PACKS)[number];

export const DEFAULT_AGENT_MODE = 'general' as const;

export type AgentMode = typeof DEFAULT_AGENT_MODE | 'custom-pack';

export function isPackAllowedOnMobile(packId: string): boolean {
  return !PROPRIETARY_VERTICAL_PACKS.includes(packId as ProprietaryVerticalPack);
}

export function filterMarketplacePacks(packIds: string[]): string[] {
  return packIds.filter(isPackAllowedOnMobile);
}
