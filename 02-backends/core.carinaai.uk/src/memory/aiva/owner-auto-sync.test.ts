import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../db.js', () => ({
  pool: {
    query: vi.fn(),
  },
}));

vi.mock('../../email/workspace-contact.js', () => ({
  getWorkspaceContact: vi.fn(async () => null),
}));

vi.mock('./contact-identity.js', () => ({
  aivaCanonicalSessionId: (workerId: string, contactId: string) => `aiva-${workerId}-contact-${contactId}`,
  ensureAivaContactIdentitySchema: vi.fn(async () => undefined),
  aivaContactIdentityEnabled: vi.fn(() => true),
  linkAivaChannelContact: vi.fn(async () => []),
  listAivaContactIdentities: vi.fn(async () => []),
  listLinkedChannelContactIds: vi.fn(async () => ['workspace-owner']),
  resolveAivaCanonicalContact: vi.fn(async (opts: {
    channelContactId: string;
    workerId: string;
  }) => ({
    canonicalContactId: opts.channelContactId,
    sessionId: `aiva-${opts.workerId}-contact-${opts.channelContactId}`,
    linked: false,
    identities: [],
  })),
}));

describe('owner-auto-sync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.AIVA_OWNER_AUTO_SYNC;
  });

  it('maps web app contacts to workspace-owner session', async () => {
    const { pool } = await import('../db.js');
    (pool.query as ReturnType<typeof vi.fn>).mockResolvedValue({ rows: [] });
    const { resolveAivaSessionWithOwnerAuto, OWNER_CANONICAL_CONTACT_ID } = await import(
      './owner-auto-sync.js'
    );

    const resolved = await resolveAivaSessionWithOwnerAuto({
      workspaceId: 'ws',
      workerId: 'w1',
      channel: 'web',
      contactId: 'app',
    });

    expect(resolved.ownerAuto).toBe(true);
    expect(resolved.linked).toBe(true);
    expect(resolved.canonicalContactId).toBe(OWNER_CANONICAL_CONTACT_ID);
    expect(resolved.sessionId).toBe(`aiva-w1-contact-${OWNER_CANONICAL_CONTACT_ID}`);
  });

  it('does not auto-claim a telegram peer when multiple customers exist', async () => {
    const { pool } = await import('../db.js');
    (pool.query as ReturnType<typeof vi.fn>).mockImplementation(async (sql: string) => {
      if (sql.includes('FROM aiva_contact_identities')) {
        return { rows: [] };
      }
      if (sql.includes('FROM channel_threads') && sql.includes('message_count')) {
        return {
          rows: [
            { contact_id: '100001', message_count: '40' },
            { contact_id: '100002', message_count: '35' },
            { contact_id: '100003', message_count: '30' },
            { contact_id: 'tg-customer-9', message_count: '5' },
          ],
        };
      }
      return { rows: [] };
    });

    const { resolveAivaSessionWithOwnerAuto } = await import('./owner-auto-sync.js');
    const resolved = await resolveAivaSessionWithOwnerAuto({
      workspaceId: 'ws',
      workerId: 'w1',
      channel: 'telegram',
      contactId: 'tg-customer-9',
    });

    expect(resolved.ownerAuto).toBe(false);
    expect(resolved.canonicalContactId).toBe('tg-customer-9');
  });

  it('auto-claims the sole telegram peer as owner', async () => {
    const { pool } = await import('../db.js');
    const { linkAivaChannelContact } = await import('./contact-identity.js');
    (pool.query as ReturnType<typeof vi.fn>).mockImplementation(async (sql: string) => {
      if (sql.includes('FROM aiva_contact_identities') && sql.includes('LIMIT 1')) {
        return { rows: [] };
      }
      if (sql.includes('FROM channel_threads') && sql.includes('message_count')) {
        return { rows: [{ contact_id: 'tg-owner-1', message_count: '12' }] };
      }
      if (sql.includes('canonical_contact_id IN')) {
        return { rows: [] };
      }
      return { rows: [] };
    });

    const { resolveAivaSessionWithOwnerAuto, OWNER_CANONICAL_CONTACT_ID } = await import(
      './owner-auto-sync.js'
    );
    const resolved = await resolveAivaSessionWithOwnerAuto({
      workspaceId: 'ws',
      workerId: 'w1',
      channel: 'telegram',
      contactId: '7028923891',
    });

    expect(resolved.ownerAuto).toBe(true);
    expect(resolved.canonicalContactId).toBe(OWNER_CANONICAL_CONTACT_ID);
    expect(linkAivaChannelContact).toHaveBeenCalled();
  });

  it('claims dominant real telegram peer when web owner already exists', async () => {
    const { pool } = await import('../db.js');
    (pool.query as ReturnType<typeof vi.fn>).mockImplementation(async (sql: string) => {
      if (sql.includes('canonical_contact_id = $3 AND channel = $4')) {
        return { rows: [] };
      }
      if (sql.includes("canonical_contact_id = $3 AND channel = 'web'")) {
        return { rows: [{ channel_contact_id: 'app' }] };
      }
      if (sql.includes('FROM channel_threads') && sql.includes('message_count')) {
        return {
          rows: [
            { contact_id: '7028923891', message_count: '218' },
            { contact_id: '1', message_count: '1' },
          ],
        };
      }
      if (sql.includes('canonical_contact_id IN')) {
        return { rows: [] };
      }
      return { rows: [] };
    });

    const { resolveAivaSessionWithOwnerAuto, OWNER_CANONICAL_CONTACT_ID } = await import(
      './owner-auto-sync.js'
    );
    const resolved = await resolveAivaSessionWithOwnerAuto({
      workspaceId: 'ws',
      workerId: 'w1',
      channel: 'telegram',
      contactId: '7028923891',
    });
    expect(resolved.ownerAuto).toBe(true);
    expect(resolved.canonicalContactId).toBe(OWNER_CANONICAL_CONTACT_ID);
  });

  it('can be disabled with AIVA_OWNER_AUTO_SYNC=false', async () => {
    process.env.AIVA_OWNER_AUTO_SYNC = 'false';
    const { resolveAivaSessionWithOwnerAuto } = await import('./owner-auto-sync.js');
    const resolved = await resolveAivaSessionWithOwnerAuto({
      workspaceId: 'ws',
      workerId: 'w1',
      channel: 'web',
      contactId: 'app',
    });
    expect(resolved.ownerAuto).toBe(false);
    expect(resolved.canonicalContactId).toBe('app');
  });
});
