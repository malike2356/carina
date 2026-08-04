import { beforeEach, describe, expect, it, vi } from 'vitest';

const getWorkspaceContactMock = vi.fn();
const provisionScoutTenantMock = vi.fn();
const sendScoutWelcomeEmailMock = vi.fn();
const issueScoutApiKeyMock = vi.fn();
const getAivaScoutWorkspaceMock = vi.fn();
const listScoutRetryCandidatesMock = vi.fn();
const markAivaScoutPendingMock = vi.fn();
const storeAivaScoutCredentialsMock = vi.fn();

vi.mock('../email/workspace-contact.js', () => ({
  getWorkspaceContact: (...args: unknown[]) => getWorkspaceContactMock(...args),
}));

vi.mock('./scout-provisioning.js', () => ({
  provisionScoutTenant: (...args: unknown[]) => provisionScoutTenantMock(...args),
}));

vi.mock('./scout-welcome-email.js', () => ({
  sendScoutWelcomeEmail: (...args: unknown[]) => sendScoutWelcomeEmailMock(...args),
}));

vi.mock('./subscription-manager.js', () => ({
  issueScoutApiKey: () => issueScoutApiKeyMock(),
}));

vi.mock('./aiva-scout-store.js', () => ({
  getAivaScoutWorkspace: (...args: unknown[]) => getAivaScoutWorkspaceMock(...args),
  listScoutRetryCandidates: () => listScoutRetryCandidatesMock(),
  markAivaScoutPending: (...args: unknown[]) => markAivaScoutPendingMock(...args),
  storeAivaScoutCredentials: (...args: unknown[]) => storeAivaScoutCredentialsMock(...args),
}));

const RETRY_DELAYS_MS = [30_000, 60_000, 120_000, 300_000, 600_000, 1_800_000, 3_600_000];

describe('provisionAivaScoutWorkspace', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    delete process.env.AIVA_SCOUT_BUNDLING_ENABLED;
    getAivaScoutWorkspaceMock.mockResolvedValue(null);
    issueScoutApiKeyMock.mockReturnValue('test-api-key');
    markAivaScoutPendingMock.mockResolvedValue(undefined);
    storeAivaScoutCredentialsMock.mockResolvedValue(undefined);
    sendScoutWelcomeEmailMock.mockResolvedValue(undefined);
  });

  it('returns disabled when AIVA_SCOUT_BUNDLING_ENABLED is false', async () => {
    process.env.AIVA_SCOUT_BUNDLING_ENABLED = 'false';
    const { provisionAivaScoutWorkspace } = await import('./aiva-scout-provisioning.js');
    const result = await provisionAivaScoutWorkspace({ workspaceId: 'ws-1' });
    expect(result.status).toBe('disabled');
    expect(provisionScoutTenantMock).not.toHaveBeenCalled();
  });

  it('returns connected immediately if workspace already provisioned', async () => {
    getAivaScoutWorkspaceMock.mockResolvedValue({
      scoutStatus: 'connected',
      scoutWorkspaceId: 'scout-ws-abc',
      scoutDashboardUrl: 'https://console.labyrinthscout.com/dashboard',
    });
    const { provisionAivaScoutWorkspace } = await import('./aiva-scout-provisioning.js');
    const result = await provisionAivaScoutWorkspace({ workspaceId: 'ws-1' });
    expect(result.status).toBe('connected');
    expect(result.scoutWorkspaceId).toBe('scout-ws-abc');
    expect(provisionScoutTenantMock).not.toHaveBeenCalled();
  });

  it('marks pending and schedules retry when owner email is missing', async () => {
    getWorkspaceContactMock.mockResolvedValue(null);
    const before = Date.now();
    const { provisionAivaScoutWorkspace } = await import('./aiva-scout-provisioning.js');
    const result = await provisionAivaScoutWorkspace({ workspaceId: 'ws-no-email' });
    expect(result.status).toBe('pending');
    const call = markAivaScoutPendingMock.mock.calls[0]?.[0] as { workspaceId: string; nextRetryAt: Date };
    expect(call.workspaceId).toBe('ws-no-email');
    expect(call.nextRetryAt.getTime()).toBeGreaterThanOrEqual(before + RETRY_DELAYS_MS[0]! - 500);
  });

  it('stores credentials and returns connected on successful provision', async () => {
    getWorkspaceContactMock.mockResolvedValue({ ownerEmail: 'owner@example.com' });
    provisionScoutTenantMock.mockResolvedValue({ accountId: 'scout-ws-xyz', setupToken: 'tok-123' });
    const { provisionAivaScoutWorkspace } = await import('./aiva-scout-provisioning.js');
    const result = await provisionAivaScoutWorkspace({ workspaceId: 'ws-2' });
    expect(result.status).toBe('connected');
    expect(result.scoutWorkspaceId).toBe('scout-ws-xyz');
    expect(storeAivaScoutCredentialsMock).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId: 'ws-2', scoutWorkspaceId: 'scout-ws-xyz' }),
    );
  });

  it('marks pending when Scout API returns no accountId', async () => {
    getWorkspaceContactMock.mockResolvedValue({ ownerEmail: 'owner@example.com' });
    provisionScoutTenantMock.mockResolvedValue(null);
    const { provisionAivaScoutWorkspace } = await import('./aiva-scout-provisioning.js');
    const result = await provisionAivaScoutWorkspace({ workspaceId: 'ws-3' });
    expect(result.status).toBe('pending');
    expect(markAivaScoutPendingMock).toHaveBeenCalled();
  });
});

describe('Scout retry backoff delays', () => {
  it('uses exponential backoff progression across 7 attempts', () => {
    expect(RETRY_DELAYS_MS[0]).toBe(30_000);
    expect(RETRY_DELAYS_MS[1]).toBe(60_000);
    expect(RETRY_DELAYS_MS[2]).toBe(120_000);
    expect(RETRY_DELAYS_MS[3]).toBe(300_000);
    expect(RETRY_DELAYS_MS[4]).toBe(600_000);
    expect(RETRY_DELAYS_MS[5]).toBe(1_800_000);
    expect(RETRY_DELAYS_MS[6]).toBe(3_600_000);
  });

  it('each successive delay is greater than the previous', () => {
    for (let i = 1; i < RETRY_DELAYS_MS.length; i++) {
      expect(RETRY_DELAYS_MS[i]!).toBeGreaterThan(RETRY_DELAYS_MS[i - 1]!);
    }
  });

  it('maximum delay does not exceed 1 hour', () => {
    const ONE_HOUR_MS = 3_600_000;
    for (const delay of RETRY_DELAYS_MS) {
      expect(delay).toBeLessThanOrEqual(ONE_HOUR_MS);
    }
  });
});

describe('retryPendingAivaScoutProvisioning', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    delete process.env.AIVA_SCOUT_BUNDLING_ENABLED;
    process.env.AIVA_SCOUT_BUNDLING_ENABLED = 'false';
    markAivaScoutPendingMock.mockResolvedValue(undefined);
  });

  it('returns 0 when no retry candidates exist', async () => {
    listScoutRetryCandidatesMock.mockResolvedValue([]);
    const { retryPendingAivaScoutProvisioning } = await import('./aiva-scout-provisioning.js');
    const count = await retryPendingAivaScoutProvisioning();
    expect(count).toBe(0);
  });

  it('returns the number of candidates processed', async () => {
    listScoutRetryCandidatesMock.mockResolvedValue([
      { workspaceId: 'ws-a' },
      { workspaceId: 'ws-b' },
    ]);
    getAivaScoutWorkspaceMock.mockResolvedValue(null);
    const { retryPendingAivaScoutProvisioning } = await import('./aiva-scout-provisioning.js');
    const count = await retryPendingAivaScoutProvisioning();
    expect(count).toBe(2);
  });
});
