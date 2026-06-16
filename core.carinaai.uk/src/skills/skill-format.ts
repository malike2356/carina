import type { PackSkillInput } from './pack-types.js';

export type SkillGating = {
  /** Surfaces where the skill applies (web, cli, telegram, etc.). Empty means all. */
  platforms?: string[];
  /** All listed env vars must be set for the skill to load. */
  requiredEnv?: string[];
  /** Skill only applies when these packs are active. */
  requiresPacks?: string[];
};

export type SkillAuthoringInput = PackSkillInput & {
  gating?: SkillGating;
  source?: string;
};

export type SkillRuntimeContext = {
  platform?: string;
  activePacks?: string[];
};

export const SKILL_FORMAT_VERSION = 1;

export function normalizeSkillGating(raw: unknown): SkillGating | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const g = raw as Record<string, unknown>;
  const gating: SkillGating = {};
  if (Array.isArray(g.platforms)) {
    gating.platforms = g.platforms.map(String).map((s) => s.trim().toLowerCase()).filter(Boolean);
  }
  if (Array.isArray(g.requiredEnv)) {
    gating.requiredEnv = g.requiredEnv.map(String).map((s) => s.trim()).filter(Boolean);
  }
  if (Array.isArray(g.requiresPacks)) {
    gating.requiresPacks = g.requiresPacks.map(String).map((s) => s.trim()).filter(Boolean);
  }
  if (!gating.platforms?.length && !gating.requiredEnv?.length && !gating.requiresPacks?.length) {
    return undefined;
  }
  return gating;
}

export function gatingFromTags(tags?: string[]): SkillGating | undefined {
  if (!tags?.length) return undefined;
  const gating: SkillGating = {};
  for (const tag of tags) {
    if (tag.startsWith('platform:')) {
      gating.platforms ??= [];
      gating.platforms.push(tag.slice('platform:'.length));
    }
    if (tag.startsWith('env:')) {
      gating.requiredEnv ??= [];
      gating.requiredEnv.push(tag.slice('env:'.length));
    }
    if (tag.startsWith('pack:')) {
      gating.requiresPacks ??= [];
      gating.requiresPacks.push(tag.slice('pack:'.length));
    }
  }
  return normalizeSkillGating(gating);
}

export function tagsFromGating(gating?: SkillGating): string[] {
  if (!gating) return [];
  const tags: string[] = [];
  for (const platform of gating.platforms ?? []) tags.push(`platform:${platform}`);
  for (const env of gating.requiredEnv ?? []) tags.push(`env:${env}`);
  for (const pack of gating.requiresPacks ?? []) tags.push(`pack:${pack}`);
  return tags;
}
