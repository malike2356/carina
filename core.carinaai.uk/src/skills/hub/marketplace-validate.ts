import type {
  MarketplaceEntry,
  MarketplaceEntryKind,
  MarketplacePublisher,
  MarketplaceRisk,
  MarketplaceTrust,
  MarketplaceValidationStatus,
} from './marketplace-types.js';
import { marketplaceEntryId } from './marketplace-types.js';

export type MarketplaceEntryInput = Omit<MarketplaceEntry, 'id' | 'status'> & {
  id?: string;
  status?: MarketplaceEntry['status'];
};

const VALID_KINDS = new Set<MarketplaceEntryKind>([
  'pack', 'extension', 'toolset', 'channel', 'workflow', 'theme', 'mcp',
]);

const VALID_PUBLISHERS = new Set<MarketplacePublisher>(['carina', 'verified', 'community']);
const VALID_VALIDATION = new Set<MarketplaceValidationStatus>(['builtin', 'passed', 'pending', 'failed']);
const VALID_RISK = new Set<MarketplaceRisk>(['low', 'medium', 'high']);

export function validateMarketplaceTrust(raw: unknown, context: string): MarketplaceTrust {
  if (!raw || typeof raw !== 'object') {
    throw new Error(`${context}: trust metadata is required`);
  }
  const t = raw as Record<string, unknown>;
  const publisher = String(t.publisher ?? 'community') as MarketplacePublisher;
  if (!VALID_PUBLISHERS.has(publisher)) {
    throw new Error(`${context}: invalid trust.publisher`);
  }
  const validation = String(t.validation ?? 'pending') as MarketplaceValidationStatus;
  if (!VALID_VALIDATION.has(validation)) {
    throw new Error(`${context}: invalid trust.validation`);
  }
  const risk = String(t.risk ?? 'low') as MarketplaceRisk;
  if (!VALID_RISK.has(risk)) {
    throw new Error(`${context}: invalid trust.risk`);
  }
  return {
    publisher,
    featured: t.featured === true,
    verified: t.verified === true,
    validation,
    risk,
    evalRequired: t.evalRequired === true,
  };
}

export function validateMarketplaceEntryInput(
  raw: unknown,
  context = 'marketplace entry',
): MarketplaceEntryInput {
  if (!raw || typeof raw !== 'object') {
    throw new Error(`Invalid ${context}: not an object`);
  }
  const m = raw as Record<string, unknown>;
  const kind = String(m.kind ?? '') as MarketplaceEntryKind;
  if (!VALID_KINDS.has(kind)) {
    throw new Error(`Invalid ${context}: kind must be one of ${[...VALID_KINDS].join(', ')}`);
  }
  const slug = String(m.slug ?? '').trim();
  if (!/^[a-z][a-z0-9-]{0,62}$/.test(slug)) {
    throw new Error(`Invalid ${context}: slug must be lowercase kebab-case`);
  }
  for (const key of ['name', 'version', 'description', 'author'] as const) {
    if (!m[key] || typeof m[key] !== 'string' || !String(m[key]).trim()) {
      throw new Error(`Invalid ${context}: missing ${key}`);
    }
  }
  const installRaw = m.install;
  if (!installRaw || typeof installRaw !== 'object') {
    throw new Error(`Invalid ${context}: install object is required`);
  }
  const install = installRaw as Record<string, unknown>;
  const source = String(install.source ?? 'hub');
  if (!['builtin', 'hub', 'local', 'npm', 'git'].includes(source)) {
    throw new Error(`Invalid ${context}: install.source`);
  }

  const trust = validateMarketplaceTrust(m.trust, context);
  const id = m.id ? String(m.id) : marketplaceEntryId(kind, slug);
  if (id !== marketplaceEntryId(kind, slug) && !String(m.id).includes(':')) {
    throw new Error(`Invalid ${context}: id must match kind:slug`);
  }

  return {
    id,
    kind,
    slug,
    name: String(m.name),
    version: String(m.version),
    description: String(m.description),
    author: String(m.author),
    category: m.category ? String(m.category) : undefined,
    tags: Array.isArray(m.tags) ? m.tags.map(String) : undefined,
    trust,
    install: {
      source: source as MarketplaceEntry['install']['source'],
      ref: install.ref ? String(install.ref) : undefined,
      npmPackage: install.npmPackage ? String(install.npmPackage) : undefined,
      envKeys: Array.isArray(install.envKeys) ? install.envKeys.map(String) : undefined,
      webhook: install.webhook ? String(install.webhook) : undefined,
    },
    stats: m.stats && typeof m.stats === 'object'
      ? {
          downloads: Number((m.stats as Record<string, unknown>).downloads ?? 0) || undefined,
          skillCount: Number((m.stats as Record<string, unknown>).skillCount ?? 0) || undefined,
          toolCount: Number((m.stats as Record<string, unknown>).toolCount ?? 0) || undefined,
        }
      : undefined,
    status: m.status ? String(m.status) as MarketplaceEntry['status'] : 'available',
  };
}

export function normalizeMarketplaceEntry(input: MarketplaceEntryInput): MarketplaceEntry {
  const id = input.id ?? marketplaceEntryId(input.kind, input.slug);
  return {
    ...input,
    id,
    status: input.status ?? 'available',
  };
}

export function assertCatalogIntegrity(entries: MarketplaceEntry[]): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const entry of entries) {
    if (entry.id !== marketplaceEntryId(entry.kind, entry.slug)) {
      errors.push(`${entry.id}: id does not match kind:slug`);
    }
    if (seen.has(entry.id)) {
      errors.push(`${entry.id}: duplicate catalog id`);
    }
    seen.add(entry.id);
    if (!entry.name.trim() || !entry.description.trim()) {
      errors.push(`${entry.id}: missing name or description`);
    }
    if (entry.trust.verified && entry.trust.validation === 'failed') {
      errors.push(`${entry.id}: verified entries cannot have failed validation`);
    }
  }
  return errors;
}
