import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('outreach program O01/O02', () => {
  let tmpHome: string;

  beforeEach(() => {
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'carina-outreach-'));
    vi.stubEnv('CARINA_HOME', tmpHome);
    vi.resetModules();
  });

  afterEach(() => {
    fs.rmSync(tmpHome, { recursive: true, force: true });
    vi.unstubAllEnvs();
  });

  it('creates leads, dedupes by email, and audits status transitions', async () => {
    const { createLead, updateLead, getLead } = await import('./leads.js');
    const first = createLead({
      workspaceId: 'ws-1',
      name: 'Ada Lovelace',
      email: 'Ada@Example.com',
      company: 'Analytical Engines',
      source: 'manual',
    });
    expect(first.duplicateOf).toBeUndefined();
    expect(first.lead.email).toBe('ada@example.com');
    expect(first.lead.timeline.some((e) => e.kind === 'system')).toBe(true);

    const dup = createLead({
      workspaceId: 'ws-1',
      name: 'A. Lovelace',
      email: 'ada@example.com',
      source: 'csv_import',
    });
    expect(dup.duplicateOf).toBe(first.lead.id);
    expect(dup.lead.id).toBe(first.lead.id);

    const moved = updateLead('ws-1', first.lead.id, { status: 'contacted' });
    expect(moved?.status).toBe('contacted');
    expect(moved?.timeline.some((e) => e.kind === 'status_change' && e.toStatus === 'contacted')).toBe(true);
    expect(getLead('ws-1', first.lead.id)?.lastContactedAt).toBeTruthy();
  });

  it('seeds defaults, enrolls a lead, processes due send behind Soft Wall, and stops on reply', async () => {
    const { createLead } = await import('./leads.js');
    const { ensureOutreachDefaults } = await import('./seed.js');
    const {
      enrollLead,
      processDueSends,
      recordLeadReply,
      listDeliveries,
      listEnrollments,
    } = await import('./sequence-engine.js');

    const { campaign, sequence } = ensureOutreachDefaults('ws-1');
    expect(sequence.steps.length).toBeGreaterThanOrEqual(4);
    expect(campaign.defaultSequenceId).toBe(sequence.id);

    const { lead } = createLead({
      workspaceId: 'ws-1',
      name: 'Grace Hopper',
      email: 'grace@example.com',
      company: 'USN',
      campaignId: campaign.id,
    });

    const past = new Date('2026-08-04T12:00:00.000Z');
    const enrollment = enrollLead({
      workspaceId: 'ws-1',
      leadId: lead.id,
      sequenceId: sequence.id,
      campaignId: campaign.id,
      startAt: past,
    });
    expect(enrollment.status).toBe('active');

    const due = processDueSends('ws-1', past);
    expect(due.processed.length).toBe(1);
    expect(due.processed[0]?.status).toBe('pending_approval');
    expect(listDeliveries('ws-1', { leadId: lead.id })).toHaveLength(1);

    recordLeadReply('ws-1', lead.id);
    const afterReply = listEnrollments('ws-1', { leadId: lead.id });
    expect(afterReply.every((e) => e.status === 'stopped' && e.stopReason === 'reply')).toBe(true);

    const later = processDueSends('ws-1', new Date(past.getTime() + 5 * 24 * 60 * 60 * 1000));
    expect(later.processed).toHaveLength(0);
  });

  it('skips sends outside business hours and respects daily cap', async () => {
    const { createLead, createCampaign } = await import('./leads.js');
    const { createSequence, enrollLead, processDueSends, markDeliveryStatus } = await import('./sequence-engine.js');

    const campaign = createCampaign({
      workspaceId: 'ws-1',
      name: 'Cap test',
      dailyCap: 1,
      timezone: 'UTC',
      businessHoursStart: '09:00',
      businessHoursEnd: '17:00',
      businessDays: [1, 2, 3, 4, 5],
    });
    const sequence = createSequence({
      workspaceId: 'ws-1',
      name: 'Cap seq',
      steps: [
        { subject: 'One', body: 'Body', delayHours: 0 },
        { subject: 'Two', body: 'Body', delayHours: 0 },
      ],
    });

    const night = new Date('2026-08-04T02:00:00.000Z'); // Tue 02:00 UTC
    const a = createLead({ workspaceId: 'ws-1', name: 'A', email: 'a@ex.com', campaignId: campaign.id }).lead;
    enrollLead({
      workspaceId: 'ws-1',
      leadId: a.id,
      sequenceId: sequence.id,
      campaignId: campaign.id,
      startAt: night,
    });
    const nightResult = processDueSends('ws-1', night);
    expect(nightResult.processed).toHaveLength(0);
    expect(nightResult.skipped[0]?.reason).toBe('outside_business_hours');

    const midday = new Date('2026-08-04T12:00:00.000Z');
    const first = processDueSends('ws-1', midday);
    expect(first.processed).toHaveLength(1);
    markDeliveryStatus('ws-1', first.processed[0]!.id, 'sent');

    const b = createLead({ workspaceId: 'ws-1', name: 'B', email: 'b@ex.com', campaignId: campaign.id }).lead;
    enrollLead({
      workspaceId: 'ws-1',
      leadId: b.id,
      sequenceId: sequence.id,
      campaignId: campaign.id,
      startAt: midday,
    });
    const capped = processDueSends('ws-1', midday);
    expect(capped.processed).toHaveLength(0);
    expect(capped.skipped.some((s) => s.reason === 'daily_cap')).toBe(true);
  });

  it('exports pipeline status helpers', async () => {
    const { isPipelineStatus } = await import('./pipeline.js');
    expect(isPipelineStatus('new')).toBe(true);
    expect(isPipelineStatus('bogus')).toBe(false);
  });
});
