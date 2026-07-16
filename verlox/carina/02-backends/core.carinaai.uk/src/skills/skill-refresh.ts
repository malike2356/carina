import {
  clearSkillIndexCache,
  buildSkillIndex,
} from './skill-index.js';
import { getOperatorActivePacks } from './operator-pack-store.js';
import { loadPackSkills, loadSkillMdRuntime, primeActivePackSkillCache, clearActivePackCaches } from './index.js';
import { loadAllUserResources } from './user-resources.js';
import { clearPackResolverCache } from './pack-resolver.js';

export type SkillRefreshReport = {
  packsLoaded: number;
  skillMdLoaded: number;
  userSkillsLoaded: number;
  userKnowledgeChunks: number;
  indexSize: number;
  refreshedAt: string;
};

export function clearSkillRuntimeCaches(): void {
  clearPackResolverCache();
  clearSkillIndexCache();
  clearActivePackCaches();
}

export async function refreshSkillRuntime(opts?: {
  platform?: string;
}): Promise<SkillRefreshReport> {
  clearSkillRuntimeCaches();

  let packsLoaded = 0;
  for (const name of getOperatorActivePacks()) {
    packsLoaded += await loadPackSkills(name);
  }
  await primeActivePackSkillCache();
  const skillMdLoaded = await loadSkillMdRuntime();
  const user = await loadAllUserResources();
  const index = await buildSkillIndex({
    platform: opts?.platform,
  });

  return {
    packsLoaded,
    skillMdLoaded,
    userSkillsLoaded: user.skillsLoaded,
    userKnowledgeChunks: user.chunksIngested,
    indexSize: index.length,
    refreshedAt: new Date().toISOString(),
  };
}
