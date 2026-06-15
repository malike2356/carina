import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import type { DeepResearchReport } from '../agents/deep-research.js';
import {
  getResearchReport,
  listResearchReports,
  saveResearchReport,
  updateResearchReport,
} from './research-store.js';

function sampleReport(): DeepResearchReport {
  return {
    title: 'Test Research',
    summary: 'A short summary.',
    sections: [
      { heading: 'Overview', body: 'Body [src-1]', sourceCitations: ['src-1'] },
      { heading: 'Detail', body: 'More [src-2]', sourceCitations: ['src-2'] },
      { heading: 'Impact', body: 'Impact [src-3]', sourceCitations: ['src-3'] },
    ],
    sources: [
      { id: 'src-1', title: 'A', url: 'https://example.com/a', snippet: 'a', fetchedAt: '2026-01-01T00:00:00Z', verified: true },
      { id: 'src-2', title: 'B', url: 'https://example.com/b', snippet: 'b', fetchedAt: '2026-01-01T00:00:00Z', verified: true },
      { id: 'src-3', title: 'C', url: 'https://example.com/c', snippet: 'c', fetchedAt: '2026-01-01T00:00:00Z', verified: true },
    ],
    searchQueries: ['q1'],
    roundCount: 3,
    generatedAt: '2026-01-01T00:00:00Z',
  };
}

describe('research-store', () => {
  let tmpHome = '';

  beforeEach(async () => {
    tmpHome = await fs.mkdtemp(path.join(os.tmpdir(), 'carina-research-'));
    process.env.CARINA_HOME = tmpHome;
  });

  afterEach(async () => {
    delete process.env.CARINA_HOME;
    await fs.rm(tmpHome, { recursive: true, force: true });
  });

  it('persists and lists research reports', async () => {
    const meta = await saveResearchReport(sampleReport(), { query: 'test topic' });
    const listed = await listResearchReports();
    expect(listed.some((r) => r.id === meta.id)).toBe(true);
    expect(meta.shareId).toHaveLength(12);
  });

  it('loads report by id and supports edit', async () => {
    const meta = await saveResearchReport(sampleReport(), { query: 'edit topic' });
    const loaded = await getResearchReport(meta.id);
    expect(loaded?.markdown).toContain('# Test Research');
    expect(loaded?.markdown).toContain('## Source Provenance');

    const updated = await updateResearchReport(meta.id, {
      title: 'Edited Title',
      markdown: '# Edited Title\n\nUpdated body.',
    });
    expect(updated?.title).toBe('Edited Title');

    const reloaded = await getResearchReport(meta.id);
    expect(reloaded?.markdown).toContain('Updated body.');
  });
});
