import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import os from 'os';
import type { ContactProfile } from '../profiles/contacts.js';

export interface CsvImportResult {
  imported: number;
  skipped: number;
  errors: string[];
}

const COLUMN_ALIASES: Record<string, keyof ContactProfile> = {
  name: 'name',
  'full name': 'name',
  'display name': 'name',
  fullname: 'name',
  displayname: 'name',
  email: 'email',
  'email address': 'email',
  emailaddress: 'email',
  phone: 'phone',
  'phone number': 'phone',
  phonenumber: 'phone',
  mobile: 'phone',
  'mobile number': 'phone',
  telephone: 'phone',
  whatsapp: 'whatsapp',
  telegram: 'telegram',
  role: 'role',
  title: 'role',
  position: 'role',
  notes: 'notes',
  note: 'notes',
  description: 'notes',
  tags: 'tags',
  label: 'tags',
  labels: 'tags',
};

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      cells.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  cells.push(current.trim());
  return cells;
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function contactsDir(): string {
  const home = process.env.CARINA_HOME ?? path.join(os.homedir(), '.carina');
  return path.join(home, 'profiles', 'contacts');
}

export async function importContactsFromCsv(
  csvContent: string,
  filename: string,
  workspaceId?: string,
): Promise<CsvImportResult> {
  const errors: string[] = [];
  let imported = 0;
  let skipped = 0;

  const rawLines = csvContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const lines = rawLines.filter((l) => l.trim().length > 0);

  if (lines.length < 2) {
    return { imported: 0, skipped: 0, errors: ['CSV has no data rows'] };
  }

  const headers = parseCsvLine(lines[0]).map((h) => h.toLowerCase().replace(/"/g, '').trim());
  const nameIdx = headers.findIndex((h) => COLUMN_ALIASES[h] === 'name');

  if (nameIdx === -1) {
    return { imported: 0, skipped: 0, errors: ['CSV has no recognisable name column'] };
  }

  const contacts: ContactProfile[] = [];

  for (let i = 1; i < lines.length; i++) {
    try {
      const cells = parseCsvLine(lines[i]);
      const name = cells[nameIdx]?.replace(/"/g, '').trim() ?? '';
      if (!name) { skipped++; continue; }

      const contact: ContactProfile = {
        id: `csv-${slugify(name)}-${i}`,
        name,
        source: 'imported',
      };

      for (let j = 0; j < headers.length; j++) {
        if (j === nameIdx) continue;
        const field = COLUMN_ALIASES[headers[j]];
        if (!field || field === 'name') continue;
        const raw = cells[j]?.replace(/"/g, '').trim() ?? '';
        if (!raw) continue;

        if (field === 'tags') {
          contact.tags = raw.split(',').map((t) => t.trim()).filter(Boolean);
        } else {
          (contact as unknown as Record<string, unknown>)[field] = raw;
        }
      }

      contacts.push(contact);
      imported++;
    } catch (err) {
      errors.push(`row[${i}]: ${err instanceof Error ? err.message : String(err)}`);
      skipped++;
    }
  }

  const dir = contactsDir();
  if (!fsSync.existsSync(dir)) await fs.mkdir(dir, { recursive: true });

  const baseName = path.basename(filename, path.extname(filename));
  const suffix = workspaceId ? `-${workspaceId.slice(0, 16)}` : '';
  const outPath = path.join(dir, `csv-${slugify(baseName)}${suffix}.json`);
  await fs.writeFile(outPath, JSON.stringify(contacts, null, 2), 'utf8');

  return { imported, skipped, errors };
}
