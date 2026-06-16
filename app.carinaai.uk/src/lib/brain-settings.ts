import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { workspaceSettings } from '@/db/schema';
import {
  BRAIN_SETTINGS_DEFAULTS,
  clampBrainInt,
  type BrainSettings,
} from '@/lib/brain-settings-types';

export type { BrainSettings } from '@/lib/brain-settings-types';
export { BRAIN_SETTINGS_DEFAULTS } from '@/lib/brain-settings-types';

export function normalizeBrainSettings(
  row: Partial<typeof workspaceSettings.$inferSelect> | null | undefined,
): BrainSettings {
  return {
    autoExtractMemories: row?.autoExtractMemories ?? BRAIN_SETTINGS_DEFAULTS.autoExtractMemories,
    autoExtractSkills: row?.autoExtractSkills ?? BRAIN_SETTINGS_DEFAULTS.autoExtractSkills,
    autoApproveSkillsMinConfidence: clampBrainInt(
      row?.autoApproveSkillsMinConfidence,
      50,
      100,
      BRAIN_SETTINGS_DEFAULTS.autoApproveSkillsMinConfidence,
    ),
    maxSkillsPerRequest: clampBrainInt(
      row?.maxSkillsPerRequest,
      1,
      10,
      BRAIN_SETTINGS_DEFAULTS.maxSkillsPerRequest,
    ),
    injectMemoriesInChat: row?.injectMemoriesInChat ?? BRAIN_SETTINGS_DEFAULTS.injectMemoriesInChat,
  };
}

export async function getWorkspaceBrainSettings(workspaceId: string): Promise<BrainSettings> {
  const [row] = await db
    .select()
    .from(workspaceSettings)
    .where(eq(workspaceSettings.workspaceId, workspaceId))
    .limit(1);
  return normalizeBrainSettings(row);
}

export function parseBrainSettingsPatch(body: Record<string, unknown>): Partial<BrainSettings> {
  const patch: Partial<BrainSettings> = {};
  if (typeof body.autoExtractMemories === 'boolean') {
    patch.autoExtractMemories = body.autoExtractMemories;
  }
  if (typeof body.autoExtractSkills === 'boolean') {
    patch.autoExtractSkills = body.autoExtractSkills;
  }
  if (body.autoApproveSkillsMinConfidence !== undefined) {
    patch.autoApproveSkillsMinConfidence = clampBrainInt(
      Number(body.autoApproveSkillsMinConfidence),
      50,
      100,
      BRAIN_SETTINGS_DEFAULTS.autoApproveSkillsMinConfidence,
    );
  }
  if (body.maxSkillsPerRequest !== undefined) {
    patch.maxSkillsPerRequest = clampBrainInt(
      Number(body.maxSkillsPerRequest),
      1,
      10,
      BRAIN_SETTINGS_DEFAULTS.maxSkillsPerRequest,
    );
  }
  if (typeof body.injectMemoriesInChat === 'boolean') {
    patch.injectMemoriesInChat = body.injectMemoriesInChat;
  }
  return patch;
}
