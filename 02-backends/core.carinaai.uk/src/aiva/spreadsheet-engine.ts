import { randomUUID } from 'node:crypto';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { basename, extname, join, resolve, sep } from 'node:path';
import * as XLSX from 'xlsx';
import { CARINA_DATA_DIR } from '../config/paths.js';

const SUPPORTED_EXTENSIONS = new Set(['.csv', '.tsv', '.xls', '.xlsx', '.ods']);
const MAX_ROWS = 50_000;
const MAX_COLUMNS = 250;

export type SpreadsheetFormat = 'csv' | 'xlsx';

export type SpreadsheetJob = {
  jobId: string;
  workspaceId: string;
  sourceName: string;
  sheetName: string;
  rowCount: number;
  columnCount: number;
  headers: string[];
  canonicalCsvPath: string;
  excelPath: string;
  preview: Array<Record<string, string | number | boolean | null>>;
};

function safeSegment(value: string, fallback: string): string {
  const cleaned = value.trim().replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 100);
  return cleaned || fallback;
}

function workspaceJobRoot(workspaceId: string): string {
  return join(CARINA_DATA_DIR, 'spreadsheet-jobs', safeSegment(workspaceId, 'default'));
}

function assertAllowedSource(sourcePath: string, workspaceId: string): void {
  const source = resolve(sourcePath);
  const workspaceUploadRoot = resolve(CARINA_DATA_DIR, 'aiva-uploads', workspaceId);
  const workspaceSheetRoot = resolve(workspaceJobRoot(workspaceId));
  const within = (root: string) => source === root || source.startsWith(`${root}${sep}`);
  if (!within(workspaceUploadRoot) && !within(workspaceSheetRoot)) {
    throw new Error('Spreadsheet path is outside this Aiva workspace');
  }
}

function normalizeRows(sheet: XLSX.WorkSheet): Array<Record<string, string | number | boolean | null>> {
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: null,
    raw: false,
  });
  if (rows.length > MAX_ROWS) throw new Error(`Spreadsheet exceeds the ${MAX_ROWS} row limit`);
  const headers = rows.length ? Object.keys(rows[0]) : [];
  if (headers.length > MAX_COLUMNS) throw new Error(`Spreadsheet exceeds the ${MAX_COLUMNS} column limit`);
  return rows.map((row) => Object.fromEntries(
    Object.entries(row).map(([key, value]) => [
      key.trim(),
      value === undefined || value === '' ? null : value as string | number | boolean,
    ]),
  ));
}

export async function convertSpreadsheet(input: {
  workspaceId: string;
  sourcePath?: string;
  sourceName?: string;
  rows?: Array<Record<string, unknown>>;
  sheetName?: string;
}): Promise<SpreadsheetJob> {
  if (!input.workspaceId.trim()) throw new Error('workspaceId is required');
  let workbook: XLSX.WorkBook;
  const sourceName = basename(input.sourceName || input.sourcePath || 'spreadsheet.xlsx');

  if (input.rows) {
    if (input.rows.length > MAX_ROWS) throw new Error(`Spreadsheet exceeds the ${MAX_ROWS} row limit`);
    workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(input.rows), input.sheetName || 'Sheet1');
  } else {
    if (!input.sourcePath) throw new Error('sourcePath or rows is required');
    const extension = extname(input.sourcePath).toLowerCase();
    if (!SUPPORTED_EXTENSIONS.has(extension)) throw new Error(`Unsupported spreadsheet type: ${extension}`);
    assertAllowedSource(input.sourcePath, input.workspaceId);
    const sourceStat = await stat(input.sourcePath);
    if (!sourceStat.isFile()) throw new Error('Spreadsheet source is not a file');
    workbook = XLSX.read(await readFile(input.sourcePath), { type: 'buffer', dense: true });
  }

  const sheetName = input.sheetName && workbook.SheetNames.includes(input.sheetName)
    ? input.sheetName
    : workbook.SheetNames[0];
  if (!sheetName) throw new Error('Spreadsheet has no worksheets');
  const rows = normalizeRows(workbook.Sheets[sheetName]);
  const headers = rows.length ? Object.keys(rows[0]) : [];
  const jobId = randomUUID();
  const jobDir = join(workspaceJobRoot(input.workspaceId), jobId);
  await mkdir(jobDir, { recursive: true });

  const outputSheet = XLSX.utils.json_to_sheet(rows, { header: headers });
  const outputBook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(outputBook, outputSheet, safeSegment(sheetName, 'Sheet1').slice(0, 31));
  const canonicalCsvPath = join(jobDir, 'canonical.csv');
  const excelPath = join(jobDir, 'spreadsheet.xlsx');
  await writeFile(canonicalCsvPath, XLSX.utils.sheet_to_csv(outputSheet));
  await writeFile(excelPath, XLSX.write(outputBook, { bookType: 'xlsx', type: 'buffer' }));

  const job: SpreadsheetJob = {
    jobId,
    workspaceId: input.workspaceId,
    sourceName,
    sheetName,
    rowCount: rows.length,
    columnCount: headers.length,
    headers,
    canonicalCsvPath,
    excelPath,
    preview: rows.slice(0, 100) as SpreadsheetJob['preview'],
  };
  await writeFile(join(jobDir, 'job.json'), JSON.stringify(job, null, 2));
  return job;
}

export async function getSpreadsheetJob(workspaceId: string, jobId: string): Promise<SpreadsheetJob> {
  const safeJobId = safeSegment(jobId, 'invalid');
  if (safeJobId !== jobId) throw new Error('Invalid spreadsheet job id');
  const raw = await readFile(join(workspaceJobRoot(workspaceId), safeJobId, 'job.json'), 'utf8');
  const job = JSON.parse(raw) as SpreadsheetJob;
  if (job.workspaceId !== workspaceId) throw new Error('Spreadsheet job workspace mismatch');
  return job;
}

export async function spreadsheetDownloadPath(
  workspaceId: string,
  jobId: string,
  format: SpreadsheetFormat,
): Promise<string> {
  const job = await getSpreadsheetJob(workspaceId, jobId);
  return format === 'csv' ? job.canonicalCsvPath : job.excelPath;
}

export function isSpreadsheetFilename(filename: string): boolean {
  return SUPPORTED_EXTENSIONS.has(extname(filename).toLowerCase());
}
