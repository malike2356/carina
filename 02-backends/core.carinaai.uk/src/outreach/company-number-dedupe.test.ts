import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { emptyOutreachStore, resetOutreachStoreCache, saveOutreachStore } from './store.js';
import { createDiscoveryLead, ingestDiscoveryLeadRows } from './discovery-funnel.js';

vi.mock('../agents/kanban-service.js', () => ({
  addComment: vi.fn(),
  createBoardCard: vi.fn(),
  patchCard: vi.fn(),
  transitionCard: vi.fn(),
}));

describe('Companies House lead dedupe', () => {
  let tmpHome = '';

  beforeEach(() => {
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'carina-outreach-ch-'));
    vi.stubEnv('CARINA_HOME', tmpHome);
    resetOutreachStoreCache();
    saveOutreachStore(emptyOutreachStore());
  });

  afterEach(() => {
    resetOutreachStoreCache();
    vi.unstubAllEnvs();
  });

  it('dedupes by company number and keeps the first lead as primary', () => {
    const first = createDiscoveryLead('ws-1', {
      name: 'Jane Prospect',
      email: 'jane@example.com',
      company: 'Acme Ltd',
      companyNumber: '00000006',
      source: 'companies_house',
    });
    expect(first.duplicateOf).toBeUndefined();

    const second = ingestDiscoveryLeadRows('ws-1', [
      {
        name: 'John Prospect',
        email: 'john@example.com',
        company: 'Acme Limited',
        companyNumber: '00000006',
        source: 'companies_house',
        notes: 'same company number',
      },
    ]);
    expect(second.created).toHaveLength(0);
    expect(second.duplicates).toHaveLength(1);
  });
});
