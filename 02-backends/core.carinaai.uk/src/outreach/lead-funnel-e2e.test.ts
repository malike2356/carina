import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { SYNTHETIC_SEO_LEAD_ROWS } from './fixtures/synthetic-seo-leads.js';
import { ingestLeads } from './lead-ingest.js';
import { assessLeadEnrolmentEligibility, previewCampaignRecipients } from './eligibility.js';
import { suppressAddress, isAddressSuppressed } from './suppressions.js';
import { classifyReplyText, processInboundReply } from './replies.js';
import { createSequence, enrollLead, listEnrollments } from './sequence-engine.js';
import { createCampaign, createLeadList, addLeadsToList, updateLead } from './leads.js';
import { markLeadAsCustomer } from './lifecycle.js';
import { buildFunnelReport } from './funnel-analytics.js';
import { exportCrmWorkbookCsv } from './lead-sheets.js';
import { ensureOutreachDefaults } from './seed.js';
import { resetOutreachStoreCache } from './store.js';

describe('aiva lead funnel e2e (synthetic)', () => {
  let tmp: string;
  let prevHome: string | undefined;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'carina-lead-funnel-'));
    prevHome = process.env.CARINA_HOME;
    process.env.CARINA_HOME = tmp;
    resetOutreachStoreCache();
  });

  afterEach(() => {
    if (prevHome === undefined) delete process.env.CARINA_HOME;
    else process.env.CARINA_HOME = prevHome;
    resetOutreachStoreCache();
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('imports workbook columns, campaigns, replies, conversion, and export', () => {
    const workspaceId = 'ws-funnel-e2e';
    ensureOutreachDefaults(workspaceId);

    const ingest = ingestLeads({
      workspaceId,
      kind: 'import',
      sourceType: 'upload',
      sourceName: 'synthetic-seo-workbook',
      rows: SYNTHETIC_SEO_LEAD_ROWS.map((row) => ({ ...row })),
    });
    expect(ingest.created).toBe(3);
    expect(ingest.leads[0]?.company).toBeTruthy();
    expect(ingest.leads[0]?.niche).toBeTruthy();
    expect(ingest.leads[0]?.townCity).toBeTruthy();
    expect(ingest.leads[0]?.website).toBeTruthy();
    expect(ingest.leads[0]?.sourceType).toBe('upload');

    const dup = ingestLeads({
      workspaceId,
      kind: 'import',
      sourceType: 'upload',
      rows: SYNTHETIC_SEO_LEAD_ROWS.map((row) => ({ ...row })),
    });
    expect(dup.created).toBe(0);
    expect(dup.duplicate + dup.updated).toBeGreaterThan(0);

    const eligibleLead = ingest.leads.find((l) => l.email?.includes('harbour-dental'))!;
    updateLead(workspaceId, eligibleLead.id, { status: 'ready', consentStatus: 'legitimate_interest' });

    const list = createLeadList({ workspaceId, name: 'Ready SEO', leadIds: [eligibleLead.id] });
    addLeadsToList(workspaceId, list.id, [eligibleLead.id]);

    const campaign = createCampaign({
      workspaceId,
      name: 'Synthetic SEO outreach',
      objective: 'test',
    });
    const sequence = createSequence({
      workspaceId,
      name: 'Synthetic sequence',
      steps: [
        {
          order: 1,
          label: 'Intro',
          channel: 'email',
          subject: 'Quick idea for {{company}}',
          body: 'Hi {{name}}, noticed {{company}} could grow local search.',
          delayHours: 0,
        },
      ],
    });

    const preview = previewCampaignRecipients({
      workspaceId,
      sequenceId: sequence.id,
      campaignId: campaign.id,
      leadIds: [eligibleLead.id],
    });
    expect(preview.eligible).toBe(1);
    expect(preview.previews[0]?.subject).toContain('Harbour Dental Care');

    const enrollment = enrollLead({
      workspaceId,
      leadId: eligibleLead.id,
      sequenceId: sequence.id,
      campaignId: campaign.id,
    });
    expect(enrollment.status).toBe('active');

    suppressAddress({
      workspaceId,
      email: 'blocked@example.test',
      reason: 'manual',
    });
    expect(isAddressSuppressed(workspaceId, 'blocked@example.test')).toBe(true);
    expect(assessLeadEnrolmentEligibility(workspaceId, {
      ...eligibleLead,
      email: 'blocked@example.test',
    }).eligible).toBe(false);

    expect(classifyReplyText('Re: idea', 'Not interested, please stop').classification).toBe('not_interested');

    const reply = processInboundReply({
      workspaceId,
      fromEmail: eligibleLead.email!,
      subject: 'Re: Quick idea',
      body: 'Sounds good, can we book a call next week?',
    });
    expect(reply.classification).toBe('interested');
    expect(listEnrollments(workspaceId, { leadId: eligibleLead.id, status: 'active' })).toHaveLength(0);

    const customer = markLeadAsCustomer(workspaceId, eligibleLead.id, { value: 1200, note: 'Closed after booking' });
    expect(customer?.status).toBe('won');
    expect(customer?.convertedCustomerAt).toBeTruthy();

    const report = buildFunnelReport(workspaceId);
    expect(report.totals.leads).toBe(3);
    expect(report.totals.customers).toBeGreaterThanOrEqual(1);
    expect(report.bySource.some((row) => row.source === 'upload')).toBe(true);

    const exported = exportCrmWorkbookCsv(workspaceId);
    expect(exported.header).toContain('Company');
    expect(exported.header).toContain('Source URL');
    expect(exported.csv).toContain('Northbridge Bakery Ltd');
    expect(exported.count).toBe(3);
  });
});
