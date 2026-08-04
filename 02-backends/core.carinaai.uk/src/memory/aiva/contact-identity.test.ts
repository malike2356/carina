import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../config/database-url.js', () => ({
  isDatabaseConfigured: () => true,
}));

const query = vi.fn();

vi.mock('../db.js', () => ({
  pool: { query },
}));

describe('contact-identity channel sync', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    query.mockReset();
    const { clearAivaLinkCodesForTests } = await import('./contact-identity.js');
    clearAivaLinkCodesForTests();
  });

  it('builds channel-agnostic session ids', async () => {
    const { aivaCanonicalSessionId, aivaLegacyChannelSessionId } = await import('./contact-identity.js');
    expect(aivaCanonicalSessionId('w1', 'app')).toBe('aiva-w1-contact-app');
    expect(aivaLegacyChannelSessionId('w1', 'telegram', '99')).toBe('aiva-w1-telegram-99');
  });

  it('keeps unlinked peers on their own contact id (no auto-merge)', async () => {
    query
      .mockResolvedValueOnce({ rows: [] }) // ensureSchema create table
      .mockResolvedValueOnce({ rows: [] }) // ensureSchema index 1
      .mockResolvedValueOnce({ rows: [] }) // ensureSchema index 2
      .mockResolvedValueOnce({ rows: [] }) // select existing
      .mockResolvedValueOnce({ rows: [] }) // insert primary
      .mockResolvedValueOnce({ rows: [] }); // list identities

    const { resolveAivaCanonicalContact } = await import('./contact-identity.js');
    const resolved = await resolveAivaCanonicalContact({
      workspaceId: 'ws',
      workerId: 'w1',
      channel: 'telegram',
      channelContactId: 'tg-1',
      displayName: 'Owner',
    });

    expect(resolved.canonicalContactId).toBe('tg-1');
    expect(resolved.sessionId).toBe('aiva-w1-contact-tg-1');
    expect(resolved.linked).toBe(false);
  });

  it('links channels via explicit code claim', async () => {
    // First resolve on web for code generation path is not needed; test claim helpers directly.
    query
      .mockResolvedValueOnce({ rows: [] }) // ensureSchema create
      .mockResolvedValueOnce({ rows: [] }) // index 1
      .mockResolvedValueOnce({ rows: [] }) // index 2
      .mockResolvedValueOnce({ rows: [] }) // delete conflict
      .mockResolvedValueOnce({ rows: [] }) // insert/upsert link
      .mockResolvedValueOnce({
        rows: [
          {
            id: '1',
            workspace_id: 'ws',
            worker_id: 'w1',
            canonical_contact_id: 'app',
            channel: 'web',
            channel_contact_id: 'app',
            display_name: null,
            linked_at: '1',
            last_seen_at: '1',
            is_primary: true,
            metadata: {},
          },
          {
            id: '2',
            workspace_id: 'ws',
            worker_id: 'w1',
            canonical_contact_id: 'app',
            channel: 'telegram',
            channel_contact_id: 'tg-9',
            display_name: 'Me',
            linked_at: '2',
            last_seen_at: '2',
            is_primary: false,
            metadata: {},
          },
        ],
      });

    const {
      generateAivaLinkCode,
      claimAivaLinkCode,
      linkAivaChannelContact,
      aivaCanonicalSessionId,
    } = await import('./contact-identity.js');

    const code = generateAivaLinkCode({
      workspaceId: 'ws',
      workerId: 'w1',
      canonicalContactId: 'app',
      channel: 'web',
      channelContactId: 'app',
    });
    expect(code).toMatch(/^[a-f0-9]{8}$/);

    const claimed = claimAivaLinkCode(code, {
      workspaceId: 'ws',
      workerId: 'w1',
      channel: 'telegram',
      channelContactId: 'tg-9',
    });
    expect(claimed).toEqual({
      canonicalContactId: 'app',
      workspaceId: 'ws',
      workerId: 'w1',
    });

    const identities = await linkAivaChannelContact({
      workspaceId: 'ws',
      workerId: 'w1',
      canonicalContactId: 'app',
      channel: 'telegram',
      channelContactId: 'tg-9',
      displayName: 'Me',
    });

    expect(identities).toHaveLength(2);
    expect(aivaCanonicalSessionId('w1', 'app')).toBe('aiva-w1-contact-app');
    expect(identities.map((i) => i.channel).sort()).toEqual(['telegram', 'web']);
  });

  it('rejects claim on the same channel peer', async () => {
    const { generateAivaLinkCode, claimAivaLinkCode } = await import('./contact-identity.js');
    const code = generateAivaLinkCode({
      workspaceId: 'ws',
      workerId: 'w1',
      canonicalContactId: 'app',
      channel: 'web',
      channelContactId: 'app',
    });
    const claimed = claimAivaLinkCode(code, {
      workspaceId: 'ws',
      workerId: 'w1',
      channel: 'web',
      channelContactId: 'app',
    });
    expect(claimed).toEqual({ error: 'Claim the code from a different channel, not the same one.' });
  });

  it('rejects claim for a different worker', async () => {
    const { generateAivaLinkCode, claimAivaLinkCode } = await import('./contact-identity.js');
    const code = generateAivaLinkCode({
      workspaceId: 'ws',
      workerId: 'w1',
      canonicalContactId: 'app',
      channel: 'web',
      channelContactId: 'app',
    });
    const claimed = claimAivaLinkCode(code, {
      workspaceId: 'ws',
      workerId: 'w2',
      channel: 'telegram',
      channelContactId: 'tg-1',
    });
    expect(claimed).toEqual({ error: 'Link code belongs to a different Aiva worker.' });
  });
});

describe('aivaSessionId helper', () => {
  it('uses contact-canonical ids instead of workspace-owner collapse', async () => {
    const { aivaSessionId } = await import('./memory-commands.js');
    expect(aivaSessionId('w1', 'telegram', 'c1')).toBe('aiva-w1-contact-c1');
    expect(aivaSessionId('w1', 'web', 'app')).toBe('aiva-w1-contact-app');
  });
});
