export interface BrainSettings {
  autoExtractMemories: boolean;
  autoExtractSkills: boolean;
  autoApproveSkillsMinConfidence: number;
  maxSkillsPerRequest: number;
  injectMemoriesInChat: boolean;
}

export const BRAIN_SETTINGS_DEFAULTS: BrainSettings = {
  autoExtractMemories: true,
  autoExtractSkills: false,
  autoApproveSkillsMinConfidence: 85,
  maxSkillsPerRequest: 3,
  injectMemoriesInChat: true,
};

export function clampBrainInt(
  value: number | null | undefined,
  min: number,
  max: number,
  fallback: number,
): number {
  if (value == null || Number.isNaN(value)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(value)));
}
