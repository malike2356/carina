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

function isMissingSchemaError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  return (
    msg.includes('failed query')
    || msg.includes('does not exist')
    || (msg.includes('column') && msg.includes('workspace_settings'))
  );
}

export async function getWorkspaceBrainSettings(workspaceId: string): Promise<BrainSettings> {
  try {
    const [row] = await db
      .select()
      .from(workspaceSettings)
      .where(eq(workspaceSettings.workspaceId, workspaceId))
      .limit(1);
    return normalizeBrainSettings(row);
  } catch (err) {
    if (isMissingSchemaError(err)) {
      console.error(
        '[brain-settings] workspace_settings schema mismatch; using defaults. Run: pnpm db:migrate:prod',
        err instanceof Error ? err.message.slice(0, 200) : err,
      );
      return normalizeBrainSettings(null);
    }
    throw err;
  }
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
