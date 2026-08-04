import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import os from 'os';
import type { ContactProfile } from '../profiles/contacts.js';
import { refreshGoogleWorkspaceAccessToken } from './google-workspace-oauth.js';

export interface GoogleContactsSyncResult {
  imported: number;
  skipped: number;
  errors: string[];
}

export interface GoogleContactMutationResult {
  ok: boolean;
  contact?: ContactProfile;
  error?: string;
}

interface GoogleName {
  displayName?: string;
  unstructuredName?: string;
  givenName?: string;
  familyName?: string;
}

interface GoogleEmailAddress {
  value?: string;
}

interface GooglePhoneNumber {
  value?: string;
}

interface GoogleOrganization {
  title?: string;
}

interface GooglePersonMetadataSource {
  etag?: string;
  type?: string;
  id?: string;
  updateTime?: string;
}

interface GooglePersonMetadata {
  deleted?: boolean;
  sources?: GooglePersonMetadataSource[];
}

interface GooglePerson {
  resourceName?: string;
  etag?: string;
  names?: GoogleName[];
  emailAddresses?: GoogleEmailAddress[];
  phoneNumbers?: GooglePhoneNumber[];
  organizations?: GoogleOrganization[];
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

function resolveRefreshToken(explicit?: string, allowEnvFallback = true): string {
  if (explicit?.trim()) return explicit.trim();
  if (!allowEnvFallback) return '';
  return (
    process.env.GOOGLE_REFRESH_TOKEN?.trim()
    || process.env.GOOGLE_OAUTH_REFRESH_TOKEN?.trim()
    || ''
  );
}

async function resolveAccessToken(opts: {
  accessToken?: string;
  refreshToken?: string;
  allowEnvFallback?: boolean;
} = {}): Promise<string> {
  const accessToken = opts.accessToken?.trim() ?? '';
  if (accessToken) return accessToken;

  const refreshToken = resolveRefreshToken(opts.refreshToken, opts.allowEnvFallback !== false);
  if (!refreshToken) {
    throw new Error('Google access token or refresh token is required');
  }
  const refreshed = await refreshGoogleWorkspaceAccessToken({ refreshToken });
  return refreshed.accessToken;
}

async function googleFetchJson<T>(
  url: string,
  accessToken: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
      ...(init?.headers ?? {}),
    },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Google People API returned ${res.status}: ${body.slice(0, 300)}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

function personToContact(person: GooglePerson, index: number): ContactProfile | null {
  if (person.metadata?.deleted) return null;
  const name = person.names?.[0]?.displayName ?? person.names?.[0]?.unstructuredName ?? '';
  if (!name.trim()) return null;
  const email = person.emailAddresses?.[0]?.value ?? undefined;
  const phone = person.phoneNumbers?.[0]?.value ?? undefined;
  const role = person.organizations?.[0]?.title ?? undefined;
  const source = person.resourceName?.startsWith('people/') ? 'google' : 'imported';
  return {
    id: person.resourceName ?? `google-${index}`,
    name: name.trim(),
    role,
    email,
    phone,
    whatsapp: phone,
    source,
    resourceName: person.resourceName,
    etag: person.metadata?.sources?.[0]?.etag ?? person.etag,
  };
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
    const data = await googleFetchJson<GoogleConnectionsResponse>(url, accessToken);
    if (Array.isArray(data.connections)) all.push(...data.connections);
    pageToken = data.nextPageToken;
  } while (pageToken);

  return all;
}

async function fetchGoogleContact(accessToken: string, resourceName: string): Promise<GooglePerson> {
  return googleFetchJson<GooglePerson>(
    `https://people.googleapis.com/v1/${encodeURIComponent(resourceName)}?personFields=names,emailAddresses,phoneNumbers,metadata`,
    accessToken,
  );
}

function pickGoogleResourceName(contact: { id: string; resourceName?: string }): string {
  return contact.resourceName ?? contact.id;
}

export async function syncGoogleContacts(
  accessTokenOrRefreshToken: string,
  workspaceId?: string,
  opts: { refreshToken?: string } = {},
): Promise<GoogleContactsSyncResult> {
  const errors: string[] = [];
  let imported = 0;
  let skipped = 0;

  let accessToken: string;
  try {
    const explicitAccess = accessTokenOrRefreshToken.trim();
    const refreshToken = opts.refreshToken?.trim() || undefined;
    // Never use host env Google tokens when syncing into a workspace file.
    const allowEnvFallback = !workspaceId;
    accessToken = await resolveAccessToken({
      accessToken: refreshToken ? undefined : explicitAccess || undefined,
      refreshToken,
      allowEnvFallback,
    });
  } catch (err) {
    return { imported: 0, skipped: 0, errors: [err instanceof Error ? err.message : String(err)] };
  }

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
      if (!c) {
        skipped++;
        continue;
      }
      contacts.push(c);
      imported++;
    } catch (err) {
      errors.push(`contact[${i}]: ${err instanceof Error ? err.message : String(err)}`);
      skipped++;
    }
  }

  const dir = contactsDir();
  if (!fsSync.existsSync(dir)) await fs.mkdir(dir, { recursive: true });

  const suffix = workspaceId ? `-${workspaceId.trim().toLowerCase()}` : '';
  const outPath = path.join(dir, `google${suffix}.json`);
  await fs.writeFile(outPath, JSON.stringify(contacts, null, 2), 'utf8');

  return { imported, skipped, errors };
}

export async function listGoogleContacts(opts: {
  accessToken?: string;
  refreshToken?: string;
} = {}): Promise<ContactProfile[]> {
  const accessToken = await resolveAccessToken(opts);
  const people = await fetchAllConnections(accessToken);
  return people
    .map((person, index) => personToContact(person, index))
    .filter((contact): contact is ContactProfile => Boolean(contact))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function createGoogleContact(
  contact: Partial<ContactProfile> & { name: string },
): Promise<GoogleContactMutationResult> {
  const accessToken = await resolveAccessToken();
  const payload: Record<string, unknown> = {
    names: [{ displayName: contact.name.trim() }],
  };
  if (contact.role?.trim()) {
    payload.organizations = [{ title: contact.role.trim() }];
  }
  if (contact.email?.trim()) {
    payload.emailAddresses = [{ value: contact.email.trim() }];
  }
  if (contact.phone?.trim()) {
    payload.phoneNumbers = [{ value: contact.phone.trim() }];
  }
  const created = await googleFetchJson<GooglePerson>(
    'https://people.googleapis.com/v1/people:createContact',
    accessToken,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
  );
  const mapped = personToContact(created, 0);
  if (!mapped) {
    return { ok: false, error: 'Google did not return a usable contact' };
  }
  return { ok: true, contact: mapped };
}

export async function updateGoogleContact(
  contact: Partial<ContactProfile> & { id: string },
): Promise<GoogleContactMutationResult> {
  try {
    const accessToken = await resolveAccessToken();
    const current = await fetchGoogleContact(accessToken, pickGoogleResourceName(contact));
    const payload: Record<string, unknown> = {
      resourceName: current.resourceName,
      metadata: current.metadata,
      names: [{ displayName: contact.name?.trim() || current.names?.[0]?.displayName || '' }],
    };
    if (contact.role !== undefined) {
      payload.organizations = contact.role.trim()
        ? [{ title: contact.role.trim() }]
        : [];
    } else if (current.organizations?.length) {
      payload.organizations = current.organizations;
    }
    if (contact.email !== undefined) {
      payload.emailAddresses = contact.email.trim()
        ? [{ value: contact.email.trim() }]
        : [];
    } else if (current.emailAddresses?.length) {
      payload.emailAddresses = current.emailAddresses;
    }
    if (contact.phone !== undefined) {
      const phone = contact.phone.trim();
      payload.phoneNumbers = phone ? [{ value: phone }] : [];
    } else if (current.phoneNumbers?.length) {
      payload.phoneNumbers = current.phoneNumbers;
    }
    const updated = await googleFetchJson<GooglePerson>(
      `https://people.googleapis.com/v1/${encodeURIComponent(current.resourceName ?? contact.id)}:updateContact?updatePersonFields=names,organizations,emailAddresses,phoneNumbers`,
      accessToken,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
    );
    const mapped = personToContact(updated, 0);
    return mapped ? { ok: true, contact: mapped } : { ok: false, error: 'Google did not return a usable contact' };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function deleteGoogleContact(id: string): Promise<GoogleContactMutationResult> {
  try {
    const accessToken = await resolveAccessToken();
    await googleFetchJson<void>(
      `https://people.googleapis.com/v1/${encodeURIComponent(id)}:deleteContact`,
      accessToken,
      { method: 'DELETE' },
    );
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
