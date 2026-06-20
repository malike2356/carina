import { BUILTIN_DOMAIN_RULE_PACKS } from './builtin-packs.js';
import type { DomainRulePack } from './types.js';

const extensionPacks: DomainRulePack[] = [];

export function listBuiltinDomainRulePacks(): DomainRulePack[] {
  return [...BUILTIN_DOMAIN_RULE_PACKS];
}

export function listExtensionDomainRulePacks(): DomainRulePack[] {
  return [...extensionPacks];
}

export function listAllDomainRulePacks(): DomainRulePack[] {
  return [...BUILTIN_DOMAIN_RULE_PACKS, ...extensionPacks];
}

export function registerExtensionRulePacks(
  packs: DomainRulePack[],
  source: string,
): void {
  for (const pack of packs) {
    extensionPacks.push({ ...pack, source });
  }
}

export function unregisterExtensionRulePacks(source: string): void {
  for (let i = extensionPacks.length - 1; i >= 0; i -= 1) {
    if (extensionPacks[i]?.source === source) {
      extensionPacks.splice(i, 1);
    }
  }
}

export function clearExtensionRulePacks(): void {
  extensionPacks.length = 0;
}
