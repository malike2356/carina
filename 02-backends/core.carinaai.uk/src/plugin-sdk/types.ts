import type { Tool } from '../types/index.js';
import type { DomainRulePack } from '../domain-rules/types.js';

export type { Tool };
export type { DomainRulePack };

export type ExtensionToolModule = {
  tools: Tool[];
};

export type ExtensionRulePackFile = DomainRulePack | DomainRulePack[];

export function validateDomainRulePack(raw: unknown, context = 'rule pack'): DomainRulePack {
  if (!raw || typeof raw !== 'object') {
    throw new Error(`Invalid ${context}: not an object`);
  }
  const rec = raw as Record<string, unknown>;
  const id = String(rec.id ?? '').trim();
  const label = String(rec.label ?? '').trim();
  if (!id || !/^[a-z][a-z0-9_-]{1,63}$/.test(id)) {
    throw new Error(`Invalid ${context}: id must be a lowercase slug`);
  }
  if (!label) {
    throw new Error(`Invalid ${context}: label is required`);
  }
  const rulesRaw = rec.rules;
  if (!Array.isArray(rulesRaw) || rulesRaw.length === 0) {
    throw new Error(`Invalid ${context}: rules must be a non-empty array`);
  }
  const rules = rulesRaw.map((r) => String(r).trim()).filter(Boolean);
  if (rules.length === 0) {
    throw new Error(`Invalid ${context}: rules cannot be empty strings`);
  }

  const toolsets = Array.isArray(rec.toolsets)
    ? rec.toolsets.map((s) => String(s).trim()).filter(Boolean)
    : undefined;
  const tools = Array.isArray(rec.tools)
    ? rec.tools.map((s) => String(s).trim()).filter(Boolean)
    : undefined;

  if ((!toolsets || toolsets.length === 0) && (!tools || tools.length === 0)) {
    throw new Error(`Invalid ${context}: at least one toolsets or tools entry is required`);
  }

  return {
    id,
    label,
    toolsets,
    tools,
    rules,
    source: rec.source ? String(rec.source) : undefined,
  };
}

export function parseDomainRulePackFile(raw: unknown, context = 'rules file'): DomainRulePack[] {
  if (Array.isArray(raw)) {
    return raw.map((item, index) => validateDomainRulePack(item, `${context}[${index}]`));
  }
  return [validateDomainRulePack(raw, context)];
}

export function normaliseExtensionTools(mod: unknown): Tool[] {
  if (!mod || typeof mod !== 'object') return [];
  const rec = mod as Record<string, unknown>;
  const exported = rec.tools ?? rec.default;
  const list = Array.isArray(exported) ? exported : exported ? [exported] : [];
  return list.filter((item): item is Tool => {
    if (!item || typeof item !== 'object') return false;
    const tool = item as Tool;
    return Boolean(tool.name && tool.description && typeof tool.execute === 'function');
  });
}

export function normaliseExtensionRulePacks(mod: unknown): DomainRulePack[] {
  if (!mod || typeof mod !== 'object') return [];
  const rec = mod as Record<string, unknown>;
  const exported = rec.rulePacks ?? rec.rules ?? rec.default;
  if (!exported) return [];
  return parseDomainRulePackFile(exported);
}
