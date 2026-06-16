import fs from 'fs/promises';
import path from 'path';
import {
  CARINA_EXTENSION_RESOURCES_DIR,
  extensionDir,
} from '../config/paths.js';
import { listEnabledExtensionIds } from './store.js';
import { readExtensionManifest } from './validator.js';

export function extensionsRuntimeEnabled(): boolean {
  return process.env.CARINA_EXTENSIONS_ENABLED === 'true';
}

async function copyTree(src: string, dest: string): Promise<void> {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyTree(from, to);
    } else {
      await fs.copyFile(from, to);
    }
  }
}

export async function stageExtensionContributions(id: string): Promise<{
  skills: number;
  prompts: number;
  rag: number;
}> {
  const bundleDir = extensionDir(id);
  const manifest = await readExtensionManifest(bundleDir);
  const stagedRoot = path.join(CARINA_EXTENSION_RESOURCES_DIR, id);
  await fs.rm(stagedRoot, { recursive: true, force: true });
  await fs.mkdir(stagedRoot, { recursive: true });

  let skills = 0;
  let prompts = 0;
  let rag = 0;

  if (manifest.capabilities.includes('skills') && manifest.entryPoints.skills) {
    const src = path.join(bundleDir, manifest.entryPoints.skills);
    const dest = path.join(stagedRoot, 'skills');
    await copyTree(src, dest);
    const files = await fs.readdir(dest);
    skills = files.filter((f) => f.endsWith('.json')).length;
  }

  if (manifest.capabilities.includes('prompts') && manifest.entryPoints.prompts) {
    const src = path.join(bundleDir, manifest.entryPoints.prompts);
    const dest = path.join(stagedRoot, 'prompts');
    await copyTree(src, dest);
    const files = await collectFiles(dest);
    prompts = files.length;
  }

  if (manifest.capabilities.includes('rag') && manifest.entryPoints.rag) {
    const src = path.join(bundleDir, manifest.entryPoints.rag);
    const dest = path.join(stagedRoot, 'knowledge');
    await copyTree(src, dest);
    const files = await collectFiles(dest);
    rag = files.filter((f) => f.endsWith('.md')).length;
  }

  return { skills, prompts, rag };
}

async function collectFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await collectFiles(full)));
    } else {
      out.push(full);
    }
  }
  return out;
}

export async function loadEnabledExtensionContributions(): Promise<{
  extensions: number;
  skillsStaged: number;
  promptsStaged: number;
  ragStaged: number;
}> {
  if (!extensionsRuntimeEnabled()) {
    return { extensions: 0, skillsStaged: 0, promptsStaged: 0, ragStaged: 0 };
  }

  const ids = await listEnabledExtensionIds();
  let skillsStaged = 0;
  let promptsStaged = 0;
  let ragStaged = 0;

  for (const id of ids) {
    const staged = await stageExtensionContributions(id);
    skillsStaged += staged.skills;
    promptsStaged += staged.prompts;
    ragStaged += staged.rag;
  }

  return {
    extensions: ids.length,
    skillsStaged,
    promptsStaged,
    ragStaged,
  };
}

export async function clearStagedExtensionContributions(id: string): Promise<void> {
  const stagedRoot = path.join(CARINA_EXTENSION_RESOURCES_DIR, id);
  await fs.rm(stagedRoot, { recursive: true, force: true });
}

export async function ingestStagedExtensionResources(): Promise<{
  skillsLoaded: number;
  chunksIngested: number;
}> {
  if (!extensionsRuntimeEnabled()) {
    return { skillsLoaded: 0, chunksIngested: 0 };
  }

  const { loadUserSkillsFromDir, ingestUserKnowledge } = await import('../skills/user-resources.js');
  const ids = await listEnabledExtensionIds();
  let skillsLoaded = 0;
  let chunksIngested = 0;

  for (const id of ids) {
    const base = path.join(CARINA_EXTENSION_RESOURCES_DIR, id);
    skillsLoaded += await loadUserSkillsFromDir(base);
    const knowledgeDir = path.join(base, 'knowledge');
    try {
      await fs.access(knowledgeDir);
      chunksIngested += await ingestUserKnowledge(base);
    } catch {
      // no rag staged
    }
  }

  return { skillsLoaded, chunksIngested };
}

/** Reload one enabled extension into the live runtime (no-op when extensions flag is off). */
export async function reloadExtensionRuntimeContributions(id: string): Promise<{
  skillsLoaded: number;
  toolsRegistered: number;
  promptSections: number;
  chunksIngested: number;
  mcpServers: number;
  hooksLoaded: number;
  rulePacks: number;
}> {
  if (!extensionsRuntimeEnabled()) {
    return { skillsLoaded: 0, toolsRegistered: 0, promptSections: 0, chunksIngested: 0, mcpServers: 0, hooksLoaded: 0, rulePacks: 0 };
  }

  await stageExtensionContributions(id);
  const { loadUserSkillsFromDir, ingestUserKnowledge } = await import('../skills/user-resources.js');
  const base = path.join(CARINA_EXTENSION_RESOURCES_DIR, id);
  const skillsLoaded = await loadUserSkillsFromDir(base);
  let chunksIngested = 0;
  try {
    await fs.access(path.join(base, 'knowledge'));
    chunksIngested = await ingestUserKnowledge(base);
  } catch {
    // no rag staged
  }

  const { unregisterExtensionTools, registerExtensionToolsFromBundle } = await import('./tools.js');
  unregisterExtensionTools(id);
  const toolsRegistered = await registerExtensionToolsFromBundle(id);
  const { loadExtensionPromptSuffixes } = await import('./prompts.js');
  const promptSections = await loadExtensionPromptSuffixes();

  const { reloadExtensionRulePacks } = await import('./rule-packs-loader.js');
  const rulePacks = await reloadExtensionRulePacks(id);

  const { loadExtensionMcpServers } = await import('./mcp-loader.js');
  const { loadExtensionHooks } = await import('./hooks-loader.js');
  const mcpServers = await loadExtensionMcpServers(id);
  const hooksLoaded = await loadExtensionHooks(id);

  return { skillsLoaded, toolsRegistered, promptSections, chunksIngested, mcpServers, hooksLoaded, rulePacks };
}

/** Tear down one extension from the live runtime (no-op when extensions flag is off). */
export async function unloadExtensionRuntimeContributions(id: string): Promise<void> {
  if (!extensionsRuntimeEnabled()) return;
  const { unregisterExtensionTools } = await import('./tools.js');
  unregisterExtensionTools(id);
  const { unloadExtensionMcpServers } = await import('./mcp-loader.js');
  const { unloadExtensionHooks } = await import('./hooks-loader.js');
  await unloadExtensionMcpServers(id);
  await unloadExtensionHooks(id);
  const { unloadExtensionRulePacks } = await import('./rule-packs-loader.js');
  await unloadExtensionRulePacks(id);
  await clearStagedExtensionContributions(id);
  const { loadExtensionPromptSuffixes } = await import('./prompts.js');
  await loadExtensionPromptSuffixes();
}
