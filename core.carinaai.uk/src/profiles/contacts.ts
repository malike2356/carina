import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import os from 'os';

export interface ContactProfile {
  id: string;
  name: string;
  role?: string;
  phone?: string;
  email?: string;
  whatsapp?: string;
  telegram?: string;
  notes?: string;
  tags?: string[];
  source: 'carina' | 'imported';
}

function contactDirs(): string[] {
  const home = process.env.CARINA_HOME ?? path.join(os.homedir(), '.carina');
  const dirs = [
    path.join(home, 'profiles', 'contacts'),
    path.join(process.env.CARINA_PROFILES_DIR ?? path.join(home, 'profiles'), 'contacts'),
  ];

  const extra = process.env.CARINA_CONTACTS_DIRS?.split(',').map((d) => d.trim()).filter(Boolean) ?? [];
  return [...new Set([...dirs, ...extra])];
}

async function loadJsonContacts(filePath: string, source: 'carina' | 'imported'): Promise<ContactProfile[]> {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    const data = JSON.parse(raw) as ContactProfile[] | { contacts?: ContactProfile[] };
    const list = Array.isArray(data) ? data : (data.contacts ?? []);
    return list.map((c, i) => ({
      id: c.id ?? `contact-${i}`,
      name: c.name,
      role: c.role,
      phone: c.phone,
      email: c.email,
      whatsapp: c.whatsapp ?? c.phone,
      telegram: c.telegram,
      notes: c.notes,
      tags: c.tags,
      source,
    }));
  } catch {
    return [];
  }
}

export async function loadAllContacts(): Promise<ContactProfile[]> {
  const byId = new Map<string, ContactProfile>();

  for (const dir of contactDirs()) {
    if (!fsSync.existsSync(dir)) continue;
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isFile() && entry.name.endsWith('.json')) {
        for (const c of await loadJsonContacts(full, 'carina')) {
          byId.set(c.id, c);
        }
      }
      if (entry.isDirectory()) {
        const profileFile = path.join(full, 'profile.json');
        if (fsSync.existsSync(profileFile)) {
          for (const c of await loadJsonContacts(profileFile, 'imported')) {
            byId.set(c.id, c);
          }
        }
      }
    }
  }

  const rootFile = path.join(process.env.CARINA_HOME ?? path.join(os.homedir(), '.carina'), 'contacts.json');
  if (fsSync.existsSync(rootFile)) {
    for (const c of await loadJsonContacts(rootFile, 'carina')) {
      byId.set(c.id, c);
    }
  }

  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export async function findContact(query: string): Promise<ContactProfile[]> {
  const q = query.toLowerCase().trim();
  const all = await loadAllContacts();
  return all.filter((c) =>
    c.name.toLowerCase().includes(q)
    || (c.role ?? '').toLowerCase().includes(q)
    || (c.notes ?? '').toLowerCase().includes(q)
    || (c.tags ?? []).some((t) => t.toLowerCase().includes(q)),
  );
}

export function contactsContextBlock(contacts: ContactProfile[]): string {
  if (contacts.length === 0) return '';
  const lines = contacts.map((c) => {
    const channels = [
      c.whatsapp ? `whatsapp:${c.whatsapp}` : '',
      c.telegram ? `telegram:${c.telegram}` : '',
      c.email ? `email:${c.email}` : '',
      c.phone ? `phone:${c.phone}` : '',
    ].filter(Boolean).join(', ');
    return `- ${c.name}${c.role ? ` (${c.role})` : ''}${channels ? ` [${channels}]` : ''}${c.notes ? `: ${c.notes}` : ''}`;
  });
  return `Known contacts:\n${lines.join('\n')}`;
}
