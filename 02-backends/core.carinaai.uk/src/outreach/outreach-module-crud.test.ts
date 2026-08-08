import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createLead } from '../outreach/leads.js';
import { pauseOutreach, resumeOutreach } from '../outreach/control.js';
import { planContactLeads } from '../outreach/contact-leads.js';
import {
  createWorkspaceLeadSheet,
  deleteLeadSheet,
  exportLeadsCsvText,
  leadSheetCanonicalHeader,
  listLeadSheetConfigs,
  syncWorkspaceLeadSheetToCrm,
} from '../outreach/lead-sheets.js';
import { resetOutreachStoreCache } from '../outreach/store.js';
import { createOutreachModuleCrudTools } from '../tools/outreach-module-crud-tools.js';
import { createOutreachLeadSheetTools } from '../tools/outreach-lead-sheet-tools.js';

describe('outreach module CRUD + lead sheets + contact plan', () => {
  let prevHome: string | undefined;
  let tmpHome: string;

  beforeEach(() => {
    prevHome = process.env.CARINA_HOME;
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'aiva-outreach-mod-'));
    process.env.CARINA_HOME = tmpHome;
    resetOutreachStoreCache();
  });

  afterEach(() => {
    if (prevHome === undefined) delete process.env.CARINA_HOME;
    else process.env.CARINA_HOME = prevHome;
    resetOutreachStoreCache();
    fs.rmSync(tmpHome, { recursive: true, force: true });
  });

  it('exposes campaign sequence enrollment and list tools', () => {
    const names = createOutreachModuleCrudTools('sess').map((t) => t.name);
    expect(names).toContain('outreach-campaigns-create');
    expect(names).toContain('outreach-sequences-create');
    expect(names).toContain('outreach-enrollments-enroll');
    expect(names).toContain('outreach-lists-create');
  });

  it('creates and syncs a workspace lead sheet without duplicating emails', async () => {
    createLead({ workspaceId: 'ws1', name: 'Ada', email: 'ada@example.com', company: 'Analytical' });
    const sheet = createWorkspaceLeadSheet({ workspaceId: 'ws1', name: 'Dentists UK', seedFromLeads: true });
    expect(sheet.kind).toBe('workspace_csv');
    expect(leadSheetCanonicalHeader()).toContain('campaign_id');

    const tools = createOutreachLeadSheetTools('sess');
    const list = tools.find((t) => t.name === 'outreach-leads-sheet-list')!;
    const listed = await list.execute({ workspaceId: 'ws1' });
    expect(listed).toMatchObject({ ok: true });

    const sync1 = syncWorkspaceLeadSheetToCrm('ws1', sheet.id);
    expect(sync1.ok).toBe(true);
    if (sync1.ok) {
      expect(sync1.created + sync1.duplicates).toBeGreaterThanOrEqual(1);
    }
    const sync2 = syncWorkspaceLeadSheetToCrm('ws1', sheet.id);
    expect(sync2.ok).toBe(true);
    if (sync2.ok) {
      expect(sync2.created).toBe(0);
      expect(sync2.duplicates).toBeGreaterThanOrEqual(1);
    }

    const exported = exportLeadsCsvText('ws1');
    expect(exported.count).toBeGreaterThanOrEqual(1);
    expect(exported.csv.split('\n')[0]).toContain('lead_id');

    const deleted = deleteLeadSheet('ws1', sheet.id);
    expect(deleted.ok).toBe(true);
    expect(listLeadSheetConfigs('ws1')).toHaveLength(0);
  });

  it('plans Soft Wall contact and refuses when paused', () => {
    createLead({ workspaceId: 'ws1', name: 'Grace', email: 'grace@example.com' });
    createLead({ workspaceId: 'ws1', name: 'NoEmail', company: 'No Mail Co' });

    const plan = planContactLeads({
      workspaceId: 'ws1',
      status: 'new',
      topic: 'discovery call',
      limit: 10,
    });
    expect(plan.ok).toBe(true);
    expect(plan.selected).toBe(1);
    expect(plan.skippedMissingEmail).toBe(1);
    expect(plan.drafts[0]?.email).toBe('grace@example.com');

    pauseOutreach('ws1', 'owner hold');
    const blocked = planContactLeads({ workspaceId: 'ws1', topic: 'discovery call' });
    expect(blocked.ok).toBe(false);
    expect(blocked.paused).toBe(true);
    resumeOutreach('ws1');
  });
});
