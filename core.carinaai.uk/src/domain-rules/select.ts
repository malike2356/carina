import type { DomainRulePack } from './types.js';

export type DomainRuleSelectionInput = {
  toolNames: string[];
  toolsets: string[];
};

export function selectDomainRulePacks(
  packs: DomainRulePack[],
  input: DomainRuleSelectionInput,
): DomainRulePack[] {
  const names = new Set(input.toolNames);
  const sets = new Set(input.toolsets.map((s) => s.toLowerCase()));

  const selected: DomainRulePack[] = [];
  const seen = new Set<string>();

  for (const pack of packs) {
    const toolMatch = (pack.tools ?? []).some((tool) => names.has(tool));
    const setMatch = (pack.toolsets ?? []).some((set) => sets.has(set.toLowerCase()));
    if (!toolMatch && !setMatch) continue;
    if (seen.has(pack.id)) continue;
    seen.add(pack.id);
    selected.push(pack);
  }

  return selected;
}
