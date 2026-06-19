import fs from 'fs';
import path from 'path';
import { parse as parseYaml } from 'yaml';
import { loadFromYamlSync } from '../../cli/config/loader.js';
import { resolveCarinaHome } from '../../config/paths.js';
import { BUILT_IN_SKINS, DEFAULT_SKIN, SKIN_ALIASES } from './built-in.js';
import type { CarinaThemeSkin } from './skin-schema.js';

let activeSkin: CarinaThemeSkin = DEFAULT_SKIN;

export function getActiveSkin(): CarinaThemeSkin {
  return activeSkin;
}

export function resolveSkin(name: string): CarinaThemeSkin | null {
  const normalized = name.trim().toLowerCase();
  const canonical = SKIN_ALIASES[normalized] ?? normalized;
  if (BUILT_IN_SKINS[canonical]) return BUILT_IN_SKINS[canonical]!;
  return loadCustomSkin(canonical);
}

export function setActiveSkin(nameOrSkin: string | CarinaThemeSkin): void {
  if (typeof nameOrSkin === 'string') {
    const resolved = resolveSkin(nameOrSkin);
    if (!resolved) {
      throw new Error(`Unknown skin: "${nameOrSkin}". Use: ${listSkinNames().join(', ')}`);
    }
    activeSkin = resolved;
    void saveSkinPreference(resolved.name);
    return;
  }
  activeSkin = nameOrSkin;
}

export function listSkinNames(): string[] {
  return [
    ...Object.keys(BUILT_IN_SKINS),
    ...loadCustomSkinNames(),
  ];
}

function skinsDir(): string {
  return path.join(resolveCarinaHome(), 'skins');
}

function loadCustomSkin(name: string): CarinaThemeSkin | null {
  const skinPath = path.join(skinsDir(), `${name}.yaml`);
  if (!fs.existsSync(skinPath)) return null;
  try {
    const raw = parseYaml(fs.readFileSync(skinPath, 'utf-8')) as Partial<CarinaThemeSkin>;
    return mergeSkin(DEFAULT_SKIN, { ...raw, name });
  } catch {
    return null;
  }
}

function loadCustomSkinNames(): string[] {
  const dir = skinsDir();
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((f) => f.endsWith('.yaml'))
    .map((f) => f.replace(/\.yaml$/, ''))
    .filter((name) => !BUILT_IN_SKINS[name]);
}

function mergeSkin(base: CarinaThemeSkin, patch: Partial<CarinaThemeSkin>): CarinaThemeSkin {
  return {
    ...base,
    ...patch,
    spinner: {
      ...base.spinner,
      ...(patch.spinner ?? {}),
    },
  };
}

async function saveSkinPreference(name: string): Promise<void> {
  try {
    const { loadFromYaml, writeConfig } = await import('../../cli/config/loader.js');
    const config = await loadFromYaml();
    config.skin = name;
    await writeConfig(config);
  } catch {
    // non-fatal
  }
}

export function initSkin(): void {
  try {
    const config = loadFromYamlSync();
    if (config.skin) {
      const resolved = resolveSkin(config.skin);
      if (resolved) activeSkin = resolved;
    }
  } catch {
    // use default
  }
}

export function formatSkinList(): string {
  const active = activeSkin.name;
  return listSkinNames()
    .map((name) => `${name === active ? '* ' : '  '}${name}`)
    .join('\n');
}
