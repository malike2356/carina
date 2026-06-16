import { getOperatorActivePacks as getActivePackNames } from './operator-pack-store.js';
import { listSkills } from './store.js';
import { loadSkillMdDocuments } from './skill-md-loader.js';
import { listWorkshopDrafts } from './workshop-store.js';
import { resolvePack } from './pack-resolver.js';
import { getLatestSkillVersion } from './skill-versions.js';
import { isPackSkillAllowed, isDatabaseSkillAllowed } from './skill-gating.js';
import { scanSkillSecurity } from './skill-security.js';
import type { SkillRuntimeContext } from './skill-format.js';

export type SkillIndexSource = 'pack' | 'database' | 'skill-md' | 'workshop';

export type SkillIndexEntry = {
  name: string;
  source: SkillIndexSource;
  pack?: string;
  version?: number;
  description: string;
  gated: boolean;
  gateReason?: string;
  securityWarnings: string[];
};

let cachedIndex: SkillIndexEntry[] | null = null;
let cachedIndexKey = '';

function runtimeKey(ctx: SkillRuntimeContext): string {
  return `${ctx.platform ?? ''}:${(ctx.activePacks ?? []).join(',')}`;
}

export function clearSkillIndexCache(): void {
  cachedIndex = null;
  cachedIndexKey = '';
}

export async function buildSkillIndex(ctx: SkillRuntimeContext = {}): Promise<SkillIndexEntry[]> {
  const key = runtimeKey({
    platform: ctx.platform,
    activePacks: ctx.activePacks ?? getActivePackNames(),
  });
  if (cachedIndex && cachedIndexKey === key) return cachedIndex;

  const activePacks = ctx.activePacks ?? getActivePackNames();
  const runtimeCtx: SkillRuntimeContext = { ...ctx, activePacks };
  const entries: SkillIndexEntry[] = [];
  const seen = new Set<string>();

  for (const packName of activePacks) {
    try {
      const pack = await resolvePack(packName);
      for (const skill of pack.skills) {
        if (seen.has(skill.name)) continue;
        seen.add(skill.name);
        const gate = isPackSkillAllowed(skill, runtimeCtx);
        const security = scanSkillSecurity(skill);
        entries.push({
          name: skill.name,
          source: 'pack',
          pack: packName,
          description: skill.description,
          gated: !gate.allowed,
          gateReason: gate.reason,
          securityWarnings: security.issues.filter((i) => i.level === 'warn').map((i) => i.code),
        });
      }
    } catch {
      // pack not installed on this host
    }
  }

  for (const doc of await loadSkillMdDocuments()) {
    if (seen.has(doc.name)) continue;
    seen.add(doc.name);
    const security = scanSkillSecurity(doc);
    entries.push({
      name: doc.name,
      source: 'skill-md',
      description: doc.description,
      gated: false,
      securityWarnings: security.issues.filter((i) => i.level === 'warn').map((i) => i.code),
    });
  }

  for (const skill of await listSkills()) {
    if (seen.has(skill.name)) continue;
    seen.add(skill.name);
    const gate = isDatabaseSkillAllowed(skill, runtimeCtx);
    const security = scanSkillSecurity(skill);
    const version = await getLatestSkillVersion(skill.id);
    entries.push({
      name: skill.name,
      source: 'database',
      version: version || undefined,
      description: skill.description,
      gated: !gate.allowed,
      gateReason: gate.reason,
      securityWarnings: security.issues.filter((i) => i.level === 'warn').map((i) => i.code),
    });
  }

  for (const draft of listWorkshopDrafts('pending')) {
    if (seen.has(draft.name)) continue;
    seen.add(draft.name);
    const security = scanSkillSecurity(draft);
    entries.push({
      name: draft.name,
      source: 'workshop',
      description: draft.description,
      gated: true,
      gateReason: 'pending workshop review',
      securityWarnings: security.issues.filter((i) => i.level === 'warn').map((i) => i.code),
    });
  }

  entries.sort((a, b) => a.name.localeCompare(b.name));
  cachedIndex = entries;
  cachedIndexKey = key;
  return entries;
}

export async function discoverSkills(
  ctx: SkillRuntimeContext = {},
): Promise<SkillIndexEntry[]> {
  const index = await buildSkillIndex(ctx);
  return index.filter((entry) => !entry.gated);
}
