import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

vi.mock('node:child_process', () => ({
  execFileSync: vi.fn(),
}));

import { execFileSync } from 'node:child_process';
import { statsDescribeTool } from './stats-tools.js';

describe('stats_describe tool', () => {
  let dataDir = '';

  beforeEach(() => {
    dataDir = mkdtempSync(join(tmpdir(), 'carina-stats-test-'));
    writeFileSync(join(dataDir, 'sample.csv'), 'age\n25\n', 'utf-8');
    vi.mocked(execFileSync).mockImplementation((_cmd, args) => {
      const command = (args as string[])[1];
      if (command === 'deps') {
        return JSON.stringify({
          numpy: true,
          pandas: true,
          scipy: true,
          statsmodels: true,
          pyreadstat: false,
        });
      }
      return JSON.stringify({
        analysis: 'descriptive',
        results: [{ variable: 'age', mean: 25.3, std: 4.1, n: 10 }],
      });
    });
  });

  afterEach(() => {
    rmSync(dataDir, { recursive: true, force: true });
    vi.clearAllMocks();
  });

  it('returns APA markdown on success', async () => {
    const result = await statsDescribeTool.execute({
      dataFile: join(dataDir, 'sample.csv'),
      variables: ['age'],
    });
    expect(result).toMatchObject({ success: true, analysis: 'descriptive' });
    expect((result as { markdown: string }).markdown).toContain('age');
  });

  it('reports missing python stack', async () => {
    vi.mocked(execFileSync).mockReturnValue(
      JSON.stringify({ numpy: false, pandas: false, scipy: false, statsmodels: false }),
    );
    const result = await statsDescribeTool.execute({
      dataFile: join(dataDir, 'sample.csv'),
      variables: ['age'],
    });
    expect(result).toMatchObject({ error: expect.stringContaining('Python stats stack missing') });
  });
});
