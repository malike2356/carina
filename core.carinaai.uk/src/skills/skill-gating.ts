import type { SkillGating, SkillRuntimeContext } from './skill-format.js';
import { gatingFromTags } from './skill-format.js';
import type { PackSkillInput } from './pack-types.js';
import type { Skill } from '../types/index.js';

export type SkillGateResult = {
  allowed: boolean;
  reason?: string;
};

function envConfigured(name: string): boolean {
  const value = process.env[name];
  return Boolean(value && value.trim());
}

export function evaluateSkillGating(
  gating: SkillGating | undefined,
  ctx: SkillRuntimeContext = {},
): SkillGateResult {
  if (!gating) return { allowed: true };

  if (gating.platforms?.length) {
    const platform = ctx.platform?.trim().toLowerCase();
    if (!platform) return { allowed: true };
    const allowed = gating.platforms.map((p) => p.toLowerCase());
    if (!allowed.includes(platform)) {
      return {
        allowed: false,
        reason: `platform "${platform}" not in [${allowed.join(', ')}]`,
      };
    }
  }

  for (const env of gating.requiredEnv ?? []) {
    if (!envConfigured(env)) {
      return { allowed: false, reason: `missing required env ${env}` };
    }
  }

  if (gating.requiresPacks?.length) {
    const active = new Set((ctx.activePacks ?? []).map((p) => p.toLowerCase()));
    for (const pack of gating.requiresPacks) {
      if (!active.has(pack.toLowerCase())) {
        return { allowed: false, reason: `requires active pack "${pack}"` };
      }
    }
  }

  return { allowed: true };
}

export function isPackSkillAllowed(
  skill: PackSkillInput & { gating?: SkillGating },
  ctx: SkillRuntimeContext,
): SkillGateResult {
  const gating = skill.gating ?? gatingFromTags((skill as Skill).tags);
  return evaluateSkillGating(gating, ctx);
}

export function isDatabaseSkillAllowed(
  skill: Skill,
  ctx: SkillRuntimeContext,
): SkillGateResult {
  return evaluateSkillGating(gatingFromTags(skill.tags), ctx);
}
