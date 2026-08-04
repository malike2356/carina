import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../memory/aiva/contact-identity.js', () => ({
  aivaContactIdentityEnabled: () => true,
  resolveAivaCanonicalContact: vi.fn(),
  generateAivaLinkCode: vi.fn(() => 'abcd1234'),
  claimAivaLinkCode: vi.fn(),
  linkAivaChannelContact: vi.fn(),
  listAivaContactIdentities: vi.fn(),
  listChannelSyncConversations: vi.fn(),
}));

vi.mock('../../memory/aiva/session-hydrate.js', () => ({
  hydrateCanonicalSessionFromLinkedChannels: vi.fn(async () => ({ hydrated: 0 })),
}));

describe('link-commands', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('generates an explicit link code', async () => {
    const identity = await import('../../memory/aiva/contact-identity.js');
    vi.mocked(identity.resolveAivaCanonicalContact).mockResolvedValue({
      canonicalContactId: 'app',
      sessionId: 'aiva-w-contact-app',
      linked: false,
      identities: [],
    });

    const { linkCommand } = await import('./link-commands.js');
    const reply = await linkCommand.handler({
      channel: 'web',
      workerId: 'w',
      workspaceId: 'ws',
      contactId: 'app',
      content: '/link code',
      rawPayload: {},
      timestamp: new Date(),
    }, 'w');

    expect(reply).toContain('Link code: abcd1234');
    expect(reply).toContain('/link claim abcd1234');
    expect(identity.generateAivaLinkCode).toHaveBeenCalled();
  });

  it('claims a code and links the current channel', async () => {
    const identity = await import('../../memory/aiva/contact-identity.js');
    vi.mocked(identity.resolveAivaCanonicalContact).mockResolvedValue({
      canonicalContactId: 'tg-1',
      sessionId: 'aiva-w-contact-tg-1',
      linked: false,
      identities: [],
    });
    vi.mocked(identity.claimAivaLinkCode).mockReturnValue({
      canonicalContactId: 'app',
      workspaceId: 'ws',
      workerId: 'w',
    });
    vi.mocked(identity.linkAivaChannelContact).mockResolvedValue([
      {
        id: '1',
        workspaceId: 'ws',
        workerId: 'w',
        canonicalContactId: 'app',
        channel: 'web',
        channelContactId: 'app',
        displayName: null,
        linkedAt: 1,
        lastSeenAt: 1,
        isPrimary: true,
        metadata: {},
      },
      {
        id: '2',
        workspaceId: 'ws',
        workerId: 'w',
        canonicalContactId: 'app',
        channel: 'telegram',
        channelContactId: 'tg-1',
        displayName: null,
        linkedAt: 2,
        lastSeenAt: 2,
        isPrimary: false,
        metadata: {},
      },
    ]);

    const { linkCommand } = await import('./link-commands.js');
    const reply = await linkCommand.handler({
      channel: 'telegram',
      workerId: 'w',
      workspaceId: 'ws',
      contactId: 'tg-1',
      content: '/link claim abcd1234',
      rawPayload: {},
      timestamp: new Date(),
    }, 'w');

    expect(reply).toContain('Channels linked.');
    expect(reply).toContain('Shared contact: app');
    expect(identity.linkAivaChannelContact).toHaveBeenCalledWith(
      expect.objectContaining({
        canonicalContactId: 'app',
        channel: 'telegram',
        channelContactId: 'tg-1',
      }),
    );
  });
});
