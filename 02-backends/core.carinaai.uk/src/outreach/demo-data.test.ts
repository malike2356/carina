import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('outreach demo-data purge', () => {
  let tmpHome: string;

  beforeEach(() => {
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'carina-demo-purge-'));
    vi.stubEnv('CARINA_HOME', tmpHome);
    vi.resetModules();
  });

  afterEach(() => {
    fs.rmSync(tmpHome, { recursive: true, force: true });
    vi.unstubAllEnvs();
  });

  it('previews and purges SOP_DEMO rows while keeping real leads', async () => {
    const { createLead, createCampaign, createLeadList, listLeads, listCampaigns, listLeadLists } =
      await import('./leads.js');
    const {
      previewDemoOutreachData,
      purgeDemoOutreachData,
      demoOutreachTotal,
      SOP_DEMO_TAG,
    } = await import('./demo-data.js');

    const real = createLead({
      workspaceId: 'ws-1',
      name: 'Real Lead',
      email: 'real@customer.com',
      source: 'manual',
    });
    const demo = createLead({
      workspaceId: 'ws-1',
      name: 'SOP Demo Prospect',
      email: 'hot@sop-demo.test',
      source: 'manual',
      tags: [SOP_DEMO_TAG],
    });
    createCampaign({
      workspaceId: 'ws-1',
      name: 'SOP Demo Campaign',
      objective: 'demo',
      sourceType: 'mixed',
      targetAudience: 'demo',
      dailyCap: 5,
      timezone: 'Europe/London',
      requireApproval: true,
      warmupDays: 0,
    });
    createCampaign({
      workspaceId: 'ws-1',
      name: 'Live pipeline',
      objective: 'book',
      sourceType: 'mixed',
      targetAudience: 'icp',
      dailyCap: 10,
      timezone: 'Europe/London',
      requireApproval: true,
      warmupDays: 7,
    });
    createLeadList({
      workspaceId: 'ws-1',
      name: 'SOP Demo Hot Prospects',
      leadIds: [demo.lead.id],
    });
    createLeadList({
      workspaceId: 'ws-1',
      name: 'Customer shortlist',
      leadIds: [real.lead.id],
    });

    const preview = await previewDemoOutreachData('ws-1');
    expect(preview.leads).toBe(1);
    expect(preview.lists).toBe(1);
    expect(preview.campaigns).toBe(1);
    expect(demoOutreachTotal(preview)).toBeGreaterThan(0);

    const result = await purgeDemoOutreachData('ws-1');
    expect(result.purged).toBe(true);
    expect(result.leads).toBe(1);
    expect(result.lists).toBe(1);
    expect(result.campaigns).toBe(1);

    const after = await previewDemoOutreachData('ws-1');
    expect(after.leads).toBe(0);
    expect(after.lists).toBe(0);
    expect(after.campaigns).toBe(0);

    expect(listLeads('ws-1').map((l) => l.id)).toEqual([real.lead.id]);
    expect(listCampaigns('ws-1').some((c) => c.name === 'Live pipeline')).toBe(true);
    expect(listCampaigns('ws-1').some((c) => /SOP Demo/i.test(c.name))).toBe(false);
    expect(listLeadLists('ws-1').map((l) => l.name)).toEqual(['Customer shortlist']);
  });
});
