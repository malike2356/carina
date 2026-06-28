import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

vi.mock('./r-check.js', () => ({
  checkR: vi.fn(),
}));

vi.mock('node:child_process', () => ({
  execFileSync: vi.fn(),
}));

import { checkR } from './r-check.js';
import { execFileSync } from 'node:child_process';
import { executeRAnalysis, parseRParams } from './r-executor.js';
import { rAnalyzeTool } from './r-tool.js';

describe('parseRParams', () => {
  it('parses required fields', () => {
    const params = parseRParams({
      dataFile: '/tmp/data.sav',
      analysisType: 'ttest',
      variables: ['score'],
      groupBy: 'group',
    });
    expect(params.analysisType).toBe('ttest');
    expect(params.variables).toEqual(['score']);
    expect(params.outputFormat).toBe('apa');
  });

  it('rejects invalid analysis type', () => {
    expect(() =>
      parseRParams({
        dataFile: '/tmp/data.sav',
        analysisType: 'invalid',
        variables: ['score'],
      }),
    ).toThrow(/analysisType must be one of/);
  });
});

describe('executeRAnalysis', () => {
  let dataDir = '';

  beforeEach(() => {
    dataDir = mkdtempSync(join(tmpdir(), 'carina-r-test-'));
    vi.mocked(checkR).mockReturnValue({
      installed: true,
      version: '4.3.2',
      packages: { haven: true, dplyr: true, broom: true, jsonlite: true, psych: true },
    });
  });

  afterEach(() => {
    rmSync(dataDir, { recursive: true, force: true });
    vi.clearAllMocks();
  });

  it('returns fallback when R is not installed', async () => {
    vi.mocked(checkR).mockReturnValue({
      installed: false,
      error: 'Rscript not found',
    });

    const result = await executeRAnalysis({
      dataFile: join(dataDir, 'sample.csv'),
      analysisType: 'descriptive',
      variables: ['score'],
    });

    expect(result).toMatchObject({
      error: expect.stringContaining('R is not installed'),
      fallback: expect.stringContaining('stats_describe'),
    });
  });

  it('returns error when data file is missing', async () => {
    const result = await executeRAnalysis({
      dataFile: join(dataDir, 'missing.sav'),
      analysisType: 'descriptive',
      variables: ['score'],
    });

    expect(result).toEqual({
      error: expect.stringContaining('Data file not found'),
    });
  });

  it('runs Rscript and returns APA markdown', async () => {
    const dataFile = join(dataDir, 'sample.csv');
    writeFileSync(dataFile, 'group,score\nA,1\nB,2\n', 'utf-8');

    vi.mocked(execFileSync).mockReturnValue(
      JSON.stringify({
        success: true,
        analysisType: 'descriptive',
        tables: [
          {
            title: 'Descriptives',
            header: ['vars', 'n', 'mean'],
            rows: [['score', '2', '1.5']],
          },
        ],
      }),
    );

    const result = await executeRAnalysis({
      dataFile,
      analysisType: 'descriptive',
      variables: ['score'],
      outputFormat: 'apa',
    });

    expect(result).toMatchObject({
      success: true,
      format: 'apa',
      markdown: expect.stringContaining('Descriptives'),
      tableCount: 1,
    });
    expect(execFileSync).toHaveBeenCalledWith(
      'Rscript',
      expect.arrayContaining([expect.stringContaining('r-analyze.R')]),
      expect.any(Object),
    );
  });
});

describe('rAnalyzeTool', () => {
  it('exposes r_analyze name', () => {
    expect(rAnalyzeTool.name).toBe('r_analyze');
  });
});
