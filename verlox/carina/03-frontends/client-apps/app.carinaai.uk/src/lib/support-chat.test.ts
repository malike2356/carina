import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createBuiltinProfileChatSession, createSupportChatSession, SUPPORT_CHAT_TITLE } from './support-chat';
import { createChatSession } from './chat-sessions';
import { BUILTIN_WORKSPACE_PROFILE_IDS } from './builtin-workspace-profiles';
import { ensureWorkspaceProfiles, getWorkspaceProfileByBuiltinId } from './workspace-profiles';

vi.mock('./chat-sessions', () => ({
  createChatSession: vi.fn(),
}));

vi.mock('./workspace-profiles', () => ({
  ensureWorkspaceProfiles: vi.fn(),
  getWorkspaceProfileByBuiltinId: vi.fn(),
}));

const profileRow = {
  id: 'profile-1',
  workspaceId: 'workspace-1',
  slug: 'support',
  name: 'Support',
  description: null,
  systemPrompt: 'prompt',
  provider: null,
  model: null,
  isBuiltin: true,
  builtinId: BUILTIN_WORKSPACE_PROFILE_IDS.support,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('support-chat', () => {
  beforeEach(() => {
    vi.mocked(ensureWorkspaceProfiles).mockReset();
    vi.mocked(getWorkspaceProfileByBuiltinId).mockReset();
    vi.mocked(createChatSession).mockReset();
    vi.mocked(getWorkspaceProfileByBuiltinId).mockResolvedValue(profileRow);
    vi.mocked(createChatSession).mockResolvedValue('session-1');
  });

  it('exports the support chat session title', () => {
    expect(SUPPORT_CHAT_TITLE).toBe('Product support');
  });

  it('creates a chat session with the support profile attached', async () => {
    const sessionId = await createSupportChatSession('workspace-1');

    expect(ensureWorkspaceProfiles).toHaveBeenCalledWith('workspace-1');
    expect(getWorkspaceProfileByBuiltinId).toHaveBeenCalledWith(
      'workspace-1',
      BUILTIN_WORKSPACE_PROFILE_IDS.support,
    );
    expect(createChatSession).toHaveBeenCalledWith('workspace-1', {
      title: SUPPORT_CHAT_TITLE,
      profileId: 'profile-1',
      provider: null,
      model: null,
    });
    expect(sessionId).toBe('session-1');
  });

  it('creates a chat session for other built-in profiles', async () => {
    vi.mocked(getWorkspaceProfileByBuiltinId).mockResolvedValue({
      ...profileRow,
      id: 'profile-2',
      slug: 'research',
      name: 'Research Assistant',
      builtinId: BUILTIN_WORKSPACE_PROFILE_IDS.research,
    });

    await createBuiltinProfileChatSession('workspace-1', BUILTIN_WORKSPACE_PROFILE_IDS.research);

    expect(createChatSession).toHaveBeenCalledWith('workspace-1', {
      title: 'Research Assistant',
      profileId: 'profile-2',
      provider: null,
      model: null,
    });
  });

  it('throws when the built-in profile is missing', async () => {
    vi.mocked(getWorkspaceProfileByBuiltinId).mockResolvedValue(null as never);

    await expect(createSupportChatSession('workspace-1')).rejects.toThrow(
      'Built-in profile is not available for this workspace',
    );
  });
});
