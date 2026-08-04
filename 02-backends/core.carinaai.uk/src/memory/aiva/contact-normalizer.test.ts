import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../config/database-url.js', () => ({
  isDatabaseConfigured: () => true,
}));

const queryMock = vi.fn();
vi.mock('../db.js', () => ({
  pool: { query: (...args: unknown[]) => queryMock(...args) },
}));

vi.mock('./contact-identity.js', () => ({
  aivaContactIdentityEnabled: () => true,
  ensureAivaContactIdentitySchema: vi.fn(async () => undefined),
  listLinkedChannelContactIds: vi.fn(async () => ['workspace-owner', '7028923891', 'app']),
}));

vi.mock('./owner-auto-sync.js', async () => {
  const actual = await vi.importActual<typeof import('./owner-auto-sync.js')>('./owner-auto-sync.js');
  return {
    ...actual,
    ownerAutoSyncEnabled: () => true,
    isOwnerChannelPeer: vi.fn(async (opts: { contactId: string; channel: string }) => {
      if (opts.channel === 'web') return true;
      if (opts.contactId === '7028923891') return true;
      return false;
    }),
  };
});

describe('normalizeContact', () => {
  beforeEach(() => {
    queryMock.mockReset();
    queryMock.mockResolvedValue({ rows: [] });
  });

  it('collapses web guest variants to workspace-owner', async () => {
    const { normalizeContact } = await import('./contact-normalizer.js');
    for (const raw of ['app', 'app:abc', 'auto:xyz', 'contact-auto-76570af5', 'contact-1', '1']) {
      const result = await normalizeContact({
        workspaceId: 'ws-1',
        workerId: 'w-1',
        channel: 'web',
        rawContactId: raw,
      });
      expect(result.canonicalContactId).toBe('workspace-owner');
      expect(result.resolutionMethod).toBe('workspace_owner');
      expect(result.confidence).toBe('exact');
    }
  });

  it('maps owner Telegram DM to workspace-owner', async () => {
    const { normalizeContact } = await import('./contact-normalizer.js');
    const result = await normalizeContact({
      workspaceId: 'ws-1',
      workerId: 'w-1',
      channel: 'telegram',
      rawContactId: '7028923891',
      metadata: { telegramUserId: '7028923891' },
    });
    expect(result.canonicalContactId).toBe('workspace-owner');
    expect(result.resolutionMethod).toBe('workspace_owner');
  });

  it('keeps non-owner Telegram chat ids as canonical', async () => {
    const { normalizeContact } = await import('./contact-normalizer.js');
    const { isOwnerChannelPeer } = await import('./owner-auto-sync.js');
    vi.mocked(isOwnerChannelPeer).mockResolvedValue(false);

    const result = await normalizeContact({
      workspaceId: 'ws-1',
      workerId: 'w-1',
      channel: 'telegram',
      rawContactId: '9988776655',
      metadata: { telegramUserId: '9988776655' },
    });
    expect(result.canonicalContactId).toBe('9988776655');
    expect(result.confidence).toBe('high');
    expect(result.resolutionMethod).toBe('passthrough');
  });

  it('uses channel identity lookup when linked', async () => {
    const { normalizeContact } = await import('./contact-normalizer.js');
    const { isOwnerChannelPeer } = await import('./owner-auto-sync.js');
    vi.mocked(isOwnerChannelPeer).mockResolvedValue(false);
    queryMock.mockResolvedValueOnce({
      rows: [{ canonical_contact_id: 'contact-canonical-abc' }],
    });

    const result = await normalizeContact({
      workspaceId: 'ws-1',
      workerId: 'w-1',
      channel: 'whatsapp',
      rawContactId: '+447700900123',
    });
    expect(result.canonicalContactId).toBe('contact-canonical-abc');
    expect(result.resolutionMethod).toBe('channel_identity');
  });
});

describe('normalizeWebContactIdInput', () => {
  it('prefers authenticated user id', async () => {
    const { normalizeWebContactIdInput } = await import('./contact-normalizer.js');
    expect(normalizeWebContactIdInput({
      rawContactId: 'app',
      authenticatedUserId: 'user-123',
    })).toBe('user-123');
  });

  it('derives stable app fingerprint for guests', async () => {
    const { normalizeWebContactIdInput } = await import('./contact-normalizer.js');
    const a = normalizeWebContactIdInput({
      rawContactId: 'app',
      sessionToken: 'sess-stable',
    });
    const b = normalizeWebContactIdInput({
      rawContactId: 'app',
      sessionToken: 'sess-stable',
    });
    expect(a).toMatch(/^app:[a-f0-9]{16}$/);
    expect(a).toBe(b);
  });
});
