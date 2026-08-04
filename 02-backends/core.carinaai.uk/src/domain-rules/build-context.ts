import type { DomainRulePack } from './types.js';

export function buildDomainRulesContext(packs: DomainRulePack[]): string | null {
  if (packs.length === 0) return null;

  const sections = packs.map((pack) => {
    const lines = pack.rules.map((rule) => `- ${rule}`);
    return `${pack.label}:\n${lines.join('\n')}`;
  });

  return [
    'Domain rules (injected because matching tools are enabled for this session):',
    ...sections,
  ].join('\n\n');
}
