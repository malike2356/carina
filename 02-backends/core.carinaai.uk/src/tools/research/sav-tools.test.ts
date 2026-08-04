import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

vi.mock('node:child_process', () => ({
  execFileSync: vi.fn(),
}));

import { execFileSync } from 'node:child_process';
import { savReadTool, savWriteTool, spvReadTool } from './sav-tools.js';
import { spssSyntaxGenerateTool } from './spss-syntax-tool.js';

describe('sav_read tool', () => {
  beforeEach(() => {
    vi.mocked(execFileSync).mockImplementation((_cmd, args) => {
      const command = (args as string[])[1];
      if (command === 'deps') {
        return JSON.stringify({ pyreadstat: true, pandas: true });
      }
      return JSON.stringify({
        file: '/data/sample.sav',
        rows: 2,
        columns: 1,
        variables: [{ name: 'age', type: 'float64', label: 'Age' }],
        data: [{ age: 25 }],
        data_row_count: 1,
      });
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns markdown preview on success', async () => {
    const result = await savReadTool.execute({ file: '/data/sample.sav', maxRows: 10 });
    expect(result).toMatchObject({
      success: true,
      rows: 2,
    });
    expect((result as { markdown: string }).markdown).toContain('Age');
  });

  it('reports missing pyreadstat dependency', async () => {
    vi.mocked(execFileSync).mockReturnValue(JSON.stringify({ pyreadstat: false, pandas: false }));
    const result = await savReadTool.execute({ file: '/data/sample.sav' });
    expect(result).toMatchObject({
      error: expect.stringContaining('pyreadstat'),
    });
  });
});

describe('sav_write tool', () => {
  beforeEach(() => {
    vi.mocked(execFileSync).mockImplementation((_cmd, args) => {
      const command = (args as string[])[1];
      if (command === 'deps') {
        return JSON.stringify({ pyreadstat: true, pandas: true });
      }
      return JSON.stringify({ success: true, file: '/data/out.sav', rows: 1, columns: 1 });
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('requires non-empty data', async () => {
    const result = await savWriteTool.execute({ file: '/data/out.sav', data: [] });
    expect(result).toEqual({ error: 'data must be a non-empty array of row objects' });
  });
});

describe('spv_read tool', () => {
  beforeEach(() => {
    vi.mocked(execFileSync).mockReturnValue(
      JSON.stringify({
        file: '/data/output.spv',
        tables: [{ title: 'Results', rows: [['x', '1']] }],
        text: ['Done'],
      }),
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns parsed spv markdown', async () => {
    const result = await spvReadTool.execute({ file: '/data/output.spv' });
    expect(result).toMatchObject({ success: true });
    expect((result as { markdown: string }).markdown).toContain('Results');
  });
});

describe('spss_syntax_generate tool', () => {
  let workDir = '';

  beforeEach(() => {
    workDir = mkdtempSync(join(tmpdir(), 'carina-syntax-test-'));
  });

  afterEach(() => {
    rmSync(workDir, { recursive: true, force: true });
  });

  it('writes syntax to disk', async () => {
    const outputPath = join(workDir, 'analysis.sps');
    const result = await spssSyntaxGenerateTool.execute({
      dataFile: '/data/sample.sav',
      analysisType: 'descriptive',
      variables: ['age', 'income'],
      outputPath,
    });

    expect(result).toMatchObject({
      success: true,
      file: outputPath,
      analysisType: 'descriptive',
    });
    const syntax = readFileSync(outputPath, 'utf-8');
    expect(syntax).toContain("GET FILE='/data/sample.sav'.");
    expect(syntax).toContain('DESCRIPTIVES VARIABLES=age income');
  });
});
