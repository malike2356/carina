import { searchRag, type RagChunk } from '../memory/store.js';
import type { Tool } from '../types/index.js';

export interface DomainLookupContext {
  [key: string]: unknown;
}

export interface DomainLookupResult {
  found: boolean;
  key: string;
  pack: string;
  title?: string;
  data?: unknown;
  sources?: Array<{ title: string; url?: string; note?: string }>;
  relatedRag?: RagChunk[];
  message?: string;
}

export type DomainLookupHandler = (
  key: string,
  context: DomainLookupContext,
) => Promise<DomainLookupResult | null> | DomainLookupResult | null;

export interface DomainLookupSource {
  pack: string;
  keyPattern: string | RegExp;
  lookup: DomainLookupHandler;
}

const sources: DomainLookupSource[] = [];

function keyMatches(pattern: string | RegExp, key: string): boolean {
  if (typeof pattern === 'string') return pattern === key;
  return pattern.test(key);
}

export function registerDomainLookupSource(source: DomainLookupSource): void {
  sources.push(source);
}

export function clearDomainLookupSourcesForTests(): void {
  sources.length = 0;
}

export async function domainLookup(
  key: string,
  context: DomainLookupContext = {},
): Promise<DomainLookupResult> {
  const normalizedKey = key.trim();
  if (!normalizedKey) {
    return {
      found: false,
      key: normalizedKey,
      pack: 'none',
      message: 'Provide a non-empty domain lookup key.',
    };
  }

  for (const source of sources) {
    if (!keyMatches(source.keyPattern, normalizedKey)) continue;
    const result = await source.lookup(normalizedKey, context);
    if (result) return result;
  }

  const queryParts = [
    normalizedKey.replace(/_/g, ' '),
    typeof context.postcode === 'string' ? context.postcode : '',
    typeof context.area === 'string' ? context.area : '',
  ].filter(Boolean);
  const relatedRag = await searchRag(queryParts.join(' '), 3);

  return {
    found: false,
    key: normalizedKey,
    pack: 'none',
    relatedRag,
    message: `No static domain data is registered for "${normalizedKey}".`,
  };
}

export const domainLookupTool: Tool = {
  name: 'domain_lookup',
  description:
    'Look up structured reference data from an installed skill pack (requires property-uk). Example: UK HMO room-size rules by postcode.',
  parameters: {
    type: 'object',
    properties: {
      key: {
        type: 'string',
        description: 'Domain data key, for example hmo_minimum_room_size.',
      },
      context: {
        type: 'object',
        description: 'Lookup context such as postcode, area, council, or source-specific filters.',
        additionalProperties: true,
      },
    },
    required: ['key'],
  },
  execute: async (params) => {
    return domainLookup(
      String(params.key ?? ''),
      (params.context ?? {}) as DomainLookupContext,
    );
  },
};
