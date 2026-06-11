import fs from 'fs/promises';
import path from 'path';
import { config } from '../config/index.js';
import { CARINA_HOME } from '../config/paths.js';
import { pool } from '../memory/db.js';

export const OPERATOR_TENANT_ID = '__operator__';

export type InstalledPackRow = {
  pack_name: string;
  version: string;
  installed_at: string;
  status: string;
  updated_at?: string;
  updated_by?: string;
};

export type OperatorPackMeta = {
  actor?: string;
  source?: string;
};

export type OperatorPackAuditEntry = {
  actor: string;
  source: string;
  packs_before: string[];
  packs_after: string[];
  created_at: string;
};

type OperatorPacksFile = {
  packs: InstalledPackRow[];
};

type OperatorAuditFile = {
  entries: OperatorPackAuditEntry[];
};

let runtimeActivePacks: string[] | null = null;
let storeReady = false;
let fileOnlyMode = false;

const OPERATOR_PACKS_FILE = path.join(CARINA_HOME, 'operator-packs.json');
const OPERATOR_AUDIT_FILE = path.join(CARINA_HOME, 'operator-pack-audit.json');

export function getOperatorActivePacks(): string[] {
  if (runtimeActivePacks !== null) return runtimeActivePacks;
  return config.carina.activePacks;
}

export function setOperatorActivePacks(packs: string[]): void {
  runtimeActivePacks = [...packs];
}

function emptyRow(name: string, version: string, meta: OperatorPackMeta = {}): InstalledPackRow {
  const now = new Date().toISOString();
  return {
    pack_name: name,
    version,
    installed_at: now,
    status: 'installed',
    updated_at: now,
    updated_by: meta.actor?.trim() || 'system',
  };
}

async function readFileStore(): Promise<InstalledPackRow[]> {
  try {
    const raw = await fs.readFile(OPERATOR_PACKS_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as OperatorPacksFile;
    return Array.isArray(parsed.packs) ? parsed.packs : [];
  } catch {
    return [];
  }
}

async function writeFileStore(rows: InstalledPackRow[]): Promise<void> {
  await fs.mkdir(CARINA_HOME, { recursive: true });
  await fs.writeFile(
    OPERATOR_PACKS_FILE,
    JSON.stringify({ packs: rows }, null, 2),
    { mode: 0o600 },
  );
}

async function readAuditFile(): Promise<OperatorPackAuditEntry[]> {
  try {
    const raw = await fs.readFile(OPERATOR_AUDIT_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as OperatorAuditFile;
    return Array.isArray(parsed.entries) ? parsed.entries : [];
  } catch {
    return [];
  }
}

async function appendAuditFile(entry: OperatorPackAuditEntry): Promise<void> {
  const entries = await readAuditFile();
  entries.unshift(entry);
  await fs.mkdir(CARINA_HOME, { recursive: true });
  await fs.writeFile(
    OPERATOR_AUDIT_FILE,
    JSON.stringify({ entries: entries.slice(0, 100) }, null, 2),
    { mode: 0o600 },
  );
}

function normalizePackNames(names: string[]): string[] {
  return [...new Set(names.map((name) => name.trim()).filter(Boolean))];
}

async function writeAuditEntry(
  actor: string,
  source: string,
  packsBefore: string[],
  packsAfter: string[],
): Promise<OperatorPackAuditEntry> {
  const entry: OperatorPackAuditEntry = {
    actor,
    source,
    packs_before: [...packsBefore],
    packs_after: [...packsAfter],
    created_at: new Date().toISOString(),
  };
  if (fileOnlyMode) {
    await appendAuditFile(entry);
    return entry;
  }
  try {
    await pool.query(
      `INSERT INTO operator_pack_audit (actor, source, packs_before, packs_after)
       VALUES ($1, $2, $3, $4)`,
      [actor, source, packsBefore, packsAfter],
    );
    return entry;
  } catch {
    fileOnlyMode = true;
    await appendAuditFile(entry);
    return entry;
  }
}

export async function getLastOperatorPackAudit(): Promise<OperatorPackAuditEntry | null> {
  if (fileOnlyMode) {
    const entries = await readAuditFile();
    return entries[0] ?? null;
  }
  try {
    const result = await pool.query(
      `SELECT actor, source, packs_before, packs_after, created_at
       FROM operator_pack_audit
       ORDER BY created_at DESC
       LIMIT 1`,
    );
    const row = result.rows[0];
    if (!row) return (await readAuditFile())[0] ?? null;
    return {
      actor: String(row.actor),
      source: String(row.source),
      packs_before: Array.isArray(row.packs_before) ? row.packs_before.map(String) : [],
      packs_after: Array.isArray(row.packs_after) ? row.packs_after.map(String) : [],
      created_at: row.created_at instanceof Date
        ? row.created_at.toISOString()
        : String(row.created_at),
    };
  } catch {
    const entries = await readAuditFile();
    return entries[0] ?? null;
  }
}

export async function listRecentOperatorPackAudit(limit = 5): Promise<OperatorPackAuditEntry[]> {
  if (fileOnlyMode) {
    return (await readAuditFile()).slice(0, limit);
  }
  try {
    const result = await pool.query(
      `SELECT actor, source, packs_before, packs_after, created_at
       FROM operator_pack_audit
       ORDER BY created_at DESC
       LIMIT $1`,
      [limit],
    );
    return result.rows.map((row) => ({
      actor: String(row.actor),
      source: String(row.source),
      packs_before: Array.isArray(row.packs_before) ? row.packs_before.map(String) : [],
      packs_after: Array.isArray(row.packs_after) ? row.packs_after.map(String) : [],
      created_at: row.created_at instanceof Date
        ? row.created_at.toISOString()
        : String(row.created_at),
    }));
  } catch {
    return (await readAuditFile()).slice(0, limit);
  }
}

async function readDbStore(): Promise<InstalledPackRow[]> {
  const result = await pool.query(
    `SELECT pack_name, version, installed_at, status, updated_at, updated_by
     FROM installed_packs
     WHERE tenant_id = $1
     ORDER BY installed_at DESC`,
    [OPERATOR_TENANT_ID],
  );
  return result.rows.map((row) => ({
    pack_name: String(row.pack_name),
    version: String(row.version),
    installed_at: row.installed_at instanceof Date
      ? row.installed_at.toISOString()
      : String(row.installed_at),
    status: String(row.status),
    updated_at: row.updated_at instanceof Date
      ? row.updated_at.toISOString()
      : row.updated_at ? String(row.updated_at) : undefined,
    updated_by: row.updated_by ? String(row.updated_by) : undefined,
  }));
}

async function writeDbPack(name: string, version: string, meta: OperatorPackMeta = {}): Promise<void> {
  const actor = meta.actor?.trim() || 'system';
  await pool.query(
    `INSERT INTO installed_packs (tenant_id, pack_name, version, status, installed_at, updated_at, updated_by)
     VALUES ($1, $2, $3, 'installed', NOW(), NOW(), $4)
     ON CONFLICT (tenant_id, pack_name)
     DO UPDATE SET version = $3, status = 'installed', updated_at = NOW(), updated_by = $4`,
    [OPERATOR_TENANT_ID, name, version, actor],
  );
}

async function deleteDbPack(name: string): Promise<void> {
  await pool.query(
    'DELETE FROM installed_packs WHERE tenant_id = $1 AND pack_name = $2',
    [OPERATOR_TENANT_ID, name],
  );
  await pool.query(
    'DELETE FROM pack_config WHERE tenant_id = $1 AND pack_name = $2',
    [OPERATOR_TENANT_ID, name],
  );
}

export async function listOperatorInstalledPacks(): Promise<InstalledPackRow[]> {
  if (fileOnlyMode) return readFileStore();
  try {
    return await readDbStore();
  } catch {
    return readFileStore();
  }
}

async function persistOperatorPack(
  name: string,
  version: string,
  meta: OperatorPackMeta = {},
): Promise<void> {
  if (fileOnlyMode) {
    const rows = await readFileStore();
    const next = rows.filter((row) => row.pack_name !== name);
    next.unshift(emptyRow(name, version, meta));
    await writeFileStore(next);
    return;
  }
  try {
    await writeDbPack(name, version, meta);
  } catch {
    fileOnlyMode = true;
    await persistOperatorPack(name, version, meta);
  }
}

async function removeOperatorPackRecord(name: string): Promise<void> {
  if (fileOnlyMode) {
    const rows = await readFileStore();
    await writeFileStore(rows.filter((row) => row.pack_name !== name));
    return;
  }
  try {
    await deleteDbPack(name);
  } catch {
    fileOnlyMode = true;
    await removeOperatorPackRecord(name);
  }
}

async function seedFromEnvIfEmpty(rows: InstalledPackRow[]): Promise<string[]> {
  if (rows.length > 0) {
    return rows.filter((row) => row.status === 'installed').map((row) => row.pack_name);
  }
  const envPacks = config.carina.activePacks;
  if (envPacks.length === 0) return [];
  for (const name of envPacks) {
    await persistOperatorPack(name, '1.0.0');
  }
  return [...envPacks];
}

export async function initOperatorPackStore(options: { fileOnly?: boolean } = {}): Promise<void> {
  if (storeReady) return;
  fileOnlyMode = options.fileOnly === true;
  const rows = await listOperatorInstalledPacks();
  const names = await seedFromEnvIfEmpty(rows);
  setOperatorActivePacks(names);
  storeReady = true;
}

export async function installOperatorPack(
  name: string,
  version: string,
  meta: OperatorPackMeta = {},
): Promise<void> {
  const before = [...getOperatorActivePacks()];
  if (before.includes(name)) {
    await persistOperatorPack(name, version, meta);
    return;
  }
  await persistOperatorPack(name, version, meta);
  const after = [...before, name];
  setOperatorActivePacks(after);
  await writeAuditEntry(
    meta.actor?.trim() || 'operator',
    meta.source?.trim() || 'packs-ui',
    before,
    after,
  );
}

export async function uninstallOperatorPack(
  name: string,
  meta: OperatorPackMeta = {},
): Promise<void> {
  const before = [...getOperatorActivePacks()];
  if (!before.includes(name)) {
    await removeOperatorPackRecord(name);
    return;
  }
  await removeOperatorPackRecord(name);
  const after = before.filter((pack) => pack !== name);
  setOperatorActivePacks(after);
  await writeAuditEntry(
    meta.actor?.trim() || 'operator',
    meta.source?.trim() || 'packs-ui',
    before,
    after,
  );
}

export async function syncOperatorActivePacks(
  desired: string[],
  meta: { actor?: string; source?: string; versions?: Record<string, string> } = {},
): Promise<{ active: string[]; added: string[]; removed: string[] }> {
  const actor = meta.actor?.trim() || 'ops-admin';
  const source = meta.source?.trim() || 'ops';
  const normalized = normalizePackNames(desired);
  const before = [...getOperatorActivePacks()];
  const toAdd = normalized.filter((name) => !before.includes(name));
  const toRemove = before.filter((name) => !normalized.includes(name));

  for (const name of toRemove) {
    await removeOperatorPackRecord(name);
  }

  const rows = normalized.map((name) =>
    emptyRow(name, meta.versions?.[name] ?? '1.0.0', { actor, source: meta.source }),
  );

  if (fileOnlyMode) {
    await writeFileStore(rows);
  } else {
    try {
      await pool.query('DELETE FROM installed_packs WHERE tenant_id = $1', [OPERATOR_TENANT_ID]);
      for (const row of rows) {
        await writeDbPack(row.pack_name, row.version, { actor, source: meta.source });
      }
    } catch {
      fileOnlyMode = true;
      await writeFileStore(rows);
    }
  }

  setOperatorActivePacks(normalized);

  const { enablePackRuntime } = await import('./index.js');
  for (const name of toAdd) {
    await enablePackRuntime(name);
  }

  if (toAdd.length > 0 || toRemove.length > 0 || before.length !== normalized.length) {
    await writeAuditEntry(actor, source, before, normalized);
  }

  return { active: normalized, added: toAdd, removed: toRemove };
}
