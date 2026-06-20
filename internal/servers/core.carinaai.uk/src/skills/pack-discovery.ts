import fsSync from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { CARINA_PACKS_DIR } from '../config/paths.js';
import { BUILTIN_PACKS_DIR, readPackManifest } from './pack-loader.js';
import type { LoadedPackModule } from './pack-types.js';
import { PackNotInstalledError } from './pack-types.js';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_PACKS_DIR = path.resolve(__dirname, '../../packages/packs');

/** Slug to published npm package name. */
export const PACK_NPM_PACKAGES: Record<string, string> = {
  'property-uk': '@verlox/pack-property',
  healthcare: '@verlox/pack-health',
  'borehole-africa': '@verlox/pack-borehole-africa',
};

export const NPM_PACKAGE_TO_SLUG: Record<string, string> = Object.fromEntries(
  Object.entries(PACK_NPM_PACKAGES).map(([slug, pkg]) => [pkg, slug]),
);

export function npmPackageForSlug(slug: string): string | undefined {
  return PACK_NPM_PACKAGES[slug];
}

function monorepoDevEnabled(): boolean {
  return process.env.CARINA_DEV === '1'
    || process.env.NODE_ENV === 'test'
    || fsSync.existsSync(REPO_PACKS_DIR);
}

export function resolvePackDirectory(packName: string): string | null {
  const installed = path.join(CARINA_PACKS_DIR, packName);
  if (fsSync.existsSync(path.join(installed, 'pack.json'))) return installed;

  const repoPack = path.join(REPO_PACKS_DIR, packName);
  if (fsSync.existsSync(path.join(repoPack, 'pack.json'))) return repoPack;

  if (monorepoDevEnabled()) {
    const legacy = path.join(BUILTIN_PACKS_DIR, packName);
    if (fsSync.existsSync(path.join(legacy, 'pack.json'))) return legacy;
  }

  const npmPkg = PACK_NPM_PACKAGES[packName];
  if (npmPkg) {
    try {
      const pkgRoot = path.dirname(require.resolve(`${npmPkg}/package.json`));
      const carinaMeta = JSON.parse(
        fsSync.readFileSync(path.join(pkgRoot, 'package.json'), 'utf8'),
      ) as { carina?: { pack?: string } };
      const manifestRel = carinaMeta.carina?.pack ?? 'pack.json';
      if (fsSync.existsSync(path.join(pkgRoot, manifestRel))) return pkgRoot;
    } catch {
      // npm package not installed
    }
  }

  return null;
}

function normalizeLoadedModule(mod: Record<string, unknown>): LoadedPackModule {
  const skills = (mod.skills
    ?? (mod.default && typeof mod.default === 'object'
      ? (mod.default as Record<string, unknown>).skills
      : undefined)
    ?? mod.propertyUkSkills
    ?? mod.healthcareSkills
    ?? mod.boreholeAfricaSkills) as LoadedPackModule['skills'] | undefined;

  const systemSuffix = String(
    mod.systemSuffix
    ?? mod.propertyUkSystemSuffix
    ?? (mod.default && typeof mod.default === 'object'
      ? (mod.default as Record<string, unknown>).systemSuffix
      : '')
    ?? '',
  );

  if (!Array.isArray(skills) || skills.length === 0) {
    throw new Error('Pack module did not export skills');
  }

  return { skills, systemSuffix };
}

async function loadFromDirectory(packDir: string): Promise<LoadedPackModule> {
  const entryCandidates = [
    path.join(packDir, 'dist/src/index.js'),
    path.join(packDir, 'dist/index.js'),
    path.join(packDir, 'src/index.ts'),
  ];

  for (const entry of entryCandidates) {
    if (!fsSync.existsSync(entry)) continue;
    try {
      const mod = await import(pathToFileURL(entry).href) as Record<string, unknown>;
      return normalizeLoadedModule(mod);
    } catch {
      // try next entry
    }
  }

  const skillsJs = path.join(packDir, 'skills.js');
  const skillsTs = fsSync.existsSync(skillsJs) ? skillsJs : path.join(packDir, 'skills.ts');
  if (fsSync.existsSync(skillsTs)) {
    const mod = await import(pathToFileURL(skillsTs).href) as Record<string, unknown>;
    const skillsKey = Object.keys(mod).find((k) => k.endsWith('Skills'));
    if (skillsKey && Array.isArray(mod[skillsKey])) {
      let systemSuffix = '';
      const promptsJs = path.join(packDir, 'prompts/system.js');
      const promptsPath = fsSync.existsSync(promptsJs) ? promptsJs : path.join(packDir, 'prompts/system.ts');
      if (fsSync.existsSync(promptsPath)) {
        const promptMod = await import(pathToFileURL(promptsPath).href) as Record<string, string>;
        systemSuffix = promptMod.propertyUkSystemSuffix
          ?? promptMod.systemSuffix
          ?? promptMod.helloPackSystemSuffix
          ?? '';
      }
      return { skills: mod[skillsKey] as LoadedPackModule['skills'], systemSuffix };
    }
  }

  const skillsJson = path.join(packDir, 'skills.json');
  if (fsSync.existsSync(skillsJson)) {
    const raw = JSON.parse(fsSync.readFileSync(skillsJson, 'utf8')) as unknown;
    const skills = Array.isArray(raw) ? raw : [];
    if (skills.length > 0) {
      let systemSuffix = '';
      const promptsPath = path.join(packDir, 'prompts', 'system.txt');
      if (fsSync.existsSync(promptsPath)) {
        systemSuffix = fsSync.readFileSync(promptsPath, 'utf8').trim();
      }
      return { skills: skills as LoadedPackModule['skills'], systemSuffix };
    }
  }

  throw new Error(`No loadable entry in ${packDir}`);
}

export async function loadPackModule(packName: string): Promise<LoadedPackModule> {
  const npmPkg = PACK_NPM_PACKAGES[packName];
  if (npmPkg) {
    try {
      const mod = await import(npmPkg) as Record<string, unknown>;
      return normalizeLoadedModule(mod);
    } catch (err) {
      if (!resolvePackDirectory(packName)) {
        throw new PackNotInstalledError(packName, err);
      }
    }
  }

  const dir = resolvePackDirectory(packName);
  if (dir) {
    try {
      return await loadFromDirectory(dir);
    } catch (err) {
      throw new PackNotInstalledError(packName, err);
    }
  }

  throw new PackNotInstalledError(packName);
}

export async function installPackFromNpm(
  slug: string,
  options: { cwd?: string } = {},
): Promise<{ npmPackage: string; version: string }> {
  const npmPackage = PACK_NPM_PACKAGES[slug];
  if (!npmPackage) {
    throw new Error(`No npm package mapped for pack slug: ${slug}`);
  }

  const cwd = options.cwd ?? process.cwd();
  const { exec } = await import('node:child_process');
  const { promisify } = await import('node:util');
  const execAsync = promisify(exec);
  await execAsync(`npm install ${npmPackage}@latest`, { cwd });

  const pkgRoot = path.dirname(require.resolve(`${npmPackage}/package.json`, { paths: [cwd] }));
  const manifest = await readPackManifest(pkgRoot);
  return { npmPackage, version: manifest.version };
}
