import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { fileURLToPath } from 'url';
import { findRelevantSkills, listSkills, saveSkill, skillExistsByName } from './store.js';
import { propertyUkSkills } from './packs/property-uk/skills.js';
import { propertyUkSystemSuffix } from './packs/property-uk/prompts/system.js';

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PACK_DIRS: Record<string, string> = {
  'property-uk': path.join(__dirname, 'packs/property-uk'),
};

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

export async function loadPackSkills(packName: string): Promise<number> {
  if (packName !== 'property-uk') {
    throw new Error(`Unknown pack: ${packName}`);
  }

  let loaded = 0;
  for (const skill of propertyUkSkills) {
    if (await skillExistsByName(skill.name)) continue;
    await saveSkill(skill);
    loaded++;
  }
  return loaded;
}

export function getPackSystemSuffix(packName: string): string {
  if (packName === 'property-uk') return propertyUkSystemSuffix;
  return '';
}

export async function exportPack(packName: string, outputPath: string): Promise<void> {
  const packDir = PACK_DIRS[packName];
  if (!packDir) throw new Error(`Unknown pack: ${packName}`);

  const tmpDir = path.join(path.dirname(outputPath), `.carina-export-${Date.now()}`);
  await fs.mkdir(tmpDir, { recursive: true });

  const manifest = {
    name: packName,
    version: '1.0.0',
    exportedAt: new Date().toISOString(),
  };

  await fs.writeFile(
    path.join(tmpDir, 'manifest.json'),
    JSON.stringify(manifest, null, 2),
  );

  const skills = packName === 'property-uk' ? propertyUkSkills : [];
  await fs.writeFile(
    path.join(tmpDir, 'skills.json'),
    JSON.stringify(skills, null, 2),
  );

  const systemPath = path.join(packDir, 'prompts/system.ts');
  try {
    const systemContent = await fs.readFile(systemPath, 'utf8');
    await fs.writeFile(path.join(tmpDir, 'system-prompt.txt'), systemContent);
  } catch {
    await fs.writeFile(
      path.join(tmpDir, 'system-prompt.txt'),
      getPackSystemSuffix(packName),
    );
  }

  const dbSkills = await listSkills();
  await fs.writeFile(
    path.join(tmpDir, 'saved-skills.json'),
    JSON.stringify(dbSkills, null, 2),
  );

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
