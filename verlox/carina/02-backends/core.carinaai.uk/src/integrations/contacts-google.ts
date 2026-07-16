import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import os from 'os';
import type { ContactProfile } from '../profiles/contacts.js';

export interface GoogleContactsSyncResult {
  imported: number;
  skipped: number;
  errors: string[];
}

interface GoogleName {
  displayName?: string;
  unstructuredName?: string;
}

interface GoogleEmailAddress {
  value?: string;
}

interface GooglePhoneNumber {
  value?: string;
}

interface GooglePersonMetadata {
  deleted?: boolean;
}

interface GooglePerson {
  resourceName?: string;
  names?: GoogleName[];
  emailAddresses?: GoogleEmailAddress[];
  phoneNumbers?: GooglePhoneNumber[];
  metadata?: GooglePersonMetadata;
}

interface GoogleConnectionsResponse {
  connections?: GooglePerson[];
  nextPageToken?: string;
}

function contactsDir(): string {
  const home = process.env.CARINA_HOME ?? path.join(os.homedir(), '.carina');
  return path.join(home, 'profiles', 'contacts');
}

async function fetchAllConnections(accessToken: string): Promise<GooglePerson[]> {
  const all: GooglePerson[] = [];
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({
      personFields: 'names,emailAddresses,phoneNumbers,metadata',
      pageSize: '1000',
      sortOrder: 'LAST_MODIFIED_DESCENDING',
    });
    if (pageToken) params.set('pageToken', pageToken);

    const url = `https://people.googleapis.com/v1/people/me/connections?${params.toString()}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Google People API returned ${res.status}: ${body.slice(0, 200)}`);
    }

    const data = await res.json() as GoogleConnectionsResponse;
    if (Array.isArray(data.connections)) all.push(...data.connections);
    pageToken = data.nextPageToken;
  } while (pageToken);

  return all;
}

function personToContact(person: GooglePerson, index: number): ContactProfile | null {
  if (person.metadata?.deleted) return null;
  const name = person.names?.[0]?.displayName ?? person.names?.[0]?.unstructuredName ?? '';
  if (!name.trim()) return null;

  const email = person.emailAddresses?.[0]?.value ?? undefined;
  const phone = person.phoneNumbers?.[0]?.value ?? undefined;

  return {
    id: person.resourceName ?? `google-${index}`,
    name: name.trim(),
    email,
    phone,
    whatsapp: phone,
    source: 'imported',
  };
}

export async function syncGoogleContacts(
  accessToken: string,
  workspaceId?: string,
): Promise<GoogleContactsSyncResult> {
  const errors: string[] = [];
  let imported = 0;
  let skipped = 0;

  let people: GooglePerson[];
  try {
    people = await fetchAllConnections(accessToken);
  } catch (err) {
    return { imported: 0, skipped: 0, errors: [err instanceof Error ? err.message : String(err)] };
  }

  const contacts: ContactProfile[] = [];
  for (let i = 0; i < people.length; i++) {
    try {
      const c = personToContact(people[i], i);
      if (!c) { skipped++; continue; }
      contacts.push(c);
      imported++;
    } catch (err) {
      errors.push(`contact[${i}]: ${err instanceof Error ? err.message : String(err)}`);
      skipped++;
    }
  }

  const dir = contactsDir();
  if (!fsSync.existsSync(dir)) await fs.mkdir(dir, { recursive: true });

  const suffix = workspaceId ? `-${workspaceId.slice(0, 16)}` : '';
  const outPath = path.join(dir, `google${suffix}.json`);
  await fs.writeFile(outPath, JSON.stringify(contacts, null, 2), 'utf8');

  return { imported, skipped, errors };
}
