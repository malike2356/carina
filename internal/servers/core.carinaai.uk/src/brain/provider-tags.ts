import type { ProviderCapabilities } from '../agents/provider-capabilities.js';
import type { ProviderDefinition } from './provider-registry.js';

export type ProviderCostTag = 'local' | 'free' | 'byo-key' | 'paid' | 'oauth' | 'external-cli';
export type ProviderSpeedTag = 'fast' | 'balanced' | 'reasoning';

export interface ProviderRoutingTags {
  cost: ProviderCostTag;
  speed: ProviderSpeedTag;
  chat: boolean;
  code: boolean;
  vision: boolean;
  longContext: boolean;
  toolUse: boolean;
}

const LONG_CONTEXT_PROVIDERS = new Set(['anthropic', 'gemini', 'moonshot', 'openai', 'openrouter']);

export function buildRoutingTags(
  def: Pick<ProviderDefinition, 'name' | 'local' | 'fallbackPriority' | 'capabilities' | 'usdPerToken'>,
  overrides: Partial<ProviderRoutingTags> = {},
): ProviderRoutingTags {
  let cost: ProviderCostTag = 'byo-key';
  if (def.local) {
    cost = 'local';
  } else if (def.usdPerToken === 0 && def.name === 'nvidia') {
    cost = 'byo-key';
  }

  let speed: ProviderSpeedTag = 'balanced';
  if (def.fallbackPriority <= 3) speed = 'fast';
  else if (def.fallbackPriority >= 13) speed = 'reasoning';

  const caps = def.capabilities;
  return {
    cost,
    speed,
    chat: caps.chat,
    code: caps.tools,
    vision: caps.vision,
    longContext: LONG_CONTEXT_PROVIDERS.has(def.name),
    toolUse: caps.tools,
    ...overrides,
  };
}

export function operatorFreeProviderNames(): Set<string> {
  const raw = process.env.CARINA_FREE_PROVIDERS ?? '';
  return new Set(raw.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean));
}

export function isOperatorFreeProvider(name: string): boolean {
  return operatorFreeProviderNames().has(name);
}

export type ProviderCapabilityNeed = 'chat' | 'code' | 'vision' | 'longContext' | 'toolUse';

export function providerMeetsCapability(
  tags: ProviderRoutingTags,
  need: ProviderCapabilityNeed,
): boolean {
  switch (need) {
    case 'chat': return tags.chat;
    case 'code': return tags.code;
    case 'vision': return tags.vision;
    case 'longContext': return tags.longContext;
    case 'toolUse': return tags.toolUse;
    default: return true;
  }
}

export function describeProviderTags(def: ProviderDefinition): string {
  const t = def.tags;
  const parts: string[] = [t.cost, t.speed];
  if (t.toolUse) parts.push('tools');
  if (t.vision) parts.push('vision');
  if (t.longContext) parts.push('long-context');
  return parts.join(', ');
}

export function providerCostLabel(cost: ProviderCostTag): string {
  switch (cost) {
    case 'local': return 'local / free';
    case 'free': return 'free tier';
    case 'byo-key': return 'byo-key';
    case 'paid': return 'paid';
    case 'oauth': return 'oauth';
    case 'external-cli': return 'external-cli';
    default: return cost;
  }
}
