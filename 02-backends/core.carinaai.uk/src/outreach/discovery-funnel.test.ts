import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('outreach discovery funnel helpers', () => {
  let tmpHome: string;

  beforeEach(() => {
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'carina-outreach-discovery-'));
    vi.stubEnv('CARINA_HOME', tmpHome);
    vi.resetModules();
  });

  afterEach(() => {
    fs.rmSync(tmpHome, { recursive: true, force: true });
    vi.unstubAllEnvs();
  });

  it('builds a pilot setup plan with required grants and setup order', async () => {
    const { buildOutreachDiscoveryPilotPlan } = await import('./discovery-funnel.js');
    const plan = buildOutreachDiscoveryPilotPlan({
      workspaceId: 'ws-1',
      ownerEmail: 'owner@example.com',
      sendFromEmail: 'sales@example.com',
    });

    expect(plan.workspaceId).toBe('ws-1');
    expect(plan.requiredGrants.map((item) => item.id)).toEqual(
      expect.arrayContaining([
        'integration:google-workspace',
        'integration:trello',
        'channel:telegram',
        'automation:worker-automation',
      ]),
    );
    expect(plan.optionalGrants.map((item) => item.id)).toContain('integration:companies-house');
    expect(plan.setupOrder[0]).toContain('Google Workspace');
    expect(plan.checklist.length).toBeGreaterThanOrEqual(5);
  });

  it('builds the discovery lead sheet header and append rows', async () => {
    const {
      buildDiscoveryLeadSheetHeader,
      buildDiscoverySheetAppendRows,
      normalizeDiscoveryLeadRow,
    } = await import('./discovery-funnel.js');

    expect(buildDiscoveryLeadSheetHeader()).toEqual(
      expect.arrayContaining(['lead_id', 'business_name', 'contact_name', 'email', 'source', 'status']),
    );

    const normalized = normalizeDiscoveryLeadRow({
      name: 'Jane Doe',
      company: 'Jane Co',
      email: 'jane@example.com',
      source: 'scrape',
      status: 'queued',
      website: 'https://example.com',
      location: 'London',
      notes: 'Warm lead',
      tags: ['seo'],
    });

    expect(normalized?.business_name).toBe('Jane Co');
    expect(normalized?.contact_name).toBe('Jane Doe');
    expect(normalized?.source).toBe('scrape');

    const rows = buildDiscoverySheetAppendRows([normalized!]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toContain('Jane Co');
    expect(rows[0]).toContain('jane@example.com');
  });

  it('ingests lead rows with dedupe and source summary', async () => {
    const { ingestDiscoveryLeadRows } = await import('./discovery-funnel.js');
    const result = ingestDiscoveryLeadRows('ws-1', [
      {
        name: 'Ada Lovelace',
        email: 'ada@example.com',
        company: 'Analytical Engines',
        source: 'manual',
      },
      {
        name: 'A. Lovelace',
        email: 'ada@example.com',
        company: 'Analytical Engines',
        source: 'scrape',
      },
    ]);

    expect(result.rows).toBe(2);
    expect(result.created).toHaveLength(1);
    expect(result.duplicates).toHaveLength(1);
    expect(result.skipped).toBe(0);
    expect(result.sourceSummary.manual).toBe(1);
    expect(result.sourceSummary.scrape).toBe(1);
  });
});
