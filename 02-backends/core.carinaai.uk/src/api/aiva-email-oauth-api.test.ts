import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  addSender: vi.fn(),
  credentialsConfigured: vi.fn(() => true),
  getWorker: vi.fn(),
  testImapConnection: vi.fn(),
  upsertEmailConnection: vi.fn(),
  upsertWorkerChannel: vi.fn(),
}));

vi.mock('../workers/worker-store.js', () => ({
  getWorker: mocks.getWorker,
}));

vi.mock('../ingestion/email/email-connection-store.js', () => ({
  addSender: mocks.addSender,
  getEmailConnection: vi.fn(),
  upsertEmailConnection: mocks.upsertEmailConnection,
}));

vi.mock('../ingestion/email/imap-connector.js', () => ({
  testImapConnection: mocks.testImapConnection,
}));

vi.mock('../channels/credential-store.js', () => ({
  credentialsConfigured: mocks.credentialsConfigured,
}));

vi.mock('../channels/channel-store.js', () => ({
  upsertWorkerChannel: mocks.upsertWorkerChannel,
}));

describe('finishOAuthConnection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.credentialsConfigured.mockReturnValue(true);
    mocks.getWorker.mockResolvedValue({ id: 'worker-1' });
    mocks.testImapConnection.mockResolvedValue({ ok: true });
    mocks.upsertEmailConnection.mockResolvedValue({ id: 'connection-1' });
  });

  it('registers the connected Gmail mailbox as the worker email channel', async () => {
    const { finishOAuthConnection } = await import('./aiva-email-oauth-api.js');

    const result = await finishOAuthConnection({
      workspaceId: 'workspace-1',
      workerId: 'worker-1',
      provider: 'gmail',
      email: 'owner@example.com',
      refreshToken: 'refresh-token',
      accessToken: 'access-token',
    });

    expect(result).toEqual({ ok: true });
    expect(mocks.upsertWorkerChannel).toHaveBeenCalledWith({
      workerId: 'worker-1',
      workspaceId: 'workspace-1',
      channel: 'email',
      identifier: 'owner@example.com',
      credentials: {
        connectionId: 'connection-1',
        provider: 'gmail',
      },
      verified: true,
    });
  });
});
