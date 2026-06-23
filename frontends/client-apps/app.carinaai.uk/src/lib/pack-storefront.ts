export type PackOwnership = 'platform' | 'reseller' | 'customer';

export type PackCatalogRecord = {
  slug: string;
  ownership: PackOwnership;
  ownerId?: string;
  visible: boolean;
  label?: string;
};

export type VerticalTemplate = {
  id: string;
  name: string;
  description: string;
  packs: string[];
  featured?: boolean;
};

export type StorefrontPack = {
  slug: string;
  name: string;
  description: string;
  version: string;
  category?: string;
  ownership: PackOwnership;
  visible: boolean;
  installed: boolean;
  label?: string;
};

export type PackStorefront = {
  productName: string;
  marketplaceEnabled: boolean;
  templates: VerticalTemplate[];
  packs: StorefrontPack[];
  activePacks: string[];
};

export const PLATFORM_PACKS: Record<string, { name: string; description: string; version: string; category?: string }> = {
  'property-uk': {
    name: 'property-uk',
    description: 'UK property entrepreneurship',
    version: '1.0.0',
    category: 'property',
  },
  'legal-uk': {
    name: 'legal-uk',
    description: 'UK property law and tenancy workflows',
    version: '1.0.0',
    category: 'legal',
  },
  finance: {
    name: 'finance',
    description: 'Cashflow, VAT, invoicing, and investment analysis',
    version: '1.0.0',
    category: 'finance',
  },
  healthcare: {
    name: 'healthcare',
    description: 'Clinical notes, scheduling, medications, and compliance',
    version: '1.0.0',
    category: 'healthcare',
  },
  'sales-crm': {
    name: 'sales-crm',
    description: 'Pipeline review, follow-up cadence, and objections',
    version: '1.0.0',
    category: 'sales',
  },
  productivity: {
    name: 'productivity',
    description: 'Google, Notion, OCR, weather, and news utilities',
    version: '1.0.0',
    category: 'productivity',
  },
  'operator-daily': {
    name: 'operator-daily',
    description: 'Daily operator workflows and voice briefings',
    version: '1.0.0',
    category: 'operator',
  },
  'capabilities-ops': {
    name: 'capabilities-ops',
    description: 'Capability discovery and channel health utilities',
    version: '1.0.0',
    category: 'operator',
  },
  'email-extended': {
    name: 'email-extended',
    description: 'Inbox triage, templates, and email channel helpers',
    version: '1.0.0',
    category: 'email',
  },
  'core-engineering': {
    name: 'core-engineering',
    description: 'Coding, GitHub, debugging, and automation',
    version: '1.0.0',
    category: 'engineering',
  },
};

export const VERTICAL_TEMPLATES: VerticalTemplate[] = [
  {
    id: 'property',
    name: 'Property',
    description: 'UK property workflows: lettings, compliance, and legal context.',
    packs: ['property-uk', 'legal-uk'],
    featured: true,
  },
  {
    id: 'legal',
    name: 'Legal',
    description: 'Contract review, tenancy law, and compliance checklists.',
    packs: ['legal-uk'],
  },
  {
    id: 'finance',
    name: 'Finance',
    description: 'Cashflow, VAT, invoicing, and investment analysis.',
    packs: ['finance'],
    featured: true,
  },
  {
    id: 'recruitment',
    name: 'Recruitment',
    description: 'Pipeline review, candidate follow-up, and CRM cadences.',
    packs: ['sales-crm', 'productivity'],
  },
  {
    id: 'healthcare',
    name: 'Healthcare',
    description: 'Clinical notes, scheduling, medications, and compliance.',
    packs: ['healthcare'],
    featured: true,
  },
  {
    id: 'support',
    name: 'Support',
    description: 'Operator triage, inbox workflows, and daily utilities.',
    packs: ['operator-daily', 'capabilities-ops', 'email-extended'],
  },
];

export function parseActiveSkillPacks(raw: string | null | undefined): string[] {
  return String(raw ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

export function serializeActiveSkillPacks(packs: string[]): string {
  return [...new Set(packs.map((value) => value.trim()).filter(Boolean))].sort().join(',');
}

function normalizeCatalogRecord(raw: unknown): PackCatalogRecord | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const slug = String(row.slug ?? '').trim();
  if (!slug) return null;
  const ownership = String(row.ownership ?? 'platform') as PackOwnership;
  if (!['platform', 'reseller', 'customer'].includes(ownership)) return null;
  return {
    slug,
    ownership,
    ownerId: row.ownerId ? String(row.ownerId) : undefined,
    visible: row.visible !== false,
    label: row.label ? String(row.label) : undefined,
  };
}

export function parsePackCatalog(raw: unknown): PackCatalogRecord[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry) => normalizeCatalogRecord(entry))
    .filter((entry): entry is PackCatalogRecord => entry !== null);
}

function isVisible(entry: PackCatalogRecord, workspaceId: string): boolean {
  if (!entry.visible) return false;
  if (entry.ownership === 'platform') return true;
  if (entry.ownership === 'customer') {
    return !entry.ownerId || entry.ownerId === workspaceId;
  }
  return entry.ownership === 'reseller';
}

export function buildWorkspacePackStorefront(input: {
  workspaceId: string;
  activeSkillPacks: string;
  productName?: string;
  packCatalog?: unknown;
  marketplaceEnabled?: boolean;
}): PackStorefront {
  const activePacks = parseActiveSkillPacks(input.activeSkillPacks);
  const marketplaceEnabled = input.marketplaceEnabled !== false;
  const overrides = parsePackCatalog(input.packCatalog);
  const catalog = new Map<string, PackCatalogRecord>();

  for (const slug of Object.keys(PLATFORM_PACKS)) {
    catalog.set(slug, { slug, ownership: 'platform', visible: true });
  }
  for (const entry of overrides) {
    catalog.set(entry.slug, { ...catalog.get(entry.slug), ...entry });
  }

  const packs = [...catalog.values()]
    .filter((entry) => isVisible(entry, input.workspaceId))
    .map((entry) => {
      const manifest = PLATFORM_PACKS[entry.slug];
      if (!manifest) return null;
      return {
        slug: entry.slug,
        name: entry.label ?? manifest.name,
        description: manifest.description,
        version: manifest.version,
        category: manifest.category,
        ownership: entry.ownership,
        visible: entry.visible,
        installed: activePacks.includes(entry.slug),
        label: entry.label,
      } satisfies StorefrontPack;
    })
    .filter((entry) => entry !== null) as StorefrontPack[];
  packs.sort((a, b) => a.name.localeCompare(b.name));

  return {
    productName: input.productName?.trim() || 'Carina',
    marketplaceEnabled,
    templates: marketplaceEnabled ? VERTICAL_TEMPLATES : [],
    packs,
    activePacks,
  };
}

export function mergeTemplatePacks(current: string[], templateId: string): string[] {
  const template = VERTICAL_TEMPLATES.find((item) => item.id === templateId);
  if (!template) return current;
  return [...new Set([...current, ...template.packs])].sort();
}

export function togglePack(activePacks: string[], slug: string, enabled: boolean): string[] {
  const next = new Set(activePacks);
  if (enabled) next.add(slug);
  else next.delete(slug);
  return [...next].sort();
}
