import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { emptyOutreachStore, loadOutreachStore, resetOutreachStoreCache, saveOutreachStore } from './store.js';

const mocks = vi.hoisted(() => ({
  listBookings: vi.fn(),
  getLead: vi.fn(),
  updateLead: vi.fn(),
  getAlertTarget: vi.fn(),
  sendAlert: vi.fn(),
  syncLeadBoardState: vi.fn(),
}));

vi.mock('./bookings.js', () => ({
  listBookings: (...args: unknown[]) => mocks.listBookings(...args),
}));

vi.mock('./leads.js', () => ({
  getLead: (...args: unknown[]) => mocks.getLead(...args),
  updateLead: (...args: unknown[]) => mocks.updateLead(...args),
}));

vi.mock('./alerts.js', () => ({
  getOutreachAlertTarget: (...args: unknown[]) => mocks.getAlertTarget(...args),
  sendOutreachTelegramAlert: (...args: unknown[]) => mocks.sendAlert(...args),
}));

vi.mock('./kanban.js', () => ({
  syncLeadBoardState: (...args: unknown[]) => mocks.syncLeadBoardState(...args),
}));

describe('follow-up scheduling', () => {
  let tmpHome = '';

  beforeEach(() => {
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'carina-outreach-followups-'));
    vi.stubEnv('CARINA_HOME', tmpHome);
    vi.resetModules();
    resetOutreachStoreCache();
    saveOutreachStore({
      ...emptyOutreachStore(),
      leads: [
        {
          id: 'lead-1',
          workspaceId: 'ws-1',
          name: 'Jane Prospect',
          email: 'jane@example.com',
          source: 'manual',
          status: 'new',
          tags: [],
          replyState: 'none',
          bookingState: 'none',
          linkedLeadIds: [],
          createdAt: '2026-08-01T10:00:00.000Z',
          updatedAt: '2026-08-01T10:00:00.000Z',
          lastContactedAt: '2026-08-01T10:00:00.000Z',
          timeline: [],
        },
      ],
    });
    mocks.listBookings.mockReturnValue([]);
    mocks.getLead.mockImplementation((workspaceId: string, leadId: string) =>
      loadOutreachStore().leads.find((lead) => lead.workspaceId === workspaceId && lead.id === leadId) ?? null,
    );
    mocks.updateLead.mockImplementation((workspaceId: string, leadId: string, patch: Record<string, unknown>) => {
      const store = loadOutreachStore();
      const idx = store.leads.findIndex((lead) => lead.workspaceId === workspaceId && lead.id === leadId);
      if (idx < 0) return null;
      const next = { ...store.leads[idx], ...patch, updatedAt: '2026-08-10T10:00:00.000Z' };
      store.leads[idx] = next;
      saveOutreachStore(store);
      return next;
    });
    mocks.getAlertTarget.mockReturnValue({
      workspaceId: 'ws-1',
      enabled: false,
      channel: 'telegram',
      conversationId: '',
      updatedAt: '2026-08-01T10:00:00.000Z',
    });
    mocks.sendAlert.mockResolvedValue({ ok: true, sent: true });
    mocks.syncLeadBoardState.mockResolvedValue({ ok: true });
  });

  afterEach(() => {
    resetOutreachStoreCache();
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it('creates follow-up tasks once and processes due tasks', async () => {
    const followUps = await import('./follow-ups.js');

    const first = followUps.refreshFollowUpPlans('ws-1');
    expect(first.created).toBe(2);
    expect(followUps.listFollowUpTasks('ws-1')).toHaveLength(2);

    const second = followUps.refreshFollowUpPlans('ws-1');
    expect(second.created).toBe(0);

    const digest = followUps.buildWeeklyOwnerDigest('ws-1', new Date('2026-08-09T10:00:00.000Z'));
    expect(digest.counts.new).toBe(1);
    expect(digest.followUpsDue).toBe(2);

    const processed = await followUps.processDueFollowUps('ws-1', new Date('2026-08-10T10:00:00.000Z'));
    expect(processed.sent).toHaveLength(2);
    expect(processed.skipped).toHaveLength(0);
    expect(followUps.listFollowUpTasks('ws-1', 'sent')).toHaveLength(2);
    expect(mocks.syncLeadBoardState).toHaveBeenCalled();
  });
});
