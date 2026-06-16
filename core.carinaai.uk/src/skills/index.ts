import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { getOperatorActivePacks } from './operator-pack-store.js';
import { findRelevantSkills, listSkills, saveSkill, skillExistsByName } from './store.js';
import { loadSkillMdDocuments, findSkillMdByKeywords, skillMdToSkill } from './skill-md-loader.js';
import { loadPluginsFromDisk } from '../plugins/registry.js';
import { BUILTIN_PACKS_DIR, readPackManifest, type PackManifest } from './pack-loader.js';
import { loadAllUserResources } from './user-resources.js';
import { PACK_MANIFESTS, listKnownPackNames } from './pack-manifests.js';
import type { Tool } from '../types/index.js';
import {
  type PackDefinition,
  resolvePack,
  warmPackSkillIndex,
  getBuiltinSkillNames,
} from './pack-resolver.js';

const execAsync = promisify(exec);

export {
  type PackDefinition,
  resolvePack,
  warmPackSkillIndex,
  getBuiltinSkillNames,
  PackNotInstalledError,
} from './pack-resolver.js';
export type { PackSkillInput } from './pack-types.js';
export { PACK_NPM_PACKAGES, npmPackageForSlug, resolvePackDirectory } from './pack-discovery.js';
export { PACK_MANIFESTS, listKnownPackNames } from './pack-manifests.js';

const suffixCache = new Map<string, string>();
const activeSkillNamesCache = new Map<string, Set<string>>();

export function clearActivePackCaches(): void {
  suffixCache.clear();
  activeSkillNamesCache.clear();
}

import { clearPackResolverCache } from './pack-resolver.js';
import { clearSkillIndexCache } from './skill-index.js';
export { buildSkillIndex, discoverSkills, clearSkillIndexCache } from './skill-index.js';
export { validateSkillDocument, formatSkillValidation } from './skill-validate.js';
export { scanSkillSecurity, formatSkillSecurityScan } from './skill-security.js';
export type { SkillAuthoringInput, SkillGating, SkillRuntimeContext } from './skill-format.js';

export async function refreshSkillRuntime(opts?: { platform?: string }) {
  const mod = await import('./skill-refresh.js');
  return mod.refreshSkillRuntime(opts);
}

export function clearSkillRuntimeCaches(): void {
  clearPackResolverCache();
  clearSkillIndexCache();
  clearActivePackCaches();
}

export function listAvailablePacks(): PackManifest[] {
  return Object.values(PACK_MANIFESTS);
}

export function getActivePackNames(): string[] {
  return getOperatorActivePacks();
}

export async function enablePackRuntime(packName: string): Promise<number> {
  const loaded = await loadPackSkills(packName);
  await loadPackExtensions(packName);
  await registerActivePackTools();
  return loaded;
}

export async function loadSkillsForTask(task: string): Promise<string> {
  const keywords = task
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3);

  const skills = await findRelevantSkills(keywords);
  if (skills.length === 0) return '';

  return skills
    .map((s) => `Skill: ${s.name}\n${s.description}\nSteps:\n${s.steps}`)
    .join('\n\n---\n\n');
}

export async function primeActivePackSkillCache(): Promise<void> {
  for (const packName of getActivePackNames()) {
    if (activeSkillNamesCache.has(packName)) continue;
    const pack = await resolvePack(packName);
    activeSkillNamesCache.set(packName, new Set(pack.skills.map((s) => s.name)));
    suffixCache.set(packName, pack.systemSuffix);
  }
}

export async function loadPackSkills(packName: string): Promise<number> {
  const pack = await resolvePack(packName);
  suffixCache.set(packName, pack.systemSuffix);
  activeSkillNamesCache.set(packName, new Set(pack.skills.map((s) => s.name)));

  let loaded = 0;
  for (const skill of pack.skills) {
    if (await skillExistsByName(skill.name)) continue;
    await saveSkill(skill);
    loaded++;
  }
  return loaded;
}

export async function loadActivePacks(): Promise<number> {
  const active = getActivePackNames();
  if (active.length === 0) return 0;

  let total = 0;
  for (const name of active) {
    total += await loadPackSkills(name);
  }
  return total;
}

export function getPackSystemSuffix(packName: string): string {
  return suffixCache.get(packName) ?? '';
}

export function getActivePackSuffixes(): string {
  const active = getActivePackNames();
  const parts = active
    .map((name) => getPackSystemSuffix(name))
    .filter(Boolean);
  return parts.join('\n\n');
}

const USER_RAG_PACK = 'user-resources';

export function getActivePackSkillNames(): Set<string> {
  const names = new Set<string>();
  for (const packName of getActivePackNames()) {
    const cached = activeSkillNamesCache.get(packName);
    if (!cached) continue;
    for (const skillName of cached) names.add(skillName);
  }
  return names;
}

export function isSkillAllowedForActivePacks(skillName: string): boolean {
  if (!getBuiltinSkillNames().has(skillName)) return true;
  if (getActivePackNames().length === 0) return false;
  return getActivePackSkillNames().has(skillName);
}

export function isRagPackAllowed(pack: string): boolean {
  if (getActivePackNames().length === 0) {
    return pack === USER_RAG_PACK;
  }
  return getActivePackNames().includes(pack) || pack === USER_RAG_PACK;
}

async function loadPackExtensions(_packName: string): Promise<void> {
  // Domain-specific side effects (e.g. property-uk domain-data) load with npm pack entry modules.
}

export async function registerActivePackTools(): Promise<void> {
  if (!getActivePackNames().includes('property-uk')) return;

  await loadPackExtensions('property-uk');
  const { registry } = await import('../tools/registry.js');
  const { config } = await import('../config/index.js');
  const { domainLookupTool } = await import('../tools/domain-lookup.js');
  if (!registry.get('domain_lookup')) {
    registry.register(domainLookupTool);
  }

  if (config.propertyData.apiKey && !registry.get('property-data-lookup')) {
    const propDataMod = '../../packages/packs/property-uk/tools/property-data.js';
    const { propertyDataTool } = await import(/* @ts-ignore */ propDataMod) as unknown as { propertyDataTool: Tool };
    registry.register(propertyDataTool);
  }

  const landRegistryKey = config.landRegistry.apiKey.trim() || config.propertyData.apiKey.trim();
  if (landRegistryKey && !registry.get('land-registry-search')) {
    const landRegMod = '../../packages/packs/property-uk/tools/land-registry.js';
    const { landRegistryTool } = await import(/* @ts-ignore */ landRegMod) as unknown as { landRegistryTool: Tool };
    registry.register(landRegistryTool);
  }
}

export async function loadSkillMdRuntime(): Promise<number> {
  const docs = await loadSkillMdDocuments();
  let loaded = 0;
  for (const doc of docs) {
    if (await skillExistsByName(doc.name)) continue;
    await saveSkill({
      name: doc.name,
      description: doc.description,
      trigger: doc.trigger,
      steps: doc.steps,
      toolsUsed: doc.toolsUsed,
    });
    loaded++;
  }
  return loaded;
}

export async function findSkillsIncludingSkillMd(keywords: string[]) {
  const dbSkills = await findRelevantSkills(keywords);
  const mdMatches = findSkillMdByKeywords(keywords).map(skillMdToSkill);
  const seen = new Set(dbSkills.map((s) => s.name));
  const merged = [...dbSkills];
  for (const skill of mdMatches) {
    if (!seen.has(skill.name)) merged.push(skill);
  }
  return merged.slice(0, 5);
}

export async function initSkills(): Promise<void> {
  await warmPackSkillIndex();
  const packsLoaded = await loadActivePacks();
  const skillMdLoaded = await loadSkillMdRuntime();
  const pluginsLoaded = await loadPluginsFromDisk();
  for (const packName of getActivePackNames()) {
    await loadPackExtensions(packName);
  }
  await registerActivePackTools();
  const user = await loadAllUserResources();

  let extensionSkills = 0;
  let extensionChunks = 0;
  let extensionTools = 0;
  let extensionPrompts = 0;
  let extensionsActive = 0;
  let extensionMcp = 0;
  let extensionHooks = 0;
  if (process.env.CARINA_EXTENSIONS_ENABLED === 'true') {
    const { loadEnabledExtensionContributions, ingestStagedExtensionResources } = await import('../extensions/contributions.js');
    const { registerEnabledExtensionTools } = await import('../extensions/tools.js');
    const { loadExtensionPromptSuffixes } = await import('../extensions/prompts.js');
    const staged = await loadEnabledExtensionContributions();
    extensionsActive = staged.extensions;
    extensionPrompts = staged.promptsStaged;
    const ingested = await ingestStagedExtensionResources();
    extensionSkills = ingested.skillsLoaded;
    extensionChunks = ingested.chunksIngested;
    extensionTools = await registerEnabledExtensionTools();
    await loadExtensionPromptSuffixes();
    const { loadEnabledExtensionMcpServers } = await import('../extensions/mcp-loader.js');
    const { loadEnabledExtensionHooks } = await import('../extensions/hooks-loader.js');
    const { loadEnabledExtensionRulePacks } = await import('../extensions/rule-packs-loader.js');
    extensionMcp = await loadEnabledExtensionMcpServers();
    extensionHooks = await loadEnabledExtensionHooks();
    await loadEnabledExtensionRulePacks();
  }

  if (packsLoaded > 0 || skillMdLoaded > 0 || user.skillsLoaded > 0 || extensionSkills > 0) {
    const parts = [
      `${packsLoaded} from packs`,
      `${skillMdLoaded} SKILL.md`,
      `${user.skillsLoaded} user skills`,
      `${user.chunksIngested} knowledge chunks`,
    ];
    if (extensionsActive > 0) {
      parts.push(`${extensionSkills} extension skills (${extensionsActive} bundles)`);
      if (extensionTools > 0) parts.push(`${extensionTools} extension tools`);
      if (extensionPrompts > 0) parts.push(`${extensionPrompts} extension prompt files`);
      if (extensionChunks > 0) parts.push(`${extensionChunks} extension knowledge chunks`);
      if (extensionMcp > 0 || extensionHooks > 0) {
        parts.push(`${extensionMcp} MCP servers, ${extensionHooks} hooks`);
      }
    } else if (pluginsLoaded > 0) {
      parts.push(`${pluginsLoaded} legacy plugin dirs (migrate to carina extensions install)`);
    }
    console.log(`Skills ready: ${parts.join(', ')}`);
  } else if (getActivePackNames().length === 0) {
    console.log('General-purpose mode: no optional skill packs active');
  }

  const { initProviderPluginsIfEnabled, providerPluginsEnabled } = await import('../ops/provider-plugins-init.js');
  if (providerPluginsEnabled()) {
    const loaded = await initProviderPluginsIfEnabled();
    const { llm } = await import('../brain/llm.js');
    llm.refreshPlugins();
    if (loaded.length > 0) {
      console.log(`Provider plugins loaded: ${loaded.join(', ')}`);
    }
  }
}

export async function exportPack(packName: string, outputPath: string): Promise<void> {
  const pack = await resolvePack(packName);
  const packDir = path.join(BUILTIN_PACKS_DIR, packName);
  const tmpDir = path.join(path.dirname(outputPath), `.carina-export-${Date.now()}`);
  await fs.mkdir(tmpDir, { recursive: true });

  await fs.writeFile(
    path.join(tmpDir, 'manifest.json'),
    JSON.stringify(pack.manifest, null, 2),
  );
  await fs.writeFile(path.join(tmpDir, 'skills.json'), JSON.stringify(pack.skills, null, 2));

  const systemPath = path.join(packDir, 'prompts/system.ts');
  try {
    const systemContent = await fs.readFile(systemPath, 'utf8');
    await fs.writeFile(path.join(tmpDir, 'system-prompt.txt'), systemContent);
  } catch {
    await fs.writeFile(path.join(tmpDir, 'system-prompt.txt'), pack.systemSuffix);
  }

  const dbSkills = await listSkills();
  await fs.writeFile(path.join(tmpDir, 'saved-skills.json'), JSON.stringify(dbSkills, null, 2));

  const archive = path.resolve(outputPath);
  await fs.mkdir(path.dirname(archive), { recursive: true });
  await execAsync(`tar -czf "${archive}" -C "${tmpDir}" .`);
  await fs.rm(tmpDir, { recursive: true, force: true });
}

export async function importPack(packPath: string): Promise<void> {
  const resolved = path.resolve(packPath);
  const tmpDir = path.join(path.dirname(resolved), `.carina-import-${Date.now()}`);
  await fs.mkdir(tmpDir, { recursive: true });
  await execAsync(`tar -xzf "${resolved}" -C "${tmpDir}"`);

  const skillsFile = path.join(tmpDir, 'skills.json');
  const raw = await fs.readFile(skillsFile, 'utf8');
  const skills = JSON.parse(raw) as Array<{
    name: string;
    description: string;
    trigger: string[];
    steps: string;
    toolsUsed: string[];
  }>;

  for (const skill of skills) {
    if (await skillExistsByName(skill.name)) continue;
    await saveSkill(skill);
  }

  await fs.rm(tmpDir, { recursive: true, force: true });
}

export async function syncPackManifests(): Promise<void> {
  for (const name of listKnownPackNames()) {
    try {
      const manifest = await readPackManifest(path.join(BUILTIN_PACKS_DIR, name));
      PACK_MANIFESTS[name] = manifest;
    } catch {
      // use built-in manifest
    }
  }
}
