import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { RotationAuditEntry, SecretRegistryEntry } from './types.js';
import { registryPath, rotationAuditPath, secretsRotationRoot } from './paths.js';

type RegistryFile = {
  entries: SecretRegistryEntry[];
};

async function readRegistry(): Promise<RegistryFile> {
  try {
    return JSON.parse(await fs.readFile(registryPath(), 'utf8')) as RegistryFile;
  } catch {
    return { entries: [] };
  }
}

async function writeRegistry(file: RegistryFile): Promise<void> {
  await fs.mkdir(path.dirname(registryPath()), { recursive: true });
  await fs.writeFile(registryPath(), JSON.stringify(file, null, 2), { mode: 0o600 });
}

export async function listRegistryEntries(): Promise<SecretRegistryEntry[]> {
  const file = await readRegistry();
  return file.entries;
}

export async function getRegistryEntry(provider: string): Promise<SecretRegistryEntry | null> {
  const file = await readRegistry();
  return file.entries.find((row) => row.provider === provider) ?? null;
}

export async function upsertRegistryEntry(
  input: Omit<SecretRegistryEntry, 'credentialId' | 'createdAt' | 'lastRotatedAt'> & {
    credentialId?: string;
    createdAt?: number;
    lastRotatedAt?: number;
  },
): Promise<SecretRegistryEntry> {
  const file = await readRegistry();
  const now = Date.now();
  const existing = file.entries.find((row) => row.provider === input.provider);
  const entry: SecretRegistryEntry = {
    provider: input.provider,
    secretType: input.secretType,
    envKey: input.envKey,
    credentialId: input.credentialId ?? existing?.credentialId ?? randomUUID(),
    createdAt: existing?.createdAt ?? input.createdAt ?? now,
    lastRotatedAt: input.lastRotatedAt ?? existing?.lastRotatedAt ?? now,
    expiresAt: input.expiresAt,
    active: input.active,
  };
  if (existing) {
    Object.assign(existing, entry);
  } else {
    file.entries.push(entry);
  }
  await writeRegistry(file);
  return entry;
}

export async function markRotated(
  provider: string,
  newCredentialId: string,
  expiresAt: number,
): Promise<SecretRegistryEntry | null> {
  const file = await readRegistry();
  const entry = file.entries.find((row) => row.provider === provider);
  if (!entry) return null;
  entry.lastRotatedAt = Date.now();
  entry.credentialId = newCredentialId;
  entry.expiresAt = expiresAt;
  entry.active = true;
  await writeRegistry(file);
  return entry;
}

export async function appendRotationAudit(entry: RotationAuditEntry): Promise<void> {
  const file = rotationAuditPath();
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.appendFile(file, `${JSON.stringify(entry)}\n`, { mode: 0o600 });
}

export async function readRotationAudit(limit = 50): Promise<RotationAuditEntry[]> {
  try {
    const raw = await fs.readFile(rotationAuditPath(), 'utf8');
    return raw.trim().split('\n').filter(Boolean).slice(-limit).map((line) => JSON.parse(line) as RotationAuditEntry);
  } catch {
    return [];
  }
}

export async function _resetSecretsRegistryForTests(): Promise<void> {
  try {
    await fs.rm(secretsRotationRoot(), { recursive: true, force: true });
  } catch {
    // ignore
  }
}
