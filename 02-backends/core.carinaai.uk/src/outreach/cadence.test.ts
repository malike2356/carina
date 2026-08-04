import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../ingestion/email/email-connection-store.js', () => ({
  getEmailConnection: vi.fn(),
  listSenders: vi.fn(),
}));

describe('outreach cadence helpers', () => {
  let tmpHome: string;

  beforeEach(() => {
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'carina-outreach-cadence-'));
    vi.stubEnv('CARINA_HOME', tmpHome);
    vi.resetModules();
  });

  afterEach(() => {
    fs.rmSync(tmpHome, { recursive: true, force: true });
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it('summarises weekly target and approvals from real deliveries', async () => {
    const { createLead, createCampaign } = await import('./leads.js');
    const { createSequence, enrollLead, processDueSends } = await import('./sequence-engine.js');
    const { buildOutreachCadenceSummary } = await import('./cadence.js');

    const campaign = createCampaign({
      workspaceId: 'ws-1',
      name: 'Salesgrid warm-up',
      dailyCap: 10,
      weeklyTarget: 50,
      requireApproval: true,
      warmupDays: 14,
      fromEmail: 'sales@example.com',
    });
    const sequence = createSequence({
      workspaceId: 'ws-1',
      name: 'Cold email',
      steps: [
        { subject: 'Hello', body: 'Body', delayHours: 0 },
      ],
    });
    const lead = createLead({
      workspaceId: 'ws-1',
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      company: 'Analytical Engines',
      campaignId: campaign.id,
    }).lead;

    enrollLead({
      workspaceId: 'ws-1',
      leadId: lead.id,
      sequenceId: sequence.id,
      campaignId: campaign.id,
      startAt: new Date('2026-08-04T12:00:00.000Z'),
    });
    processDueSends('ws-1', new Date('2026-08-04T12:00:00.000Z'));

    const summary = await buildOutreachCadenceSummary({ workspaceId: 'ws-1', now: new Date('2026-08-04T12:00:00.000Z') });

    expect(summary.totalDailyCap).toBe(10);
    expect(summary.totalWeeklyTarget).toBe(50);
    expect(summary.pendingApprovals).toBe(1);
    expect(summary.remainingToWeeklyTarget).toBe(49);
    expect(summary.campaigns[0]?.warmupActive).toBe(true);
    expect(summary.campaigns[0]?.fromEmail).toBe('sales@example.com');
  });

  it('validates that configured sender matches the connected mailbox', async () => {
    const emailStore = await import('../ingestion/email/email-connection-store.js');
    const { createCampaign } = await import('./leads.js');
    const { validateCampaignFromMailbox } = await import('./cadence.js');

    (emailStore.getEmailConnection as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'conn-1',
      workerId: 'worker-1',
    });
    (emailStore.listSenders as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 'sender-1', connectionId: 'conn-1', emailAddress: 'sales@example.com', roleTag: 'client' },
    ]);

    const campaign = createCampaign({
      workspaceId: 'ws-1',
      name: 'Warm-up',
      fromEmail: 'sales@example.com',
    });
    const ok = await validateCampaignFromMailbox({
      workerId: 'worker-1',
      campaign,
    });
    expect(ok.ok).toBe(true);

    const mismatch = await validateCampaignFromMailbox({
      workerId: 'worker-1',
      campaign: { ...campaign, cadence: { ...campaign.cadence, fromEmail: 'other@example.com' } },
    });
    expect(mismatch.ok).toBe(false);
    expect(mismatch.reason).toMatch(/does not match/i);
  });
});
