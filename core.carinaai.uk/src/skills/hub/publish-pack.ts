import fs from 'fs/promises';
import path from 'path';
import { pathToFileURL } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';
import { validatePackDir } from './validate.js';
import { upsertHubPack, replacePackSkills } from './registry.js';
import type { PackSkillInput } from '../packs/property-uk/skills.js';

const execAsync = promisify(exec);

export async function buildPackArchiveFromDir(packDir: string, outputDir: string): Promise<string> {
  const manifest = await validatePackDir(packDir);
  await fs.mkdir(outputDir, { recursive: true });
  const archivePath = path.join(outputDir, `${manifest.name}.tar.gz`);
  await execAsync(`tar -czf "${archivePath}" -C "${packDir}" .`);
  return archivePath;
}

async function loadSkillsFromPackDir(packDir: string): Promise<PackSkillInput[]> {
  const skillsTs = path.join(packDir, 'skills.ts');
  try {
    await fs.access(skillsTs);
    const mod = await import(pathToFileURL(skillsTs).href) as {
      skills?: PackSkillInput[];
      default?: PackSkillInput[];
    };
    return mod.skills ?? mod.default ?? [];
  } catch {
    const skillsJson = path.join(packDir, 'skills.json');
    try {
      const raw = JSON.parse(await fs.readFile(skillsJson, 'utf-8')) as unknown;
      return Array.isArray(raw) ? raw as PackSkillInput[] : [];
    } catch {
      return [];
    }
  }
}

export async function publishPackDirectory(
  packDir: string,
  storageDir: string,
  options: { featured?: boolean } = {},
): Promise<{ name: string; version: string; archivePath: string; skillCount: number }> {
  const resolved = path.resolve(packDir);
  const manifest = await validatePackDir(resolved);
  const archivePath = await buildPackArchiveFromDir(resolved, storageDir);
  const skills = await loadSkillsFromPackDir(resolved);
  await upsertHubPack(
    {
      ...manifest,
      skillCount: skills.length > 0 ? skills.length : manifest.skillCount,
    },
    archivePath,
    options.featured === true,
  );
  if (skills.length > 0) {
    await replacePackSkills(manifest.name, skills);
  }
  return {
    name: manifest.name,
    version: manifest.version,
    archivePath,
    skillCount: skills.length,
  };
}
