import { createChatSession } from '@/lib/chat-sessions';
import {
  BUILTIN_WORKSPACE_PROFILE_IDS,
  type BuiltinWorkspaceProfileId,
  getBuiltinWorkspaceProfileDefinition,
  isBuiltinWorkspaceProfileId,
} from '@/lib/builtin-workspace-profiles';
import { ensureWorkspaceProfiles, getWorkspaceProfileByBuiltinId } from '@/lib/workspace-profiles';

export const SUPPORT_CHAT_TITLE = 'Product support';

export async function createBuiltinProfileChatSession(
  workspaceId: string,
  builtinId: BuiltinWorkspaceProfileId,
  titleOverride?: string,
): Promise<string> {
  if (!isBuiltinWorkspaceProfileId(builtinId)) {
    throw new Error('Unknown built-in profile');
  }

  await ensureWorkspaceProfiles(workspaceId);
  const profile = await getWorkspaceProfileByBuiltinId(workspaceId, builtinId);
  if (!profile) {
    throw new Error('Built-in profile is not available for this workspace');
  }

  const definition = getBuiltinWorkspaceProfileDefinition(builtinId);
  return createChatSession(workspaceId, {
    title: titleOverride ?? definition.name,
    profileId: profile.id,
    provider: profile.provider,
    model: profile.model,
  });
}

export async function createSupportChatSession(workspaceId: string): Promise<string> {
  return createBuiltinProfileChatSession(
    workspaceId,
    BUILTIN_WORKSPACE_PROFILE_IDS.support,
    SUPPORT_CHAT_TITLE,
  );
}
