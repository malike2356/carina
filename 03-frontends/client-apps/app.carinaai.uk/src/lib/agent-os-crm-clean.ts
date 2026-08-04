export type CleanCrmRow = Record<string, string>;

export type CleanCrmResult = {
  rows: CleanCrmRow[];
  columns: string[];
  removedDuplicates: number;
  errors: string[];
};

const EMAIL_KEYS = ['email', 'e-mail', 'mail'];
const NAME_KEYS = ['name', 'full name', 'fullname', 'contact'];

function normalizeHeader(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, ' ');
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === ',' && !inQuotes) {
      cells.push(current.trim());
      current = '';
      continue;
    }
    current += ch;
  }
  cells.push(current.trim());
  return cells;
}

export function cleanCrmCsv(text: string): CleanCrmResult {
  const errors: string[] = [];
  const lines = text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return {
      rows: [],
      columns: [],
      removedDuplicates: 0,
      errors: ['File needs a header row and at least one data row.'],
    };
  }

  const headers = parseCsvLine(lines[0]).map(normalizeHeader);
  if (!headers.some((h) => EMAIL_KEYS.includes(h) || NAME_KEYS.includes(h))) {
    errors.push('Add an email or name column so rows can be identified.');
  }

  const emailIdx = headers.findIndex((h) => EMAIL_KEYS.includes(h));
  const seen = new Set<string>();
  const rows: CleanCrmRow[] = [];
  let removedDuplicates = 0;

  for (let i = 1; i < lines.length; i += 1) {
    const cells = parseCsvLine(lines[i]);
    if (cells.every((c) => !c)) continue;
    const row: CleanCrmRow = {};
    headers.forEach((header, index) => {
      row[header] = (cells[index] ?? '').trim();
    });
    const key =
      emailIdx >= 0
        ? row[headers[emailIdx]]?.toLowerCase()
        : JSON.stringify(Object.values(row).map((v) => v.toLowerCase()));
    if (!key) {
      errors.push(`Row ${i + 1} is missing an identity value.`);
      continue;
    }
    if (seen.has(key)) {
      removedDuplicates += 1;
      continue;
    }
    seen.add(key);
    rows.push(row);
  }

  if (!rows.length && !errors.length) {
    errors.push('No usable rows after cleaning.');
  }

  return { rows, columns: headers, removedDuplicates, errors };
}

export function rowsToCsv(columns: string[], rows: CleanCrmRow[]): string {
  const escape = (value: string) => {
    if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
    return value;
  };
  const lines = [columns.join(',')];
  for (const row of rows) {
    lines.push(columns.map((col) => escape(row[col] ?? '')).join(','));
  }
  return `${lines.join('\n')}\n`;
}
