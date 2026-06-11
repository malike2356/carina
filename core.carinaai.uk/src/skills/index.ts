import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { fileURLToPath } from 'url';
import { config } from '../config/index.js';
import { getOperatorActivePacks } from './operator-pack-store.js';
import { findRelevantSkills, listSkills, saveSkill, skillExistsByName } from './store.js';
import { propertyUkSkills } from './packs/property-uk/skills.js';
import { propertyUkSystemSuffix } from './packs/property-uk/prompts/system.js';
import { coreEngineeringSkills } from './packs/core-engineering/skills.js';
import { creativeBasicsSkills } from './packs/creative-basics/skills.js';
import { productivitySkills } from './packs/productivity/skills.js';
import { healthcareSkills } from './packs/healthcare/skills.js';
import { financeSkills } from './packs/finance/skills.js';
import { researchBasicsSkills } from './packs/research-basics/skills.js';
import { dataScienceSkills } from './packs/data-science/skills.js';
import { mlopsSkills } from './packs/mlops/skills.js';
import { mediaExtendedSkills } from './packs/media-extended/skills.js';
import { emailExtendedSkills } from './packs/email-extended/skills.js';
import { smartHomeSkills } from './packs/smart-home/skills.js';
import { socialExtendedSkills } from './packs/social-extended/skills.js';
import { devopsSkills } from './packs/devops/skills.js';
import { legalUkSkills } from './packs/legal-uk/skills.js';
import { salesCrmSkills } from './packs/sales-crm/skills.js';
import { loadSkillMdDocuments, findSkillMdByKeywords, skillMdToSkill } from './skill-md-loader.js';
import { loadPluginsFromDisk } from '../plugins/registry.js';
import { BUILTIN_PACKS_DIR, readPackManifest, type PackManifest } from './pack-loader.js';
import { loadAllUserResources } from './user-resources.js';

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface PackDefinition {
  manifest: PackManifest;
  skills: typeof propertyUkSkills;
  systemSuffix: string;
}

export const PACK_REGISTRY: Record<string, PackDefinition> = {
  'property-uk': {
    manifest: {
      name: 'property-uk',
      version: '1.0.0',
      description: 'UK property entrepreneurship',
      author: 'VERLOX Ltd',
      skillCount: 6,
      optional: true,
      category: 'property',
    },
    skills: propertyUkSkills,
    systemSuffix: propertyUkSystemSuffix,
  },
  'core-engineering': {
    manifest: {
      name: 'core-engineering',
      version: '1.0.0',
      description: 'Coding, GitHub, debugging, automation',
      author: 'VERLOX Ltd',
      skillCount: 18,
      optional: true,
      category: 'engineering',
    },
    skills: coreEngineeringSkills,
    systemSuffix: '',
  },
  'creative-basics': {
    manifest: {
      name: 'creative-basics',
      version: '1.0.0',
      description: 'HTML design, diagrams, mockups, ideation',
      author: 'VERLOX Ltd',
      skillCount: 7,
      optional: true,
      category: 'creative',
    },
    skills: creativeBasicsSkills,
    systemSuffix: '',
  },
  productivity: {
    manifest: {
      name: 'productivity',
      version: '1.0.0',
      description: 'Google, Notion, Airtable, OCR, weather, news',
      author: 'VERLOX Ltd',
      skillCount: 8,
      optional: true,
      category: 'productivity',
    },
    skills: productivitySkills,
    systemSuffix: '',
  },
  healthcare: {
    manifest: {
      name: 'healthcare',
      version: '1.0.0',
      description: 'Clinical notes, scheduling, compliance, medications',
      author: 'VERLOX Ltd',
      skillCount: 5,
      optional: true,
      category: 'healthcare',
    },
    skills: healthcareSkills,
    systemSuffix: '',
  },
  finance: {
    manifest: {
      name: 'finance',
      version: '1.0.0',
      description: 'Cashflow, VAT, invoicing, investment analysis',
      author: 'VERLOX Ltd',
      skillCount: 5,
      optional: true,
      category: 'finance',
    },
    skills: financeSkills,
    systemSuffix: '',
  },
  'research-basics': {
    manifest: {
      name: 'research-basics',
      version: '1.0.0',
      description: 'arXiv, RSS, investigation methodology',
      author: 'VERLOX Ltd',
      skillCount: 5,
      optional: true,
      category: 'research',
    },
    skills: researchBasicsSkills,
    systemSuffix: '',
  },
  'data-science': {
    manifest: {
      name: 'data-science',
      version: '1.0.0',
      description: 'Pandas, SQL, stats, geospatial analysis',
      author: 'VERLOX Ltd',
      skillCount: 8,
      optional: true,
      category: 'data',
    },
    skills: dataScienceSkills,
    systemSuffix: '',
  },
  mlops: {
    manifest: {
      name: 'mlops',
      version: '1.0.0',
      description: 'Training, MLflow, HF hub, model evaluation',
      author: 'VERLOX Ltd',
      skillCount: 6,
      optional: true,
      category: 'mlops',
    },
    skills: mlopsSkills,
    systemSuffix: '',
  },
  'media-extended': {
    manifest: {
      name: 'media-extended',
      version: '1.0.0',
      description: 'Spotify, video, podcast, image batch, TTS',
      author: 'VERLOX Ltd',
      skillCount: 6,
      optional: true,
      category: 'media',
    },
    skills: mediaExtendedSkills,
    systemSuffix: '',
  },
  'email-extended': {
    manifest: {
      name: 'email-extended',
      version: '1.0.0',
      description: 'Himalaya CLI, inbox triage, templates, email channel',
      author: 'VERLOX Ltd',
      skillCount: 5,
      optional: true,
      category: 'email',
    },
    skills: emailExtendedSkills,
    systemSuffix: '',
  },
  'smart-home': {
    manifest: {
      name: 'smart-home',
      version: '1.0.0',
      description: 'Home Assistant, Hue, climate, security routines',
      author: 'VERLOX Ltd',
      skillCount: 5,
      optional: true,
      category: 'smart-home',
    },
    skills: smartHomeSkills,
    systemSuffix: '',
  },
  'social-extended': {
    manifest: {
      name: 'social-extended',
      version: '1.0.0',
      description: 'X posting, Discord admin, Slack standup, social listening',
      author: 'VERLOX Ltd',
      skillCount: 6,
      optional: true,
      category: 'social',
    },
    skills: socialExtendedSkills,
    systemSuffix: '',
  },
  devops: {
    manifest: {
      name: 'devops',
      version: '1.0.0',
      description: 'Kanban sprints, CI debug, Docker, K8s, webhooks',
      author: 'VERLOX Ltd',
      skillCount: 6,
      optional: true,
      category: 'devops',
    },
    skills: devopsSkills,
    systemSuffix: '',
  },
  'legal-uk': {
    manifest: {
      name: 'legal-uk',
      version: '1.0.0',
      description: 'GDPR readiness, AST drafts, Companies House filings, contract review',
      author: 'VERLOX Ltd',
      skillCount: 4,
      optional: true,
      category: 'legal',
    },
    skills: legalUkSkills,
    systemSuffix: '',
  },
  'sales-crm': {
    manifest: {
      name: 'sales-crm',
      version: '1.0.0',
      description: 'Deal staging, email sequences, proposals, pipeline reviews',
      author: 'VERLOX Ltd',
      skillCount: 4,
      optional: true,
      category: 'sales',
    },
    skills: salesCrmSkills,
    systemSuffix: '',
  },
};

export function listAvailablePacks(): PackManifest[] {
  return Object.values(PACK_REGISTRY).map((p) => p.manifest);
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

export async function loadPackSkills(packName: string): Promise<number> {
  const pack = PACK_REGISTRY[packName];
  if (!pack) {
    throw new Error(`Unknown pack: ${packName}. Available: ${Object.keys(PACK_REGISTRY).join(', ')}`);
  }

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
  return PACK_REGISTRY[packName]?.systemSuffix ?? '';
}

export function getActivePackSuffixes(): string {
  const active = getActivePackNames();
  const parts = active
    .map((name) => getPackSystemSuffix(name))
    .filter(Boolean);
  return parts.join('\n\n');
}

const USER_RAG_PACK = 'user-resources';

export function getBuiltinSkillNames(): Set<string> {
  const names = new Set<string>();
  for (const pack of Object.values(PACK_REGISTRY)) {
    for (const skill of pack.skills) {
      names.add(skill.name);
    }
  }
  return names;
}

export function getActivePackSkillNames(): Set<string> {
  const names = new Set<string>();
  for (const packName of getActivePackNames()) {
    const pack = PACK_REGISTRY[packName];
    if (!pack) continue;
    for (const skill of pack.skills) {
      names.add(skill.name);
    }
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

async function loadPackExtensions(packName: string): Promise<void> {
  if (packName === 'property-uk') {
    await import('./packs/property-uk/domain-data.js');
  }
}

export async function registerActivePackTools(): Promise<void> {
  if (!getActivePackNames().includes('property-uk')) return;

  await loadPackExtensions('property-uk');
  const { registry } = await import('../tools/registry.js');
  const { domainLookupTool } = await import('../tools/domain-lookup.js');
  if (!registry.get('domain_lookup')) {
    registry.register(domainLookupTool);
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
  const packsLoaded = await loadActivePacks();
  const skillMdLoaded = await loadSkillMdRuntime();
  const pluginsLoaded = await loadPluginsFromDisk();
  for (const packName of getActivePackNames()) {
    await loadPackExtensions(packName);
  }
  await registerActivePackTools();
  const user = await loadAllUserResources();
  if (packsLoaded > 0 || skillMdLoaded > 0 || user.skillsLoaded > 0) {
    console.log(
      `Skills ready: ${packsLoaded} from packs, ${skillMdLoaded} SKILL.md, ${user.skillsLoaded} user skills, ${user.chunksIngested} knowledge chunks, ${pluginsLoaded} plugins`,
    );
  } else if (getActivePackNames().length === 0) {
    console.log('General-purpose mode: no optional skill packs active');
  }
}

export async function exportPack(packName: string, outputPath: string): Promise<void> {
  const pack = PACK_REGISTRY[packName];
  if (!pack) throw new Error(`Unknown pack: ${packName}`);

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
  for (const [name, pack] of Object.entries(PACK_REGISTRY)) {
    try {
      const manifest = await readPackManifest(path.join(BUILTIN_PACKS_DIR, name));
      pack.manifest = manifest;
    } catch {
      // use built-in manifest
    }
  }
}
