import type { Skill } from '../types/index.js';
import type { PackManifest } from './pack-loader.js';

/** Skill shape used when authoring domain packs (before persistence). */
export type PackSkillInput = Omit<Skill, 'id' | 'createdAt' | 'usageCount'>;

export type LoadedPackModule = {
  skills: PackSkillInput[];
  systemSuffix: string;
};

export type PackDefinition = {
  manifest: PackManifest;
  skills: PackSkillInput[];
  systemSuffix: string;
};

export class PackNotInstalledError extends Error {
  constructor(packName: string, cause?: unknown) {
    super(
      `Domain pack "${packName}" is not installed. ` +
      `Install via Hub (carina pack install ${packName}), npm (@verlox/pack-*), or enable in ACTIVE_SKILL_PACKS.`,
    );
    this.name = 'PackNotInstalledError';
    if (cause instanceof Error) this.cause = cause;
  }
}
