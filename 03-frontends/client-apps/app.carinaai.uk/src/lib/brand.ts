/**
 * White-label brand helpers for the cloud app.
 * Keep in sync with core.carinaai.uk/src/product/brand.ts.
 */

export type BrandColorTokens = Record<string, string>;

export interface BrandConfig {
  productName?: string;
  shortName?: string;
  publicSiteTitle?: string;
  logoUrl?: string;
  faviconUrl?: string;
  colorTokens?: BrandColorTokens;
  supportEmail?: string;
  supportName?: string;
  senderName?: string;
  senderEmail?: string;
  emailFooter?: string;
}

export type BrandFieldSource = 'platform' | 'reseller' | 'workspace' | 'user' | 'default';

export interface BrandSourceMap {
  productName: BrandFieldSource;
  shortName: BrandFieldSource;
  publicSiteTitle: BrandFieldSource;
  logoUrl: BrandFieldSource;
  faviconUrl: BrandFieldSource;
  colorTokens: BrandFieldSource;
  supportEmail: BrandFieldSource;
  supportName: BrandFieldSource;
  senderName: BrandFieldSource;
  senderEmail: BrandFieldSource;
  emailFooter: BrandFieldSource;
}

export interface ResolvedBrand {
  productName: string;
  shortName: string;
  publicSiteTitle: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  colorTokens: BrandColorTokens;
  supportEmail: string | null;
  supportName: string | null;
  senderName: string | null;
  senderEmail: string | null;
  emailFooter: string | null;
  sources: BrandSourceMap;
}

export type AppBrandMode = 'hosted' | 'private' | 'ops';

export interface BrandResolutionInput {
  mode?: AppBrandMode;
  platform?: Partial<BrandConfig> | null;
  reseller?: Partial<BrandConfig> | null;
  workspace?: Partial<BrandConfig> | null;
  user?: Partial<BrandConfig> | null;
}

const FALLBACK_PRODUCT_NAME = 'Carina';
const FALLBACK_SHORT_NAME = 'Carina';

export const PLATFORM_BRAND_DEFAULTS: Record<AppBrandMode, BrandConfig> = {
  hosted: {
    productName: 'Carina Cloud',
    shortName: 'Carina',
    supportEmail: process.env.CARINA_SUPPORT_EMAIL?.trim() || 'hello@carinaai.uk',
    supportName: 'Carina Support',
    senderName: 'Carina Cloud',
    senderEmail: process.env.CARINA_SENDER_EMAIL?.trim() || undefined,
  },
  private: {
    productName: 'Carina',
    shortName: 'Carina',
    supportEmail: process.env.CARINA_SUPPORT_EMAIL?.trim() || 'hello@carinaai.uk',
    supportName: 'Carina Support',
    senderName: 'Carina',
  },
  ops: {
    productName: 'Carina Ops',
    shortName: 'Ops',
    supportEmail: process.env.CARINA_SUPPORT_EMAIL?.trim() || 'hello@carinaai.uk',
    supportName: 'Carina Ops',
    senderName: 'Carina Ops',
  },
};

function trimString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeColorTokens(value: unknown): BrandColorTokens | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;
  const tokens: BrandColorTokens = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    const token = trimString(raw);
    if (token) tokens[key] = token;
  }
  return Object.keys(tokens).length > 0 ? tokens : undefined;
}

export function normalizeBrandConfig(value: unknown): BrandConfig {
  const source = typeof value === 'object' && value !== null ? (value as Partial<BrandConfig>) : {};
  const colorTokens = normalizeColorTokens(source.colorTokens);
  const next: BrandConfig = {};
  const productName = trimString(source.productName);
  const shortName = trimString(source.shortName);
  const publicSiteTitle = trimString(source.publicSiteTitle);
  const logoUrl = trimString(source.logoUrl);
  const faviconUrl = trimString(source.faviconUrl);
  const supportEmail = trimString(source.supportEmail);
  const supportName = trimString(source.supportName);
  const senderName = trimString(source.senderName);
  const senderEmail = trimString(source.senderEmail);
  const emailFooter = trimString(source.emailFooter);
  if (productName) next.productName = productName;
  if (shortName) next.shortName = shortName;
  if (publicSiteTitle) next.publicSiteTitle = publicSiteTitle;
  if (logoUrl) next.logoUrl = logoUrl;
  if (faviconUrl) next.faviconUrl = faviconUrl;
  if (colorTokens) next.colorTokens = colorTokens;
  if (supportEmail) next.supportEmail = supportEmail;
  if (supportName) next.supportName = supportName;
  if (senderName) next.senderName = senderName;
  if (senderEmail) next.senderEmail = senderEmail;
  if (emailFooter) next.emailFooter = emailFooter;
  return next;
}

function mergeBrandPatch(current: unknown, patch: unknown): BrandConfig {
  const base = normalizeBrandConfig(current);
  const incoming = normalizeBrandConfig(patch);
  return normalizeBrandConfig({
    ...base,
    ...incoming,
    colorTokens: {
      ...(base.colorTokens ?? {}),
      ...(incoming.colorTokens ?? {}),
    },
  });
}

export function mergeBrandSettings(current: unknown, patch: unknown): BrandConfig {
  return mergeBrandPatch(current, patch);
}

type StringField = keyof Pick<
  BrandConfig,
  | 'productName'
  | 'shortName'
  | 'publicSiteTitle'
  | 'logoUrl'
  | 'faviconUrl'
  | 'supportEmail'
  | 'supportName'
  | 'senderName'
  | 'senderEmail'
  | 'emailFooter'
>;

const STRING_FIELDS: StringField[] = [
  'productName',
  'shortName',
  'publicSiteTitle',
  'logoUrl',
  'faviconUrl',
  'supportEmail',
  'supportName',
  'senderName',
  'senderEmail',
  'emailFooter',
];

function mergeColorTokens(...layers: Array<BrandColorTokens | undefined>): BrandColorTokens {
  return layers.reduce<BrandColorTokens>((acc, layer) => ({ ...acc, ...layer }), {});
}

function resolveStringField(
  field: StringField,
  layers: Array<{ source: BrandFieldSource; config: BrandConfig }>,
  fallback: string | null,
): { value: string | null; source: BrandFieldSource } {
  for (let i = layers.length - 1; i >= 0; i -= 1) {
    const candidate = layers[i].config[field];
    if (typeof candidate === 'string' && candidate.trim()) {
      return { value: candidate.trim(), source: layers[i].source };
    }
  }
  if (fallback) return { value: fallback, source: 'default' };
  return { value: null, source: 'default' };
}

export function resolveBrand(input: BrandResolutionInput = {}): ResolvedBrand {
  const mode = input.mode ?? 'hosted';
  const platform = normalizeBrandConfig({
    ...PLATFORM_BRAND_DEFAULTS[mode],
    ...(input.platform ?? {}),
  });
  const reseller = normalizeBrandConfig(input.reseller);
  const workspace = normalizeBrandConfig(input.workspace);
  const user = normalizeBrandConfig(input.user);

  const layers: Array<{ source: BrandFieldSource; config: BrandConfig }> = [
    { source: 'platform', config: platform },
    { source: 'reseller', config: reseller },
    { source: 'workspace', config: workspace },
    { source: 'user', config: user },
  ];

  const sources = {} as BrandSourceMap;
  const resolved: Record<StringField, string | null> = {
    productName: null,
    shortName: null,
    publicSiteTitle: null,
    logoUrl: null,
    faviconUrl: null,
    supportEmail: null,
    supportName: null,
    senderName: null,
    senderEmail: null,
    emailFooter: null,
  };

  for (const field of STRING_FIELDS) {
    const fallback = field === 'productName'
      ? FALLBACK_PRODUCT_NAME
      : field === 'shortName'
        ? FALLBACK_SHORT_NAME
        : null;
    const { value, source } = resolveStringField(field, layers, fallback);
    resolved[field] = value;
    sources[field] = source;
  }

  const colorLayers = layers.map((layer) => layer.config.colorTokens);
  const colorTokens = mergeColorTokens(...colorLayers);
  const colorSource: BrandFieldSource = user.colorTokens
    ? 'user'
    : workspace.colorTokens
      ? 'workspace'
      : reseller.colorTokens
        ? 'reseller'
        : platform.colorTokens
          ? 'platform'
          : 'default';
  sources.colorTokens = colorSource;

  return {
    productName: resolved.productName ?? FALLBACK_PRODUCT_NAME,
    shortName: resolved.shortName ?? FALLBACK_SHORT_NAME,
    publicSiteTitle: resolved.publicSiteTitle ?? resolved.productName ?? FALLBACK_PRODUCT_NAME,
    logoUrl: resolved.logoUrl,
    faviconUrl: resolved.faviconUrl,
    colorTokens,
    supportEmail: resolved.supportEmail,
    supportName: resolved.supportName,
    senderName: resolved.senderName,
    senderEmail: resolved.senderEmail,
    emailFooter: resolved.emailFooter,
    sources,
  };
}

export function resolveWorkspaceBrand(input: {
  mode?: AppBrandMode;
  workspaceBrand?: unknown;
  resellerBrand?: unknown;
  userColorTokens?: unknown;
}): ResolvedBrand {
  return resolveBrand({
    mode: input.mode ?? 'hosted',
    reseller: normalizeBrandConfig(input.resellerBrand),
    workspace: normalizeBrandConfig(input.workspaceBrand),
    user: input.userColorTokens
      ? { colorTokens: normalizeBrandConfig({ colorTokens: input.userColorTokens }).colorTokens }
      : undefined,
  });
}
