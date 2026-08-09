import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('CRM lead views + bulk + keyset helpers', () => {
  let tmpHome: string;

  beforeEach(() => {
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'crm-grid-'));
    vi.stubEnv('CARINA_HOME', tmpHome);
    vi.stubEnv('CARINA_OUTREACH_PERSISTENCE', 'json');
    vi.stubEnv('DATABASE_URL', '');
    vi.resetModules();
  });

  afterEach(() => {
    fs.rmSync(tmpHome, { recursive: true, force: true });
    vi.unstubAllEnvs();
  });

  it('persists column prefs and isolates views by owner', async () => {
    const {
      createLeadView,
      listLeadViews,
      upsertGridPrefs,
      getGridPrefs,
      deleteLeadView,
      GRID_PREFS_VIEW_NAME,
    } = await import('./lead-views.js');
    const ws = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    const view = createLeadView({
      workspaceId: ws,
      name: 'Hot leads',
      ownerUserId: 'user-a',
      filters: { status: 'ready' },
      hiddenColumns: ['weakness'],
      density: 'comfortable',
      shared: false,
    });
    expect(view.id).toBeTruthy();
    expect(listLeadViews(ws, 'user-a').some((v) => v.id === view.id)).toBe(true);
    expect(listLeadViews(ws, 'user-b').some((v) => v.id === view.id)).toBe(false);

    const shared = createLeadView({
      workspaceId: ws,
      name: 'Shared pipeline',
      ownerUserId: 'user-a',
      shared: true,
      sharedWith: ['*'],
      filters: { status: 'contacted' },
    });
    expect(listLeadViews(ws, 'user-b').some((v) => v.id === shared.id)).toBe(true);

    const prefs = upsertGridPrefs({
      workspaceId: ws,
      ownerUserId: 'user-a',
      columnOrder: ['company', 'contactName', 'email'],
      columnWidths: { company: 200 },
      density: 'spacious',
    });
    expect(prefs.name).toBe(GRID_PREFS_VIEW_NAME);
    expect(getGridPrefs(ws, 'user-a')?.columnWidths?.company).toBe(200);
    expect(getGridPrefs(ws, 'user-b')).toBeNull();

    expect(deleteLeadView(ws, view.id, 'user-b')).toBe(false);
    expect(deleteLeadView(ws, view.id, 'user-a')).toBe(true);
  });

  it('bulk stage / archive / list assignment', async () => {
    const { createLead, createLeadList } = await import('./leads.js');
    const { applyBulkLeadAction } = await import('./bulk-leads.js');
    const ws = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    const a = createLead({ workspaceId: ws, name: 'Ada', email: 'ada@example.com', company: 'Analytical', source: 'manual' });
    const b = createLead({ workspaceId: ws, name: 'Bob', email: 'bob@example.com', company: 'Builders', source: 'manual' });
    const list = createLeadList({ workspaceId: ws, name: 'Q3' });

    const staged = await applyBulkLeadAction({
      workspaceId: ws,
      leadIds: [a.lead.id, b.lead.id],
      action: 'stage',
      status: 'contacted',
    });
    expect(staged.updated).toBe(2);
    expect(staged.leads.every((l) => l.status === 'contacted')).toBe(true);

    const listed = await applyBulkLeadAction({
      workspaceId: ws,
      leadIds: [a.lead.id],
      action: 'list_add',
      listId: list.id,
    });
    expect(listed.updated).toBe(1);
    expect(listed.leads[0]?.listIds?.includes(list.id)).toBe(true);

    const archived = await applyBulkLeadAction({
      workspaceId: ws,
      leadIds: [b.lead.id],
      action: 'archive',
    });
    expect(archived.leads[0]?.archivedAt).toBeTruthy();
  });

  it('workbook export respects selection filter', async () => {
    const { createLead } = await import('./leads.js');
    const { exportCrmWorkbookCsv } = await import('./lead-sheets.js');
    const ws = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    const a = createLead({ workspaceId: ws, name: 'Ada', company: 'A Co', source: 'manual' });
    createLead({ workspaceId: ws, name: 'Bob', company: 'B Co', source: 'manual' });
    const all = exportCrmWorkbookCsv(ws);
    expect(all.count).toBeGreaterThanOrEqual(2);
    const selected = exportCrmWorkbookCsv(ws, { leadIds: [a.lead.id] });
    expect(selected.count).toBe(1);
    expect(selected.csv).toContain('A Co');
    expect(selected.csv).not.toContain('B Co');
  });
});
