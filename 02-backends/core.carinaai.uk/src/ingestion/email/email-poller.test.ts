import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Worker } from '../../types/index.js';

vi.mock('../../memory/db.js', () => ({
  pool: { query: vi.fn(async () => ({ rows: [] })) },
}));

vi.mock('croner', () => {
  class CronMock {
    stop = vi.fn();
    constructor(_expression: string, _options: unknown, _callback: () => void) {}
  }
  return { Cron: CronMock };
});

const getWorkerById = vi.fn(async (): Promise<Worker | null> => null);
const listPollableConnections = vi.fn(async () => []);
const getEmailConnection = vi.fn(async () => null);

vi.mock('../../workers/worker-store.js', () => ({
  getWorkerById,
  logActivity: vi.fn(async () => {}),
}));

vi.mock('./email-connection-store.js', () => ({
  digestExists: vi.fn(async () => false),
  getEmailConnection,
  getEmailCredentials: vi.fn(async () => null),
  listPollableConnections,
  listSenders: vi.fn(async () => []),
  saveDigest: vi.fn(async () => {}),
  updateLastPollAt: vi.fn(async () => {}),
}));

vi.mock('./imap-connector.js', () => ({
  fetchUnseenFromSenders: vi.fn(async () => []),
  markMessagesSeen: vi.fn(async () => {}),
}));

vi.mock('./email-parser.js', () => ({
  parseEmailDigest: vi.fn(() => ({ summary: 'test' })),
}));

vi.mock('./email-categorizer.js', () => ({
  categorizeEmail: vi.fn(() => 'client_query'),
  categoryLabel: vi.fn(() => 'Client query'),
}));

vi.mock('./email-draft-handler.js', () => ({
  createDraftApprovalForEmail: vi.fn(async () => null),
}));

vi.mock('./email-imap-auth.js', () => ({
  resolveWorkerImapAuth: vi.fn(async () => null),
}));

const isEmailIngestionEnabled = vi.fn(() => false);
const isEmailIngestionActive = vi.fn(() => false);
const isEmailIngestionEnabledForWorkspace = vi.fn(() => false);
const isPropreneurBridgeEnabled = vi.fn(() => false);

vi.mock('../../workers/aiva-feature-flags.js', () => ({
  isEmailIngestionEnabled,
  isEmailIngestionActive,
  isEmailIngestionEnabledForWorkspace,
  isPropreneurBridgeEnabled,
}));

describe('email-poller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isEmailIngestionEnabled.mockReturnValue(false);
    isEmailIngestionActive.mockReturnValue(false);
    isEmailIngestionEnabledForWorkspace.mockReturnValue(false);
    isPropreneurBridgeEnabled.mockReturnValue(false);
    getWorkerById.mockResolvedValue(null);
    listPollableConnections.mockResolvedValue([]);
    getEmailConnection.mockResolvedValue(null);
  });

  it('pollAllWorkerInboxes returns empty when ingestion is inactive', async () => {
    const { pollAllWorkerInboxes } = await import('./email-poller.js');
    await expect(pollAllWorkerInboxes()).resolves.toEqual([]);
    expect(listPollableConnections).not.toHaveBeenCalled();
  });

  it('pollAllWorkerInboxes polls only pilot-enabled workspaces', async () => {
    isEmailIngestionActive.mockReturnValue(true);
    isEmailIngestionEnabledForWorkspace.mockImplementation((workspaceId) => workspaceId === 'ws-pilot');
    getWorkerById.mockResolvedValue({
      id: 'w1',
      workspaceId: 'ws-pilot',
      name: 'Test',
      status: 'active',
    } as Worker);
    listPollableConnections.mockResolvedValue([
      {
        id: 'c1',
        workerId: 'w1',
        imapHost: 'imap.example.com',
        imapPort: 993,
        imapTls: true,
        lastPollAt: null,
        status: 'connected',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
    getEmailConnection.mockResolvedValue(null);

    const { pollAllWorkerInboxes } = await import('./email-poller.js');
    const results = await pollAllWorkerInboxes();
    expect(results).toHaveLength(1);
    expect(results[0]?.error).toBe('No email connection');
  });

  it('pollAllWorkerInboxes skips workspaces outside pilot allowlist', async () => {
    isEmailIngestionActive.mockReturnValue(true);
    isEmailIngestionEnabledForWorkspace.mockReturnValue(false);
    getWorkerById.mockResolvedValue({
      id: 'w1',
      workspaceId: 'ws-other',
      name: 'Test',
      status: 'active',
    } as Worker);
    listPollableConnections.mockResolvedValue([
      {
        id: 'c1',
        workerId: 'w1',
        imapHost: 'imap.example.com',
        imapPort: 993,
        imapTls: true,
        lastPollAt: null,
        status: 'connected',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    const { pollAllWorkerInboxes } = await import('./email-poller.js');
    await expect(pollAllWorkerInboxes()).resolves.toEqual([]);
    expect(getEmailConnection).not.toHaveBeenCalled();
  });

  it('pollAllWorkerInboxes polls only listPollableConnections when globally enabled', async () => {
    isEmailIngestionActive.mockReturnValue(true);
    isEmailIngestionEnabledForWorkspace.mockReturnValue(true);
    getWorkerById.mockResolvedValue({
      id: 'w1',
      workspaceId: 'ws-1',
      name: 'Test',
      status: 'active',
    } as Worker);
    listPollableConnections.mockResolvedValue([
      {
        id: 'c1',
        workerId: 'w1',
        imapHost: 'imap.example.com',
        imapPort: 993,
        imapTls: true,
        lastPollAt: null,
        status: 'connected',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    const { pollAllWorkerInboxes } = await import('./email-poller.js');
    const results = await pollAllWorkerInboxes();
    expect(results).toHaveLength(1);
    expect(results[0]?.workerId).toBe('w1');
    expect(results[0]?.error).toBe('No email connection');
  });

  it('pollWorkerInbox skips Propreneur-bound workers', async () => {
    isPropreneurBridgeEnabled.mockReturnValue(true);
    getWorkerById.mockResolvedValue({
      id: 'w-pp',
      propreneurTenantSlug: 'demo-tenant',
    } as Worker);

    const { pollWorkerInbox } = await import('./email-poller.js');
    const result = await pollWorkerInbox('w-pp');
    expect(result.processed).toBe(0);
    expect(result.error).toContain('Propreneur owns email ingestion');
    expect(getEmailConnection).not.toHaveBeenCalled();
  });

  it('startEmailIngestionPoller is a no-op when ingestion flag is off', async () => {
    const croner = await import('croner');
    const CronSpy = vi.spyOn(croner, 'Cron');
    const { startEmailIngestionPoller, stopEmailIngestionPoller } = await import('./email-poller.js');
    stopEmailIngestionPoller();
    CronSpy.mockClear();
    startEmailIngestionPoller();
    expect(CronSpy).not.toHaveBeenCalled();
  });

  it('startEmailIngestionPoller schedules cron when ingestion is active', async () => {
    isEmailIngestionActive.mockReturnValue(true);
    const croner = await import('croner');
    const CronSpy = vi.spyOn(croner, 'Cron');
    const { startEmailIngestionPoller, stopEmailIngestionPoller } = await import('./email-poller.js');
    stopEmailIngestionPoller();
    CronSpy.mockClear();
    startEmailIngestionPoller();
    expect(CronSpy).toHaveBeenCalled();
  });
});
