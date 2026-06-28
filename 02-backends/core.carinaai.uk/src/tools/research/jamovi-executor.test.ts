import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

vi.mock('node:child_process', () => ({
  execFileSync: vi.fn(),
}));

import { execFileSync } from 'node:child_process';
import { checkJamovi, executeJamoviAnalysis } from './jamovi-executor.js';
import { jamoviAnalyzeTool } from './jamovi-tool.js';

describe('checkJamovi', () => {
  beforeEach(() => {
    vi.mocked(execFileSync).mockReturnValue(
      JSON.stringify({
        running: false,
        url: null,
        datasetCount: 0,
        jmvAvailable: true,
      }),
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('parses python check output', () => {
    const result = checkJamovi();
    expect(result).toEqual({
      running: false,
      url: null,
      datasetCount: 0,
      jmvAvailable: true,
    });
    expect(execFileSync).toHaveBeenCalledWith(
      'python3',
      expect.arrayContaining(['check']),
      expect.any(Object),
    );
  });
});

describe('executeJamoviAnalysis', () => {
  let dataDir = '';

  beforeEach(() => {
    dataDir = mkdtempSync(join(tmpdir(), 'carina-jamovi-test-'));
    vi.mocked(execFileSync).mockImplementation((_cmd, args) => {
      const command = (args as string[])[1];
      if (command === 'check') {
        return JSON.stringify({
          running: false,
          url: null,
          datasetCount: 0,
          jmvAvailable: true,
        });
      }
      return JSON.stringify({
        success: true,
        analysisType: 'descriptive',
        tables: [
          {
            title: 'Descriptives',
            header: ['Variable', 'Mean'],
            rows: [['age', '25.3']],
          },
        ],
        jamovi: { running: false, jmvAvailable: true },
      });
    });
  });

  afterEach(() => {
    rmSync(dataDir, { recursive: true, force: true });
    vi.clearAllMocks();
  });

  it('returns fallback when jmv is unavailable', async () => {
    vi.mocked(execFileSync).mockReturnValue(
      JSON.stringify({
        running: false,
        jmvAvailable: false,
      }),
    );

    const result = await executeJamoviAnalysis({
      dataFile: join(dataDir, 'sample.sav'),
      analysisType: 'descriptive',
      variables: ['age'],
    });

    expect(result).toMatchObject({
      error: expect.stringContaining("jmv"),
      fallback: expect.stringContaining('pspp_analyze'),
    });
  });

  it('returns APA markdown on success', async () => {
    const dataFile = join(dataDir, 'sample.sav');
    writeFileSync(dataFile, 'placeholder', 'utf-8');

    const result = await executeJamoviAnalysis({
      dataFile,
      analysisType: 'descriptive',
      variables: ['age'],
      outputFormat: 'apa',
    });

    expect(result).toMatchObject({
      success: true,
      format: 'apa',
      tableCount: 1,
    });
    expect((result as { markdown: string }).markdown).toContain('Descriptives');
  });
});

describe('jamoviAnalyzeTool', () => {
  it('requires variables', async () => {
    const result = await jamoviAnalyzeTool.execute({
      dataFile: '/tmp/sample.sav',
      analysisType: 'descriptive',
      variables: [],
    });
    expect(result).toEqual({ error: 'variables is required' });
  });
});
