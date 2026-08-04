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
  source: 'carina' | 'imported' | 'manual' | 'google' | 'csv';
  resourceName?: string;
  etag?: string;
  sourceFile?: string;
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

function detectFileSource(filePath: string, isNestedProfile = false): ContactProfile['source'] {
  const base = path.basename(filePath).toLowerCase();
  if (base === 'manual.json') return 'manual';
  if (base.startsWith('google')) return 'google';
  if (base.startsWith('csv')) return 'csv';
  if (isNestedProfile) return 'imported';
  if (base === 'contacts.json') return 'carina';
  return 'imported';
}

async function loadJsonContacts(
  filePath: string,
  source: ContactProfile['source'],
): Promise<ContactProfile[]> {
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
      resourceName: c.resourceName,
      etag: c.etag,
      sourceFile: filePath,
    }));
  } catch {
    return [];
  }
}

export function contactsRootDir(): string {
  const home = process.env.CARINA_HOME ?? path.join(os.homedir(), '.carina');
  return path.join(home, 'profiles', 'contacts');
}

export function manualContactsFile(): string {
  return path.join(contactsRootDir(), 'manual.json');
}

export function googleContactsFileForWorkspace(workspaceId: string): string {
  const id = workspaceId.trim().toLowerCase();
  return path.join(contactsRootDir(), `google-${id}.json`);
}

export function contactEnrichmentsFile(workspaceId?: string | null): string {
  const id = typeof workspaceId === 'string' ? workspaceId.trim().toLowerCase() : '';
  if (id) return path.join(contactsRootDir(), `enrichments-${id}.json`);
  return path.join(contactsRootDir(), 'enrichments.json');
}

function isHostedMultiTenant(): boolean {
  return process.env.HOSTED_MODE === 'true' || process.env.CARINA_OPS_PRODUCT_ENABLED === 'true';
}

type ContactEnrichment = {
  id: string;
  email?: string;
  telegram?: string;
  phone?: string;
  whatsapp?: string;
  notes?: string;
  updatedAt?: string;
};

async function loadContactEnrichments(workspaceId?: string | null): Promise<ContactEnrichment[]> {
  const filePath = contactEnrichmentsFile(workspaceId);
  if (!fsSync.existsSync(filePath)) return [];
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    const data = JSON.parse(raw) as ContactEnrichment[] | { enrichments?: ContactEnrichment[] };
    return Array.isArray(data) ? data : (data.enrichments ?? []);
  } catch {
    return [];
  }
}

async function saveContactEnrichments(
  rows: ContactEnrichment[],
  workspaceId?: string | null,
): Promise<void> {
  const filePath = contactEnrichmentsFile(workspaceId);
  await ensureParentDir(filePath);
  await fs.writeFile(filePath, JSON.stringify(rows, null, 2), 'utf8');
}

/**
 * Persist discovered email/telegram/phone onto a contact without waiting for Google sync.
 * Works for google-synced contacts via enrichments.json overlay.
 */
export async function enrichContactChannels(
  contactId: string,
  patch: Partial<Pick<ContactProfile, 'email' | 'telegram' | 'phone' | 'whatsapp' | 'notes'>>,
  workspaceId?: string | null,
): Promise<ContactProfile | null> {
  const all = await loadAllContacts(workspaceId);
  const contact = all.find((c) => c.id === contactId);
  if (!contact) return null;

  const local = await updateContactInLocalStore(contactId, patch);
  if (local) return local;

  const enrichments = await loadContactEnrichments(workspaceId);
  const idx = enrichments.findIndex((row) => row.id === contactId);
  const next: ContactEnrichment = {
    id: contactId,
    email: patch.email?.trim() || (idx >= 0 ? enrichments[idx].email : undefined),
    telegram: patch.telegram?.trim() || (idx >= 0 ? enrichments[idx].telegram : undefined),
    phone: patch.phone?.trim() || (idx >= 0 ? enrichments[idx].phone : undefined),
    whatsapp: patch.whatsapp?.trim() || patch.phone?.trim()
      || (idx >= 0 ? enrichments[idx].whatsapp : undefined),
    notes: patch.notes?.trim() || (idx >= 0 ? enrichments[idx].notes : undefined),
    updatedAt: new Date().toISOString(),
  };
  if (idx >= 0) enrichments[idx] = { ...enrichments[idx], ...next };
  else enrichments.push(next);
  await saveContactEnrichments(enrichments, workspaceId);

  return {
    ...contact,
    email: next.email || contact.email,
    telegram: next.telegram || contact.telegram,
    phone: next.phone || contact.phone,
    whatsapp: next.whatsapp || contact.whatsapp,
    notes: [contact.notes, next.notes].filter(Boolean).join(' | ') || contact.notes,
  };
}

export function rootContactsFile(): string {
  return path.join(process.env.CARINA_HOME ?? path.join(os.homedir(), '.carina'), 'contacts.json');
}

async function ensureParentDir(filePath: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

export async function saveContactsToFile(filePath: string, contacts: ContactProfile[]): Promise<void> {
  await ensureParentDir(filePath);
  await fs.writeFile(filePath, JSON.stringify(contacts, null, 2), 'utf8');
}

export async function loadContactsFromFile(filePath: string): Promise<ContactProfile[]> {
  const source = detectFileSource(filePath, false);
  return loadJsonContacts(filePath, source);
}

export async function loadManualContacts(): Promise<ContactProfile[]> {
  const filePath = manualContactsFile();
  if (!fsSync.existsSync(filePath)) return [];
  return loadJsonContacts(filePath, 'manual');
}

export function isManualContact(contact: ContactProfile): boolean {
  return contact.source === 'manual' || contact.source === 'carina';
}

export async function saveManualContacts(contacts: ContactProfile[]): Promise<void> {
  const normalized = contacts.map((contact, index) => ({
    ...contact,
    id: contact.id?.trim() || `manual-${Date.now()}-${index}`,
    source: 'manual' as const,
    whatsapp: contact.whatsapp ?? contact.phone,
  }));
  await saveContactsToFile(manualContactsFile(), normalized);
}

export async function upsertManualContact(contact: Partial<ContactProfile> & { name: string }): Promise<ContactProfile> {
  const current = await loadManualContacts();
  const id = contact.id?.trim() || `manual-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  const next: ContactProfile = {
    id,
    name: contact.name.trim(),
    role: contact.role?.trim() || undefined,
    phone: contact.phone?.trim() || undefined,
    email: contact.email?.trim() || undefined,
    whatsapp: contact.whatsapp?.trim() || contact.phone?.trim() || undefined,
    telegram: contact.telegram?.trim() || undefined,
    notes: contact.notes?.trim() || undefined,
    tags: contact.tags?.map((tag) => String(tag).trim()).filter(Boolean),
    source: 'manual',
    resourceName: contact.resourceName?.trim() || undefined,
    etag: contact.etag?.trim() || undefined,
    sourceFile: manualContactsFile(),
  };
  const index = current.findIndex((entry) => entry.id === id);
  if (index >= 0) current[index] = { ...current[index], ...next };
  else current.push(next);
  await saveManualContacts(current);
  return next;
}

export async function deleteManualContact(id: string): Promise<boolean> {
  const current = await loadManualContacts();
  const next = current.filter((entry) => entry.id !== id);
  if (next.length === current.length) return false;
  await saveManualContacts(next);
  return true;
}

const workspaceContactsCache = new Map<string, {
  signature: string;
  contacts: ContactProfile[];
}>();

function workspaceContactsSignature(workspaceId: string): string {
  const id = workspaceId.trim().toLowerCase();
  const root = contactsRootDir();
  const files = [
    path.join(root, `google-${id}.json`),
    path.join(root, `csv-${id}.json`),
    path.join(root, `manual-${id}.json`),
    path.join(root, `enrichments-${id}.json`),
    path.join(root, `google-${id.slice(0, 16)}.json`),
  ];
  return files.map((file) => {
    try {
      const st = fsSync.statSync(file);
      return `${file}:${st.mtimeMs}:${st.size}`;
    } catch {
      return `${file}:missing`;
    }
  }).join('|');
}

export function clearWorkspaceContactsCacheForTests(): void {
  workspaceContactsCache.clear();
}

export async function loadContactsForWorkspace(workspaceId: string): Promise<ContactProfile[]> {
  const id = workspaceId.trim();
  if (!id) return [];

  const signature = workspaceContactsSignature(id);
  const cached = workspaceContactsCache.get(id.toLowerCase());
  if (cached && cached.signature === signature) return cached.contacts;

  const byId = new Map<string, ContactProfile>();
  const googleFile = googleContactsFileForWorkspace(id);
  if (fsSync.existsSync(googleFile)) {
    for (const c of await loadJsonContacts(googleFile, 'google')) {
      byId.set(c.id, c);
    }
  }

  // Optional per-workspace CSV imports: csv-<workspaceId>.json
  const csvFile = path.join(contactsRootDir(), `csv-${id.toLowerCase()}.json`);
  if (fsSync.existsSync(csvFile)) {
    for (const c of await loadJsonContacts(csvFile, 'csv')) {
      byId.set(c.id, c);
    }
  }

  const manualFile = path.join(contactsRootDir(), `manual-${id.toLowerCase()}.json`);
  if (fsSync.existsSync(manualFile)) {
    for (const c of await loadJsonContacts(manualFile, 'manual')) {
      byId.set(c.id, c);
    }
  }

  // Backward-compatible short-prefix files from earlier syncs.
  const shortPrefix = id.slice(0, 16).toLowerCase();
  if (shortPrefix !== id.toLowerCase()) {
    const legacyGoogle = path.join(contactsRootDir(), `google-${shortPrefix}.json`);
    if (fsSync.existsSync(legacyGoogle) && !fsSync.existsSync(googleFile)) {
      for (const c of await loadJsonContacts(legacyGoogle, 'google')) {
        byId.set(c.id, c);
      }
    }
  }

  for (const enrichment of await loadContactEnrichments(id)) {
    const existing = byId.get(enrichment.id);
    if (!existing) continue;
    byId.set(enrichment.id, {
      ...existing,
      email: enrichment.email || existing.email,
      telegram: enrichment.telegram || existing.telegram,
      phone: enrichment.phone || existing.phone,
      whatsapp: enrichment.whatsapp || enrichment.phone || existing.whatsapp,
      notes: [existing.notes, enrichment.notes].filter(Boolean).join(' | ') || existing.notes,
    });
  }

  const contacts = [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
  workspaceContactsCache.set(id.toLowerCase(), { signature, contacts });
  return contacts;
}

/**
 * Load contacts. In hosted/Aiva mode, workspaceId is required to prevent
 * cross-tenant leakage of Google contact directories.
 */
export async function loadAllContacts(workspaceId?: string | null): Promise<ContactProfile[]> {
  const scoped = typeof workspaceId === 'string' ? workspaceId.trim() : '';
  if (scoped) return loadContactsForWorkspace(scoped);

  if (isHostedMultiTenant()) {
    // Refuse unscoped reads on multi-tenant hosts.
    return [];
  }

  const byId = new Map<string, ContactProfile>();

  for (const dir of contactDirs()) {
    if (!fsSync.existsSync(dir)) continue;
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isFile() && entry.name.endsWith('.json')) {
        if (entry.name.toLowerCase() === 'enrichments.json') continue;
        for (const c of await loadJsonContacts(full, detectFileSource(full, false))) {
          byId.set(c.id, c);
        }
      }
      if (entry.isDirectory()) {
        const profileFile = path.join(full, 'profile.json');
        if (fsSync.existsSync(profileFile)) {
          for (const c of await loadJsonContacts(profileFile, detectFileSource(profileFile, true))) {
            byId.set(c.id, c);
          }
        }
      }
    }
  }

  const rootFile = rootContactsFile();
  if (fsSync.existsSync(rootFile)) {
    for (const c of await loadJsonContacts(rootFile, 'carina')) {
      byId.set(c.id, c);
    }
  }

  const manualFile = manualContactsFile();
  if (fsSync.existsSync(manualFile)) {
    for (const c of await loadJsonContacts(manualFile, 'manual')) {
      byId.set(c.id, c);
    }
  }

  for (const enrichment of await loadContactEnrichments()) {
    const existing = byId.get(enrichment.id);
    if (!existing) continue;
    byId.set(enrichment.id, {
      ...existing,
      email: enrichment.email || existing.email,
      telegram: enrichment.telegram || existing.telegram,
      phone: enrichment.phone || existing.phone,
      whatsapp: enrichment.whatsapp || enrichment.phone || existing.whatsapp,
      notes: [existing.notes, enrichment.notes].filter(Boolean).join(' | ') || existing.notes,
    });
  }

  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export async function findContactById(
  id: string,
  workspaceId?: string | null,
): Promise<ContactProfile | null> {
  const all = await loadAllContacts(workspaceId);
  return all.find((contact) => contact.id === id) ?? null;
}

export async function updateContactInLocalStore(
  id: string,
  patch: Partial<ContactProfile>,
): Promise<ContactProfile | null> {
  const manual = await loadManualContacts();
  const manualIdx = manual.findIndex((entry) => entry.id === id);
  if (manualIdx >= 0) {
    const next = {
      ...manual[manualIdx],
      ...patch,
      id,
      source: 'manual' as const,
      whatsapp: patch.whatsapp ?? patch.phone ?? manual[manualIdx].whatsapp ?? manual[manualIdx].phone,
    };
    manual[manualIdx] = next;
    await saveManualContacts(manual);
    return next;
  }

  const rootFile = rootContactsFile();
  if (fsSync.existsSync(rootFile)) {
    const rootContacts = await loadJsonContacts(rootFile, 'carina');
    const idx = rootContacts.findIndex((entry) => entry.id === id);
    if (idx >= 0) {
      const next = {
        ...rootContacts[idx],
        ...patch,
        id,
        source: 'carina' as const,
        whatsapp: patch.whatsapp ?? patch.phone ?? rootContacts[idx].whatsapp ?? rootContacts[idx].phone,
      };
      rootContacts[idx] = next;
      await saveContactsToFile(rootFile, rootContacts);
      return next;
    }
  }

  return null;
}

export async function deleteContactFromLocalStore(id: string): Promise<boolean> {
  if (await deleteManualContact(id)) return true;

  const rootFile = rootContactsFile();
  if (!fsSync.existsSync(rootFile)) return false;

  const rootContacts = await loadJsonContacts(rootFile, 'carina');
  const next = rootContacts.filter((entry) => entry.id !== id);
  if (next.length === rootContacts.length) return false;
  await saveContactsToFile(rootFile, next);
  return true;
}

/** Levenshtein distance for short name tokens (typo / phonetic near-misses). */
export function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const rows = a.length + 1;
  const cols = b.length + 1;
  const prev = new Array<number>(cols);
  const cur = new Array<number>(cols);
  for (let j = 0; j < cols; j += 1) prev[j] = j;
  for (let i = 1; i < rows; i += 1) {
    cur[0] = i;
    const ca = a.charCodeAt(i - 1);
    for (let j = 1; j < cols; j += 1) {
      const cost = ca === b.charCodeAt(j - 1) ? 0 : 1;
      cur[j] = Math.min(cur[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j < cols; j += 1) prev[j] = cur[j]!;
  }
  return prev[b.length]!;
}

/** Collapse repeats and vowel runs so Apigey ≈ Appiah. */
export function normalizePhoneticToken(value: string): string {
  return value
    .toLowerCase()
    .replace(/(.)\1+/g, '$1')
    .replace(/[aeiouy]+/g, (run) => run[0] ?? '');
}

export function consonantSkeleton(value: string): string {
  return value
    .toLowerCase()
    .replace(/(.)\1+/g, '$1')
    .replace(/[aeiouy]/g, '');
}

/** Similarity 0..1 from edit distance + light phonetic near-miss. */
export function tokenSimilarity(a: string, b: string): number {
  const left = a.toLowerCase().trim();
  const right = b.toLowerCase().trim();
  if (!left || !right) return 0;
  if (left === right) return 1;
  const maxLen = Math.max(left.length, right.length);
  if (maxLen === 0) return 1;
  const direct = 1 - editDistance(left, right) / maxLen;
  if (direct >= 0.72) return direct;

  const nLeft = normalizePhoneticToken(left);
  const nRight = normalizePhoneticToken(right);
  if (nLeft.length >= 3 && nRight.length >= 3 && nLeft.slice(0, 3) === nRight.slice(0, 3)) {
    const nDist = editDistance(nLeft, nRight);
    if (nDist <= 2 && Math.abs(nLeft.length - nRight.length) <= 2) {
      return Math.max(direct, 0.82 - nDist * 0.04);
    }
    // Same phonetic stem (api…) with a one-consonant slip (pg≈ph) is still a near miss.
    const sLeft = consonantSkeleton(left);
    const sRight = consonantSkeleton(right);
    if (
      sLeft.length >= 2
      && sRight.length >= 2
      && editDistance(sLeft, sRight) <= 1
      && Math.abs(left.length - right.length) <= 2
    ) {
      return Math.max(direct, 0.8);
    }
  }

  return direct;
}

function nameTokens(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);
}

/**
 * Best fuzzy score of query tokens against a contact name.
 * Single-token queries (e.g. Apigey) match the closest name token (Appiah).
 */
export function bestFuzzyNameScore(query: string, name: string): number {
  const qTokens = nameTokens(query);
  const nTokens = nameTokens(name);
  if (qTokens.length === 0 || nTokens.length === 0) return 0;

  let matched = 0;
  let similaritySum = 0;
  for (const qt of qTokens) {
    let best = 0;
    for (const nt of nTokens) {
      const sim = tokenSimilarity(qt, nt);
      if (sim > best) best = sim;
      // Prefix / containment still counts as strong for longer tokens.
      if (nt.length >= 4 && qt.length >= 4 && (nt.includes(qt) || qt.includes(nt))) {
        best = Math.max(best, 0.9);
      }
    }
    // Require reasonably close tokens so random names do not match.
    if (best >= 0.72) {
      matched += 1;
      similaritySum += best;
    }
  }
  if (matched === 0) return 0;
  if (matched < qTokens.length && qTokens.length > 1) return 0;
  return similaritySum / qTokens.length;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function hasWordBoundaryMatch(haystack: string, needle: string): boolean {
  if (!needle) return false;
  return new RegExp(`(?:^|[^a-z0-9])${escapeRegExp(needle)}(?:[^a-z0-9]|$)`, 'i').test(haystack);
}

export async function findContact(
  query: string,
  workspaceId?: string | null,
): Promise<ContactProfile[]> {
  const q = query.toLowerCase().trim();
  if (!q) return [];
  const tokens = q.split(/[\s,]+/).map((t) => t.trim()).filter((t) => t.length >= 2);
  const all = await loadAllContacts(workspaceId);

  const scored = all.map((c) => {
    const name = (c.name ?? '').toLowerCase();
    const role = (c.role ?? '').toLowerCase();
    const notes = (c.notes ?? '').toLowerCase();
    const email = (c.email ?? '').toLowerCase();
    const phone = `${c.phone ?? ''} ${c.whatsapp ?? ''}`.toLowerCase();
    const tags = (c.tags ?? []).map((t) => t.toLowerCase());
    const haystack = `${name} ${role} ${notes} ${email} ${phone} ${tags.join(' ')}`;
    const nTokens = nameTokens(name);

    let score = 0;
    let tier: 'strong' | 'weak' | 'fuzzy' = 'fuzzy';

    if (name === q) {
      score += 100;
      tier = 'strong';
    }
    if (nTokens.some((t) => t === q)) {
      score += 90;
      tier = 'strong';
    } else if (nTokens.some((t) => t.startsWith(q) && q.length >= 3)) {
      score += 70;
      tier = 'strong';
    } else if (hasWordBoundaryMatch(name, q)) {
      score += 60;
      tier = 'strong';
    }

    if (tokens.length > 1 && tokens.every((t) => nTokens.includes(t) || name.includes(t))) {
      score += 40;
      tier = 'strong';
    }
    if (email.includes(q) || phone.replace(/\s+/g, '').includes(q.replace(/\s+/g, ''))) {
      score += 30;
      if (tier === 'fuzzy') tier = 'strong';
    }
    if (tags.some((t) => t === q || tokens.some((tok) => t === tok))) {
      score += 15;
      if (tier === 'fuzzy') tier = 'strong';
    }
    if (role.includes(q) && hasWordBoundaryMatch(role, q)) {
      score += 5;
      if (tier === 'fuzzy') tier = 'strong';
    }

    // Compound substring only (Setsoafia contains afia) is weak; dropped when strong hits exist.
    if (score === 0 && q.length >= 3 && name.includes(q)) {
      score += 20;
      tier = 'weak';
    }
    if (score === 0 && notes.includes(q)) {
      score += 10;
      tier = 'weak';
    }

    // Typo / near-miss names (Apigey → Appiah) only when nothing stronger matched.
    if (score === 0) {
      const fuzzy = bestFuzzyNameScore(q, name);
      if (fuzzy >= 0.72) {
        score += Math.round(25 * fuzzy);
        tier = 'fuzzy';
      }
      const emailLocal = email.split('@')[0] ?? '';
      if (emailLocal) {
        const emailFuzzy = bestFuzzyNameScore(q, emailLocal.replace(/[0-9._+-]+/g, ' '));
        if (emailFuzzy >= 0.78) {
          score += Math.round(20 * emailFuzzy);
          if (tier === 'fuzzy' || score > 0) tier = score >= 20 ? 'strong' : tier;
        }
      }
    }

    return { contact: c, score, tier };
  }).filter((row) => row.score > 0);

  const strong = scored.filter((row) => row.tier === 'strong');
  const weak = scored.filter((row) => row.tier === 'weak');
  const fuzzy = scored.filter((row) => row.tier === 'fuzzy');
  const chosen = strong.length > 0 ? strong : weak.length > 0 ? weak : fuzzy;

  return chosen
    .sort((a, b) => b.score - a.score || a.contact.name.localeCompare(b.contact.name))
    .slice(0, strong.length > 0 ? 15 : 25)
    .map((row) => row.contact);
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
