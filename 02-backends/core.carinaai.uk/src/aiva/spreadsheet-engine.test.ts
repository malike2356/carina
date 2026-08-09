import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { CARINA_DATA_DIR } from '../config/paths.js';
import { convertSpreadsheet, getSpreadsheetJob, spreadsheetDownloadPath } from './spreadsheet-engine.js';

describe('Aiva spreadsheet engine', () => {
  it('converts tenant-scoped CSV into canonical CSV and Excel', async () => {
    const workspaceId = `sheet-test-${Date.now()}`;
    const uploadDir = join(CARINA_DATA_DIR, 'aiva-uploads', workspaceId, 'worker-1');
    await mkdir(uploadDir, { recursive: true });
    const sourcePath = join(uploadDir, 'leads.csv');
    await writeFile(sourcePath, 'name,email\nAcme,hello@example.com\n');

    const job = await convertSpreadsheet({ workspaceId, sourcePath });

    expect(job.rowCount).toBe(1);
    expect(job.headers).toEqual(['name', 'email']);
    expect(await spreadsheetDownloadPath(workspaceId, job.jobId, 'csv')).toBe(job.canonicalCsvPath);
    expect(XLSX.readFile(job.excelPath).SheetNames).toEqual(['Sheet1']);
    expect((await getSpreadsheetJob(workspaceId, job.jobId)).workspaceId).toBe(workspaceId);
  });

  it('accepts rows returned by a connected Google Sheet', async () => {
    const job = await convertSpreadsheet({
      workspaceId: `google-sheet-test-${Date.now()}`,
      sourceName: 'Google leads',
      rows: [{ company: 'Acme', source: 'google_sheet' }],
    });
    expect(job.preview[0]).toMatchObject({ company: 'Acme', source: 'google_sheet' });
  });

  it('rejects paths outside Carina data', async () => {
    await expect(convertSpreadsheet({ workspaceId: 'ws', sourcePath: '/tmp/leads.csv' }))
      .rejects.toThrow('outside this Aiva workspace');
  });

  it('rejects another workspace upload path', async () => {
    const uploadDir = join(CARINA_DATA_DIR, 'aiva-uploads', 'workspace-a', 'worker-1');
    await mkdir(uploadDir, { recursive: true });
    const sourcePath = join(uploadDir, 'private.csv');
    await writeFile(sourcePath, 'name\nPrivate lead\n');
    await expect(convertSpreadsheet({ workspaceId: 'workspace-b', sourcePath }))
      .rejects.toThrow('outside this Aiva workspace');
  });
});
