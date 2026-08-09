import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { mapRowAliases, REFERENCE_WORKBOOK_COLUMNS, resolveCanonicalField } from './lead-aliases.js';
import { findDuplicateLeadId, normalizeWebsite } from './dedupe.js';
import { ingestLeads } from './lead-ingest.js';
import { resetOutreachStoreCache, outreachStoreDir } from './store.js';

describe('lead aliases', () => {
  it('maps all 17 reference workbook columns', () => {
    const headers = [
      'Company',
      'Niche',
      'Town/City',
      'Website',
      'Contact Name',
      'Email',
      'Phone',
      'Google Reviews',
      'Google Rating',
      'Google Maps URL',
      'Website Score (1-10)',
      'Ranks Top3?',
      'Weakness',
      'Priority',
      'Status',
      'Date Added',
      'Notes',
    ];
    const mapped = headers.map((h) => resolveCanonicalField(h));
    expect(mapped.filter(Boolean)).toHaveLength(17);
    for (const col of REFERENCE_WORKBOOK_COLUMNS) {
      expect(mapped).toContain(col);
    }
  });

  it('preserves unknown columns in customFields', () => {
    const { canonical, customFields } = mapRowAliases({
      Company: 'Acme Bakery',
      Email: 'hello@acme.test',
      'Extra Column': 'keep-me',
    });
    expect(canonical.company).toBe('Acme Bakery');
    expect(canonical.email).toBe('hello@acme.test');
    expect(customFields['Extra Column']).toBe('keep-me');
  });
});

describe('lead dedupe', () => {
  it('matches email then phone then website+company+location', () => {
    const existing = [
      { id: '1', email: 'a@test.com' },
      { id: '2', phone: '+44 7700 900123' },
      { id: '3', website: 'https://www.cafe.example/', company: 'Cafe', townCity: 'Portsmouth' },
    ];
    expect(findDuplicateLeadId(existing, { email: 'A@TEST.com' })).toBe('1');
    expect(findDuplicateLeadId(existing, { phone: '00447700900123' })).toBe('2');
    expect(findDuplicateLeadId(existing, {
      website: 'cafe.example',
      company: 'Cafe',
      townCity: 'Portsmouth',
    })).toBe('3');
    expect(normalizeWebsite('https://WWW.Cafe.Example/path')).toBe('cafe.example');
  });
});

describe('lead ingest', () => {
  const prevHome = process.env.CARINA_HOME;
  let tmp: string;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'carina-lead-ingest-'));
    process.env.CARINA_HOME = tmp;
    resetOutreachStoreCache();
  });

  afterEach(() => {
    process.env.CARINA_HOME = prevHome;
    resetOutreachStoreCache();
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('imports workbook-shaped rows with provenance and dedupes', () => {
    const ws = 'ws-ingest-1';
    const first = ingestLeads({
      workspaceId: ws,
      sourceType: 'upload',
      sourceName: 'SEO_Lead_Tracker_Template.xlsx',
      kind: 'import',
      rows: [{
        Company: 'Harbour Fish',
        Niche: 'Hospitality',
        'Town/City': 'Portsmouth',
        Website: 'https://harbourfish.example',
        'Contact Name': 'Sam Pike',
        Email: 'sam@harbourfish.example',
        Phone: '023 0000 1111',
        'Google Reviews': '42',
        'Google Rating': '4.6',
        'Google Maps URL': 'https://maps.example/harbour',
        'Website Score (1-10)': '6',
        'Ranks Top3?': 'No',
        Weakness: 'Slow mobile',
        Priority: 'High',
        Status: 'new',
        'Date Added': '2026-08-01',
        Notes: 'Good fit',
        Mystery: 'keep',
      }],
    });
    expect(first.created).toBe(1);
    expect(first.rejected).toBe(0);
    const lead = first.leads[0]!;
    expect(lead.workspaceId).toBe(ws);
    expect(lead.company).toBe('Harbour Fish');
    expect(lead.contactName).toBe('Sam Pike');
    expect(lead.townCity).toBe('Portsmouth');
    expect(lead.website).toBe('harbourfish.example');
    expect(lead.googleReviews).toBe(42);
    expect(lead.googleRating).toBe(4.6);
    expect(lead.websiteScore).toBe(6);
    expect(lead.sourceType).toBe('upload');
    expect(lead.sourceName).toContain('SEO_Lead');
    expect(lead.customFields?.Mystery).toBe('keep');
    expect(first.jobId).toBeTruthy();

    const second = ingestLeads({
      workspaceId: ws,
      sourceType: 'upload',
      overwrite: false,
      rows: [{
        Company: 'Harbour Fish',
        Email: 'sam@harbourfish.example',
        Weakness: 'Should not overwrite',
        Phone: '023 9999 0000',
      }],
    });
    expect(second.created).toBe(0);
    expect(second.updated + second.duplicate).toBeGreaterThan(0);
    const merged = second.leads[0]!;
    expect(merged.weakness).toBe('Slow mobile');
    expect(merged.phone).toBeTruthy();
  });

  it('isolates workspaces', () => {
    ingestLeads({
      workspaceId: 'ws-a',
      rows: [{ Company: 'A Co', Email: 'shared@x.test', 'Contact Name': 'A' }],
    });
    ingestLeads({
      workspaceId: 'ws-b',
      rows: [{ Company: 'B Co', Email: 'shared@x.test', 'Contact Name': 'B' }],
    });
    const a = ingestLeads({
      workspaceId: 'ws-a',
      rows: [{ Email: 'shared@x.test', Company: 'A Co 2' }],
    });
    expect(a.created).toBe(0);
    expect(a.leads[0]?.workspaceId).toBe('ws-a');
    expect(a.leads[0]?.company).toBe('A Co');
    void outreachStoreDir;
  });
});
