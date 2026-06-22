import fs from 'fs';
import path from 'path';
import { resolveCarinaHome } from '../config/paths.js';
import type { BrandConfig } from '../product/brand.js';
import { normalizeBrandConfig } from '../product/brand.js';
import { listAvailablePacks } from '../skills/index.js';

export type TenantChannelConfig = {
  telegram?: { enabled: boolean; botUsername?: string };
  whatsapp?: { enabled: boolean; phoneNumberId?: string };
  web?: { enabled: boolean };
  cli?: { enabled: boolean };
};

export type TenantWorkspaceConfig = {
  tenantId: string;
  activeSkillPacks: string[];
  channels: TenantChannelConfig;
  brand?: BrandConfig;
  updatedAt: string;
  updatedBy?: string;
};

function configDir(): string {
  return path.join(resolveCarinaHome(), 'tenant-config');
}

function configPath(tenantId: string): string {
  return path.join(configDir(), `${tenantId}.json`);
}

function defaultConfig(tenantId: string): TenantWorkspaceConfig {
  return {
    tenantId,
    activeSkillPacks: [],
    channels: {
      web: { enabled: true },
      cli: { enabled: true },
      telegram: { enabled: false },
      whatsapp: { enabled: false },
    },
    updatedAt: new Date().toISOString(),
  };
}

export function loadTenantWorkspaceConfig(tenantId: string): TenantWorkspaceConfig {
  const file = configPath(tenantId);
  if (!fs.existsSync(file)) return defaultConfig(tenantId);
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf-8')) as TenantWorkspaceConfig;
    return {
      ...defaultConfig(tenantId),
      ...raw,
      tenantId,
      channels: { ...defaultConfig(tenantId).channels, ...raw.channels },
      brand: raw.brand ? normalizeBrandConfig(raw.brand) : undefined,
    };
  } catch {
    return defaultConfig(tenantId);
  }
}

export function saveTenantWorkspaceConfig(
  tenantId: string,
  patch: Partial<Pick<TenantWorkspaceConfig, 'activeSkillPacks' | 'channels' | 'brand'>>,
  actor = 'system',
): TenantWorkspaceConfig {
  fs.mkdirSync(configDir(), { recursive: true, mode: 0o700 });
  const current = loadTenantWorkspaceConfig(tenantId);
  const known = new Set(listAvailablePacks().map((p) => p.name));
  const packs = patch.activeSkillPacks ?? current.activeSkillPacks;
  const invalid = packs.filter((p) => !known.has(p));
  if (invalid.length > 0) {
    throw new Error(`Unknown skill packs: ${invalid.join(', ')}`);
  }
  const next: TenantWorkspaceConfig = {
    ...current,
    activeSkillPacks: packs,
    channels: { ...current.channels, ...patch.channels },
    brand: patch.brand !== undefined
      ? normalizeBrandConfig({ ...current.brand, ...patch.brand })
      : current.brand,
    updatedAt: new Date().toISOString(),
    updatedBy: actor,
  };
  fs.writeFileSync(configPath(tenantId), JSON.stringify(next, null, 2), { mode: 0o600 });
  return next;
}

export function listTenantWorkspaceConfigs(): TenantWorkspaceConfig[] {
  const dir = configDir();
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => loadTenantWorkspaceConfig(f.replace(/\.json$/, '')));
}

export function applyTenantSkillPacksToEnv(tenantId: string): string[] {
  const config = loadTenantWorkspaceConfig(tenantId);
  if (config.activeSkillPacks.length > 0) {
    process.env.ACTIVE_SKILL_PACKS = config.activeSkillPacks.join(',');
  }
  return config.activeSkillPacks;
}
