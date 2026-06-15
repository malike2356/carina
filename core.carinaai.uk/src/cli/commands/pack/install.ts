import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { CARINA_PACKS_DIR, packDir } from '../../../config/paths.js';
import { BUILTIN_PACKS_DIR } from '../../../skills/pack-loader.js';
import { downloadHubPackArchive, fetchHubPack, hubUnreachableHint, isPremiumPaidPack, resolvePremiumPackLicense } from '../../../skills/hub/hub-client.js';
import { validatePackDir } from '../../../skills/hub/validate.js';
import { ingestPackDirectory } from '../../../skills/ingestion.js';
import { loadPackSkills } from '../../../skills/index.js';
import { setEnvVarInFile } from '../../../ops/env-file.js';
import { CARINA_ENV_PATH } from '../../../config/paths.js';
import { isSemverNewer, readFlag } from './shared.js';

const execAsync = promisify(exec);

export async function installPackSlug(
  slug: string,
  options: { baseUrl?: string; bypassEval?: boolean; npm?: boolean } = {},
): Promise<{ name: string; version: string; dest: string; upgraded: boolean }> {
  const name = slug.trim();
  if (!name) throw new Error('Pack slug is required');

  if (options.npm) {
    const { installPackFromNpm, npmPackageForSlug } = await import('../../../skills/pack-discovery.js');
    const npmPackage = npmPackageForSlug(name);
    if (!npmPackage) {
      throw new Error(`No npm package mapped for ${name}. Use hub install or pick a published pack slug.`);
    }
    const result = await installPackFromNpm(name);
    await ensurePackActive(name, result.version);
    console.log(`Installed ${name} via npm (${result.npmPackage}@${result.version})`);
    return { name, version: result.version, dest: npmPackage, upgraded: true };
  }

  if (!options.bypassEval) {
    const { runPackEvalGate, resolveGateMode } = await import('../../../skills/eval/gate.js');
    const gate = await runPackEvalGate(name, { mode: resolveGateMode() });
    if (gate.message) console.log(gate.message);
    if (gate.blocked) {
      throw new Error('Install blocked by eval gate. Use --bypass-eval for emergency installs.');
    }
  }

  const dest = packDir(name);
  const existingVersion = await readInstalledVersion(dest);
  let hubVersion = existingVersion;
  const baseUrl = options.baseUrl ?? process.env.HUB_URL ?? process.env.SKILLS_HUB_URL;

  try {
    const hubPack = await fetchHubPack(name, baseUrl);
    hubVersion = hubPack.version;
    if (existingVersion && !isSemverNewer(hubVersion, existingVersion)) {
      console.log(`${name}@${existingVersion} already installed (hub: ${hubVersion}).`);
      await ensurePackActive(name, hubVersion);
      return { name, version: existingVersion, dest, upgraded: false };
    }
    if (isPremiumPaidPack(hubPack)) {
      const license = await resolvePremiumPackLicense(name);
      if (!license) {
        const hub = baseUrl ?? process.env.HUB_URL ?? process.env.SKILLS_HUB_URL ?? 'https://hub.carinaai.uk';
        const price = hubPack.price_gbp_cents != null
          ? ` (£${(hubPack.price_gbp_cents / 100).toFixed(2)} ex VAT)`
          : '';
        throw new Error(
          `Premium pack "${name}" requires a Hub license${price}. Purchase at ${hub}/?pack=${encodeURIComponent(name)} then retry install.`,
        );
      }
    }
    await fs.rm(dest, { recursive: true, force: true });
    await fs.mkdir(dest, { recursive: true });
    const licenseToken = isPremiumPaidPack(hubPack)
      ? await resolvePremiumPackLicense(name)
      : undefined;
    await downloadHubPackArchive(name, dest, baseUrl, licenseToken ?? undefined);
  } catch (hubErr) {
    if (existingVersion) {
      console.log(`${name}@${existingVersion} already installed. Hub unavailable for upgrade check.`);
      await ensurePackActive(name, existingVersion);
      return { name, version: existingVersion, dest, upgraded: false };
    }
    console.log('Skills Hub unavailable; trying built-in pack source...');
    await fs.rm(dest, { recursive: true, force: true });
    await fs.mkdir(dest, { recursive: true });
    try {
      hubVersion = await copyBuiltinPack(name, dest);
    } catch {
      const message = hubErr instanceof Error ? hubErr.message : String(hubErr);
      throw new Error(`${message}\n${hubUnreachableHint(baseUrl)}`);
    }
  }

  const manifest = await validatePackDir(dest);
  const skillsLoaded = await loadPackSkills(name);
  const knowledgeDir = path.join(dest, 'knowledge');
  let chunks = 0;
  try {
    await fs.access(knowledgeDir);
    chunks = await ingestPackDirectory(name, knowledgeDir);
  } catch {
    // knowledge optional for code-only packs
  }

  await ensurePackActive(manifest.name, manifest.version);

  console.log(
    `Installed ${manifest.name}@${manifest.version} to ${dest}` +
    ` (${skillsLoaded} skills${chunks ? `, ${chunks} knowledge chunks` : ''}).`,
  );

  return {
    name: manifest.name,
    version: manifest.version,
    dest,
    upgraded: Boolean(existingVersion && isSemverNewer(manifest.version, existingVersion)),
  };
}

async function ensurePackActive(name: string, version: string): Promise<void> {
  const { initOperatorPackStore, installOperatorPack, getOperatorActivePacks } =
    await import('../../../skills/operator-pack-store.js');
  await initOperatorPackStore({ fileOnly: true });
  await installOperatorPack(name, version, { source: 'pack-cli', actor: 'operator' });

  const active = getOperatorActivePacks();
  const merged = active.includes(name) ? active : [...active, name];
  setEnvVarInFile('ACTIVE_SKILL_PACKS', merged.join(','), CARINA_ENV_PATH);
}

async function readInstalledVersion(dest: string): Promise<string | null> {
  try {
    const raw = await fs.readFile(path.join(dest, 'pack.json'), 'utf8');
    const parsed = JSON.parse(raw) as { version?: string };
    return parsed.version ?? null;
  } catch {
    return null;
  }
}

async function copyBuiltinPack(name: string, dest: string): Promise<string> {
  const src = path.join(BUILTIN_PACKS_DIR, name);
  await fs.access(src);
  await execAsync(`cp -r "${src}/." "${dest}/"`);
  const manifest = await validatePackDir(dest);
  return manifest.version;
}

export async function runPackInstall(args: string[]): Promise<void> {
  const slug = args.find((a) => !a.startsWith('--'));
  if (!slug) {
    console.error('Usage: carina pack install <slug> [--bypass-eval] [--npm]');
    process.exit(1);
  }
  const bypassEval = readFlag(args, '--bypass-eval') || process.env.CARINA_EVAL_GATE === 'bypass';
  const useNpm = readFlag(args, '--npm');

  try {
    await installPackSlug(slug, { bypassEval, npm: useNpm });
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

// re-export for tests
export { CARINA_PACKS_DIR };
