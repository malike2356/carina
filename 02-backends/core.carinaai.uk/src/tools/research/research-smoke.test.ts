import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkPspp } from './pspp-check.js';
import { checkR } from './r-check.js';
import { checkJamovi } from './jamovi-executor.js';
import { checkSavDependencies, readSavFile, writeSavFile } from './sav-executor.js';
import { checkStatsDependencies, runStatsAnalysis } from './stats-executor.js';
import { executePsppAnalysis } from './pspp-executor.js';
import { executeRAnalysis } from './r-executor.js';
import { executeJamoviAnalysis } from './jamovi-executor.js';

const FIXTURE_DIR = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');
const SAMPLE_CSV = join(FIXTURE_DIR, 'sample.csv');

function loadFixtureRows(): Array<Record<string, unknown>> {
  const lines = readFileSync(SAMPLE_CSV, 'utf-8').trim().split('\n');
  const headers = lines[0].split(',');
  return lines.slice(1).map((line) => {
    const values = line.split(',');
    const row: Record<string, unknown> = {};
    headers.forEach((header, index) => {
      const raw = values[index] ?? '';
      row[header] = header === 'id' || header === 'age' ? Number(raw) : raw;
    });
    return row;
  });
}

function resolveDataFile(): string {
  const deps = checkSavDependencies();
  if (!deps.pyreadstat) {
    return SAMPLE_CSV;
  }

  const savPath = join(FIXTURE_DIR, 'sample.sav');
  if (!existsSync(savPath)) {
    const written = writeSavFile({ file: savPath, data: loadFixtureRows() });
    if (written.error) {
      return SAMPLE_CSV;
    }
  }
  return existsSync(savPath) ? savPath : SAMPLE_CSV;
}

describe('research live smoke (optional host deps)', () => {
  it('fixture CSV exists', () => {
    expect(existsSync(SAMPLE_CSV)).toBe(true);
  });

  it('Python stats stack can describe fixture data', () => {
    const deps = checkStatsDependencies();
    if (!deps.pandas || !deps.scipy || !deps.statsmodels) {
      return;
    }

    const result = runStatsAnalysis({
      analysis: 'descriptive',
      file: SAMPLE_CSV,
      variables: ['score', 'age'],
    });
    expect(result.error).toBeUndefined();
    expect(Array.isArray(result.results)).toBe(true);
    expect((result.results as unknown[]).length).toBeGreaterThan(0);
  });

  it('Python non-parametric and logistic extensions run when stack is present', () => {
    const deps = checkStatsDependencies();
    if (!deps.pandas || !deps.scipy || !deps.statsmodels) {
      return;
    }

    const mannWhitney = runStatsAnalysis({
      analysis: 'mann_whitney',
      file: SAMPLE_CSV,
      variables: ['score'],
      groupBy: 'group',
    });
    expect(mannWhitney.error).toBeUndefined();

    const kruskal = runStatsAnalysis({
      analysis: 'kruskal_wallis',
      file: SAMPLE_CSV,
      variables: ['score'],
      groupBy: 'group',
    });
    expect(kruskal.error).toBeUndefined();
  });

  it('sav_read works on .sav when pyreadstat is installed', () => {
    const deps = checkSavDependencies();
    if (!deps.pyreadstat) {
      return;
    }

    const dataFile = resolveDataFile();
    if (!dataFile.endsWith('.sav')) {
      return;
    }

    const payload = readSavFile({ file: dataFile });
    expect(payload.error).toBeUndefined();
    expect((payload.rows ?? 0) > 0).toBe(true);
    expect((payload.columns ?? 0) > 0).toBe(true);
  });

  it('PSPP pipeline runs when pspp is installed', async () => {
    const pspp = checkPspp();
    if (!pspp.installed) {
      return;
    }

    const dataFile = resolveDataFile();
    const result = await executePsppAnalysis({
      dataFile,
      analysisType: 'descriptive',
      variables: ['score'],
      outputFormat: 'apa',
    });
    expect(result).toMatchObject({ success: true });
  });

  it('R pipeline runs when R and packages are installed', async () => {
    const r = checkR(['psych']);
    if (!r.installed) {
      return;
    }
    const missing = Object.entries(r.packages ?? {}).filter(([, ok]) => !ok).map(([name]) => name);
    if (missing.length > 0) {
      return;
    }

    const dataFile = resolveDataFile();
    const result = await executeRAnalysis({
      dataFile,
      analysisType: 'descriptive',
      variables: ['score'],
      outputFormat: 'apa',
    });
    expect(result).toMatchObject({ success: true });
  });

  it('Jamovi connectivity check passes when Jamovi is running', async () => {
    const jamovi = checkJamovi();
    if (!jamovi.running) {
      return;
    }

    const dataFile = resolveDataFile();
    const result = await executeJamoviAnalysis({
      dataFile,
      analysisType: 'descriptive',
      variables: ['score'],
      outputFormat: 'apa',
    });
    expect(result).toMatchObject({ success: true });
  });
});
