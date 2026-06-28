import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

vi.mock('./pspp-check.js', () => ({
  checkPspp: vi.fn(),
}));

vi.mock('node:child_process', () => ({
  execFileSync: vi.fn(),
}));

import { checkPspp } from './pspp-check.js';
import { execFileSync } from 'node:child_process';
import { executePsppAnalysis } from './pspp-executor.js';
import { psppAnalyzeTool } from './pspp-tool.js';

describe('executePsppAnalysis', () => {
  let dataDir = '';

  beforeEach(() => {
    dataDir = mkdtempSync(join(tmpdir(), 'carina-pspp-test-'));
    vi.mocked(checkPspp).mockReturnValue({ installed: true, version: '2.0', path: '/usr/bin/pspp' });
  });

  afterEach(() => {
    rmSync(dataDir, { recursive: true, force: true });
    vi.clearAllMocks();
  });

  it('returns fallback guidance when PSPP is not installed', async () => {
    vi.mocked(checkPspp).mockReturnValue({
      installed: false,
      error: 'PSPP not installed. Run: sudo apt install pspp',
    });

    const result = await executePsppAnalysis({
      dataFile: '/tmp/missing.sav',
      analysisType: 'descriptive',
      variables: ['age'],
    });

    expect(result).toMatchObject({
      installed: false,
      error: expect.stringContaining('PSPP not installed'),
      fallback: expect.stringContaining('stats_describe'),
    });
  });

  it('returns error when data file is missing', async () => {
    const result = await executePsppAnalysis({
      dataFile: join(dataDir, 'missing.sav'),
      analysisType: 'descriptive',
      variables: ['age'],
    });

    expect(result).toEqual({
      error: expect.stringContaining('Data file not found'),
    });
  });

  it('runs PSPP and returns APA markdown', async () => {
    const dataFile = join(dataDir, 'sample.sav');
    writeFileSync(dataFile, 'placeholder', 'utf-8');

    vi.mocked(execFileSync).mockImplementation((_cmd, _args, options) => {
      const cwd = (options as { cwd?: string })?.cwd ?? dataDir;
      writeFileSync(
        join(cwd, 'output.txt'),
        `
==============================
Group Statistics
==============================
Group    N    Mean
1        10   3.2
2        12   4.1
==============================
`,
        'utf-8',
      );
      return '';
    });

    const result = await executePsppAnalysis({
      dataFile,
      analysisType: 'ttest',
      variables: ['score'],
      groupBy: 'group',
      outputFormat: 'apa',
    });

    expect(execFileSync).toHaveBeenCalledWith(
      'pspp',
      expect.arrayContaining(['-o', expect.stringContaining('output.txt')]),
      expect.objectContaining({ cwd: expect.any(String) }),
    );
    expect(result).toMatchObject({
      success: true,
      format: 'apa',
      tableCount: 1,
    });
    expect((result as { markdown: string }).markdown).toContain('Group Statistics');
  });
});

describe('psppAnalyzeTool', () => {
  it('rejects invalid analysis types', async () => {
    const result = await psppAnalyzeTool.execute({
      dataFile: '/tmp/sample.sav',
      analysisType: 'invalid',
    });
    expect(result).toEqual({ error: expect.stringContaining('analysisType must be one of') });
  });
});
