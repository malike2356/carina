import type { Tool } from '../types/index.js';
import { BUILTIN_UTILITY_TOOLS } from '../plugins/utilities/utility-plugins.js';

export function getBuiltinUtilityTool(slug: string): Tool | undefined {
  return BUILTIN_UTILITY_TOOLS[slug];
}

export function listBuiltinUtilitySlugs(): string[] {
  return Object.keys(BUILTIN_UTILITY_TOOLS);
}

export function resolveBuiltinToolFromJson(
  record: Record<string, unknown>,
  prefix: string,
): Tool | null {
  const slug = String(record.builtin ?? record.builtinTool ?? '').trim();
  if (!slug) return null;
  const core = getBuiltinUtilityTool(slug);
  if (!core) return null;
  const name = String(record.name ?? core.name);
  const prefixed = name.startsWith(prefix) ? name : `${prefix}${name}`;
  return {
    ...core,
    name: prefixed,
    description: String(record.description ?? core.description),
    parameters: (record.parameters as Tool['parameters']) ?? core.parameters,
    dangerous: record.dangerous === true ? true : core.dangerous,
    requiresConfirmation: record.requiresConfirmation === true ? true : core.requiresConfirmation,
  };
}
