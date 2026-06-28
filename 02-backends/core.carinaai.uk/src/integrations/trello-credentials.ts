import crypto from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { AsyncLocalStorage } from 'node:async_hooks';
import { config } from '../config/index.js';
import { CARINA_DATA_DIR } from '../config/paths.js';

export type TrelloCredentials = {
  apiKey: string;
  token: string;
};

const tenantScope = new AsyncLocalStorage<string | null>();

const ENCRYPTION_KEY = process.env.TENANT_KEY_ENCRYPTION_KEY
  ?? process.env.CARINA_ENCRYPTION_KEY
  ?? 'carina-dev-key-change-in-production-32';

function encryptionKeyBuffer(): Buffer {
  return Buffer.from(ENCRYPTION_KEY.slice(0, 32), 'utf-8');
}

function encryptPayload(payload: TrelloCredentials): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', encryptionKeyBuffer(), iv);
  let encrypted = cipher.update(JSON.stringify(payload), 'utf-8', 'hex');
  encrypted += cipher.final('hex');
  return `${iv.toString('hex')}:${encrypted}`;
}

function decryptPayload(ciphertext: string): TrelloCredentials {
  const [ivHex, encrypted] = ciphertext.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', encryptionKeyBuffer(), iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf-8');
  decrypted += decipher.final('utf-8');
  const parsed = JSON.parse(decrypted) as TrelloCredentials;
  if (!parsed.apiKey?.trim() || !parsed.token?.trim()) {
    throw new Error('Invalid Trello credential payload');
  }
  return { apiKey: parsed.apiKey.trim(), token: parsed.token.trim() };
}

function credentialPath(scope: string | null): string {
  if (scope) {
    return path.join(CARINA_DATA_DIR, 'integrations', 'tenants', scope, 'trello.enc');
  }
  return path.join(CARINA_DATA_DIR, 'integrations', 'trello.enc');
}

export function maskTrelloApiKey(apiKey: string): string {
  const trimmed = apiKey.trim();
  if (trimmed.length < 6) return '***';
  return `${trimmed.slice(0, 4)}...${trimmed.slice(-2)}`;
}

export function runWithTrelloTenantScope<T>(tenantId: string | null, fn: () => T): T {
  return tenantScope.run(tenantId, fn);
}

export async function runWithTrelloTenantScopeAsync<T>(
  tenantId: string | null,
  fn: () => Promise<T>,
): Promise<T> {
  return tenantScope.run(tenantId, fn);
}

function activeTenantScope(): string | null {
  return tenantScope.getStore() ?? null;
}

async function readStoredCredentials(scope: string | null): Promise<TrelloCredentials | null> {
  try {
    const raw = await readFile(credentialPath(scope), 'utf-8');
    return decryptPayload(raw.trim());
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
}

export async function resolveTrelloCredentials(): Promise<TrelloCredentials | null> {
  const stored = await readStoredCredentials(activeTenantScope());
  if (stored) return stored;

  const envKey = config.trello.apiKey.trim();
  const envToken = config.trello.token.trim();
  if (envKey && envToken) {
    return { apiKey: envKey, token: envToken };
  }

  return null;
}

export async function isTrelloConfigured(): Promise<boolean> {
  return Boolean(await resolveTrelloCredentials());
}

export async function getTrelloSettingsStatus(): Promise<{
  configured: boolean;
  source: 'stored' | 'env' | 'none';
  apiKeyMask?: string;
}> {
  const scope = activeTenantScope();
  const stored = await readStoredCredentials(scope);
  if (stored) {
    return { configured: true, source: 'stored', apiKeyMask: maskTrelloApiKey(stored.apiKey) };
  }

  const envKey = config.trello.apiKey.trim();
  const envToken = config.trello.token.trim();
  if (envKey && envToken) {
    return { configured: true, source: 'env', apiKeyMask: maskTrelloApiKey(envKey) };
  }

  return { configured: false, source: 'none' };
}

export async function saveTrelloCredentials(credentials: TrelloCredentials): Promise<void> {
  const apiKey = credentials.apiKey.trim();
  const token = credentials.token.trim();
  if (!apiKey || !token) {
    throw new Error('apiKey and token are required');
  }

  const filePath = credentialPath(activeTenantScope());
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, encryptPayload({ apiKey, token }), 'utf-8');
}

export async function clearTrelloCredentials(): Promise<void> {
  try {
    await unlink(credentialPath(activeTenantScope()));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
  }
}

export function trelloConfigHint(): string {
  return 'Trello is not configured. Open /trello or Settings and add your API key and token, or set TRELLO_API_KEY and TRELLO_TOKEN in .env. Get them at https://trello.com/app-key';
}
