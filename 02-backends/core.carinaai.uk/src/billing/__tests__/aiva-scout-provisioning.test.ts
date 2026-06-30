import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fetchMock = vi.fn();
const poolQuery = vi.fn();

vi.mock('../memory/db.js', () => ({
  pool: { query: (...args: unknown[]) => poolQuery(...args) },
}));

vi.mock('../email/workspace-contact.js', () => ({
  getWorkspaceContact: vi.fn().mockResolvedValue({ ownerEmail: 'owner@example.com' }),
}));

vi.mock('../scout-provisioning.js', () => ({
  provisionScoutTenant: vi.fn(),
}));

vi.mock('../scout-welcome-email.js', () => ({
  sendScoutWelcomeEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../subscription-manager.js', () => ({
  issueScoutApiKey: vi.fn().mockReturnValue('scout_live_testkey'),
}));

vi.mock('../aiva-scout-store.js', () => ({
  getAivaScoutWorkspace: vi.fn(),
  storeAivaScoutCredentials: vi.fn().mockResolvedValue(undefined),
  markAivaScoutPending: vi.fn().mockResolvedValue(undefined),
  listScoutRetryCandidates: vi.fn().mockResolvedValue([]),
}));

describe('aiva-scout-provisioning', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    delete process.env.AIVA_SCOUT_BUNDLING_ENABLED;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('returns connected when Scout workspace already provisioned', async () => {
    const store = await import('../aiva-scout-store.js');
    vi.mocked(store.getAivaScoutWorkspace).mockResolvedValue({
      workspaceId: 'ws-1',
      scoutWorkspaceId: 'acc-existing',
      scoutStatus: 'connected',
      scoutDashboardUrl: 'https://console.labyrinthscout.com/dashboard',
      scoutProvisionedAt: new Date(),
      scoutLastHeartbeatAt: null,
      scoutProvisionAttempts: 1,
      scoutNextRetryAt: null,
    });

    const { provisionAivaScoutWorkspace } = await import('../aiva-scout-provisioning.js');
    const result = await provisionAivaScoutWorkspace({ workspaceId: 'ws-1' });
    expect(result.status).toBe('connected');
    expect(result.scoutWorkspaceId).toBe('acc-existing');
  });

  it('stores credentials after successful Scout provision', async () => {
    const store = await import('../aiva-scout-store.js');
    const scout = await import('../scout-provisioning.js');
    vi.mocked(store.getAivaScoutWorkspace).mockResolvedValue(null);
    vi.mocked(scout.provisionScoutTenant).mockResolvedValue({
      accountId: 'acc-new',
      created: true,
      setupToken: 'tok',
    });

    const { provisionAivaScoutWorkspace } = await import('../aiva-scout-provisioning.js');
    const result = await provisionAivaScoutWorkspace({
      workspaceId: 'ws-2',
      email: 'pay@example.com',
    });

    expect(result.status).toBe('connected');
    expect(store.storeAivaScoutCredentials).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'ws-2',
        scoutWorkspaceId: 'acc-new',
        scoutApiKey: 'scout_live_testkey',
      }),
    );
  });

  it('marks pending when Scout API returns null', async () => {
    const store = await import('../aiva-scout-store.js');
    const scout = await import('../scout-provisioning.js');
    vi.mocked(store.getAivaScoutWorkspace).mockResolvedValue({
      workspaceId: 'ws-3',
      scoutWorkspaceId: null,
      scoutStatus: 'pending',
      scoutDashboardUrl: null,
      scoutProvisionedAt: null,
      scoutLastHeartbeatAt: null,
      scoutProvisionAttempts: 2,
      scoutNextRetryAt: null,
    });
    vi.mocked(scout.provisionScoutTenant).mockResolvedValue(null);

    const { provisionAivaScoutWorkspace } = await import('../aiva-scout-provisioning.js');
    const result = await provisionAivaScoutWorkspace({ workspaceId: 'ws-3', email: 'a@b.com' });
    expect(result.status).toBe('pending');
    expect(store.markAivaScoutPending).toHaveBeenCalled();
  });
});
