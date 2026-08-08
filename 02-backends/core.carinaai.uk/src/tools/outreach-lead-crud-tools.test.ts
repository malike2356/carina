import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createLead, deleteLead, listLeads, updateLead } from '../outreach/leads.js';
import { resetOutreachStoreCache } from '../outreach/store.js';
import { createOutreachLeadCrudTools } from './outreach-lead-crud-tools.js';
import { clearWorkerSessionContext, setWorkerSessionContext } from '../workers/worker-session-context.js';

describe('outreach lead CRUD tools', () => {
  let prevHome: string | undefined;
  let tmpHome: string;

  beforeEach(() => {
    prevHome = process.env.CARINA_HOME;
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'aiva-lead-crud-'));
    process.env.CARINA_HOME = tmpHome;
    resetOutreachStoreCache();
    setWorkerSessionContext('sess-test', {
      worker: { id: 'worker-1', workspaceId: 'ws1' } as import('../types/index.js').Worker,
      personaPrompt: 'Test worker',
    });
  });

  afterEach(() => {
    if (prevHome === undefined) delete process.env.CARINA_HOME;
    else process.env.CARINA_HOME = prevHome;
    resetOutreachStoreCache();
    clearWorkerSessionContext('sess-test');
    fs.rmSync(tmpHome, { recursive: true, force: true });
  });

  it('creates lists updates and deletes leads via store helpers', () => {
    const { lead } = createLead({
      workspaceId: 'ws1',
      name: 'Ada',
      email: 'ada@example.com',
      company: 'Analytical',
    });
    expect(listLeads('ws1')).toHaveLength(1);
    const updated = updateLead('ws1', lead.id, { status: 'contacted' });
    expect(updated?.status).toBe('contacted');
    expect(deleteLead('ws1', lead.id)).toBe(true);
    expect(listLeads('ws1')).toHaveLength(0);
  });

  it('exposes outreach-leads-* tools', async () => {
    const tools = createOutreachLeadCrudTools('sess-test');
    expect(tools.map((t) => t.name)).toEqual([
      'outreach-leads-list',
      'outreach-leads-get',
      'outreach-leads-create',
      'outreach-leads-update',
      'outreach-leads-delete',
      'outreach-leads-import',
    ]);
    const create = tools.find((t) => t.name === 'outreach-leads-create')!;
    const result = await create.execute({
      workspaceId: 'ws1',
      name: 'Grace',
      email: 'grace@example.com',
    });
    expect(result).toMatchObject({ ok: true });
    const list = tools.find((t) => t.name === 'outreach-leads-list')!;
    const listed = await list.execute({ workspaceId: 'ws1' });
    expect(listed).toMatchObject({ ok: true });
    expect((listed as { data: { total: number } }).data.total).toBe(1);
  });

  it('rejects an explicit workspace outside the authenticated worker scope', async () => {
    createLead({ workspaceId: 'ws2', name: 'Private lead', email: 'private@example.com' });
    const list = createOutreachLeadCrudTools('sess-test').find((tool) => tool.name === 'outreach-leads-list')!;
    const result = await list.execute({ workspaceId: 'ws2' });
    expect(result).toMatchObject({ ok: false });
    expect(listLeads('ws2')).toHaveLength(1);
  });
});
