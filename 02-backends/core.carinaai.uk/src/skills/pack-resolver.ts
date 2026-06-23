import type { PackManifest } from './pack-loader.js';
import { readPackManifest } from './pack-loader.js';
import type { PackDefinition } from './pack-types.js';
import { PackNotInstalledError } from './pack-types.js';
import { PACK_MANIFESTS, listKnownPackNames } from './pack-manifests.js';
import { loadPackModule, resolvePackDirectory, PACK_NPM_PACKAGES } from './pack-discovery.js';

export { PackNotInstalledError } from './pack-types.js';
export type { PackDefinition } from './pack-types.js';

type LegacyPackLoader = () => Promise<{ skills: PackDefinition['skills']; systemSuffix: string }>;

const LEGACY_PACK_LOADERS: Record<string, LegacyPackLoader> = {
  'core-engineering': async () => {
    const { coreEngineeringSkills } = await import('./packs/core-engineering/skills.js');
    return { skills: coreEngineeringSkills, systemSuffix: '' };
  },
  'creative-basics': async () => {
    const { creativeBasicsSkills } = await import('./packs/creative-basics/skills.js');
    return { skills: creativeBasicsSkills, systemSuffix: '' };
  },
  productivity: async () => {
    const { productivitySkills } = await import('./packs/productivity/skills.js');
    return { skills: productivitySkills, systemSuffix: '' };
  },
  finance: async () => {
    const { financeSkills } = await import('./packs/finance/skills.js');
    return { skills: financeSkills, systemSuffix: '' };
  },
  'research-basics': async () => {
    const { researchBasicsSkills } = await import('./packs/research-basics/skills.js');
    return { skills: researchBasicsSkills, systemSuffix: '' };
  },
  'data-science': async () => {
    const { dataScienceSkills } = await import('./packs/data-science/skills.js');
    return { skills: dataScienceSkills, systemSuffix: '' };
  },
  mlops: async () => {
    const { mlopsSkills } = await import('./packs/mlops/skills.js');
    return { skills: mlopsSkills, systemSuffix: '' };
  },
  'media-extended': async () => {
    const { mediaExtendedSkills } = await import('./packs/media-extended/skills.js');
    return { skills: mediaExtendedSkills, systemSuffix: '' };
  },
  'email-extended': async () => {
    const { emailExtendedSkills } = await import('./packs/email-extended/skills.js');
    return { skills: emailExtendedSkills, systemSuffix: '' };
  },
  'smart-home': async () => {
    const { smartHomeSkills } = await import('./packs/smart-home/skills.js');
    return { skills: smartHomeSkills, systemSuffix: '' };
  },
  'social-extended': async () => {
    const { socialExtendedSkills } = await import('./packs/social-extended/skills.js');
    return { skills: socialExtendedSkills, systemSuffix: '' };
  },
  devops: async () => {
    const { devopsSkills } = await import('./packs/devops/skills.js');
    return { skills: devopsSkills, systemSuffix: '' };
  },
  'legal-uk': async () => {
    const { legalUkSkills } = await import('./packs/legal-uk/skills.js');
    return { skills: legalUkSkills, systemSuffix: '' };
  },
  'sales-crm': async () => {
    const { salesCrmSkills } = await import('./packs/sales-crm/skills.js');
    return { skills: salesCrmSkills, systemSuffix: '' };
  },
  'borehole-africa': async () => {
    const { boreholeAfricaSkills } = await import('./packs/borehole-africa/skills.js');
    return { skills: boreholeAfricaSkills, systemSuffix: '' };
  },
  'operator-daily': async () => {
    const { operatorDailySkills } = await import('./packs/operator-daily/skills.js');
    return { skills: operatorDailySkills, systemSuffix: '' };
  },
  'capabilities-ops': async () => {
    const { capabilitiesOpsSkills } = await import('./packs/capabilities-ops/skills.js');
    return { skills: capabilitiesOpsSkills, systemSuffix: '' };
  },
  'marketing-ops': async () => {
    const { marketingOpsSkills } = await import('./packs/marketing-ops/skills.js');
    return { skills: marketingOpsSkills, systemSuffix: '' };
  },
  'meeting-ops': async () => {
    const { meetingOpsSkills } = await import('./packs/meeting-ops/skills.js');
    return { skills: meetingOpsSkills, systemSuffix: '' };
  },
  automation: async () => {
    const { automationSkills } = await import('./packs/automation/skills.js');
    return { skills: automationSkills, systemSuffix: '' };
  },
  recruitment: async () => {
    const { recruitmentSkills } = await import('./packs/recruitment/skills.js');
    return { skills: recruitmentSkills, systemSuffix: '' };
  },
  'cms-ops': async () => {
    const { cmsOpsSkills } = await import('./packs/cms-ops/skills.js');
    return { skills: cmsOpsSkills, systemSuffix: '' };
  },
};

const packCache = new Map<string, PackDefinition>();
let skillIndexCache: Set<string> | null = null;

async function loadInstalledPack(packName: string): Promise<PackDefinition> {
  const dir = resolvePackDirectory(packName);
  if (!dir) {
    throw new Error(`Unknown pack: ${packName}. Available: ${listKnownPackNames().join(', ')}`);
  }
  const manifest = await readPackManifest(dir);
  try {
    const loaded = await loadPackModule(packName);
    return { manifest, ...loaded };
  } catch (err) {
    throw new PackNotInstalledError(packName, err);
  }
}

async function loadLegacyOrExtractedPack(packName: string): Promise<PackDefinition> {
  const manifest = PACK_MANIFESTS[packName];

  if (manifest && PACK_NPM_PACKAGES[packName]) {
    const loaded = await loadPackModule(packName);
    return { manifest, ...loaded };
  }

  if (manifest) {
    const loader = LEGACY_PACK_LOADERS[packName];
    if (loader) {
      try {
        const loaded = await loader();
        return { manifest, ...loaded };
      } catch (err) {
        throw new PackNotInstalledError(packName, err);
      }
    }
  }

  return loadInstalledPack(packName);
}

export async function resolvePack(packName: string): Promise<PackDefinition> {
  const cached = packCache.get(packName);
  if (cached) return cached;

  const def = await loadLegacyOrExtractedPack(packName);
  packCache.set(packName, def);
  return def;
}

export async function warmPackSkillIndex(): Promise<void> {
  if (skillIndexCache) return;
  const names = new Set<string>();
  for (const packName of listKnownPackNames()) {
    try {
      const pack = await resolvePack(packName);
      for (const skill of pack.skills) names.add(skill.name);
    } catch {
      // Pack sources not on disk (kernel-only install).
    }
  }
  skillIndexCache = names;
}

export function getBuiltinSkillNames(): Set<string> {
  return skillIndexCache ?? new Set();
}

export function clearPackResolverCacheForTests(): void {
  packCache.clear();
  skillIndexCache = null;
}

export function clearPackResolverCache(): void {
  clearPackResolverCacheForTests();
}
