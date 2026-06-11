import fs from 'fs';
import path from 'path';
import { CARINA_HOME } from '../config/paths.js';
import type { CredentialsFile, OAuthTokenRecord, ProviderPoolState } from './types.js';

export function credentialsFilePath(): string {
  return process.env.CARINA_CREDENTIALS_FILE ?? path.join(CARINA_HOME, 'credentials.json');
}

/** @deprecated use credentialsFilePath() */
export const CREDENTIALS_FILE = credentialsFilePath();

const EMPTY: CredentialsFile = { version: 1, pools: {}, oauth: {} };

export function loadCredentialsFile(filePath?: string): CredentialsFile {
  const resolved = filePath ?? credentialsFilePath();
  if (!fs.existsSync(resolved)) return { ...EMPTY, pools: {}, oauth: {} };
  try {
    const raw = JSON.parse(fs.readFileSync(resolved, 'utf-8')) as Partial<CredentialsFile>;
    return {
      version: 1,
      pools: raw.pools ?? {},
      oauth: raw.oauth ?? {},
    };
  } catch {
    return { ...EMPTY, pools: {}, oauth: {} };
  }
}

export function saveCredentialsFile(data: CredentialsFile, filePath?: string): void {
  const resolved = filePath ?? credentialsFilePath();
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, JSON.stringify(data, null, 2), { mode: 0o600 });
}

export function getProviderPool(provider: string, filePath?: string): ProviderPoolState | null {
  return loadCredentialsFile(filePath).pools[provider] ?? null;
}

export function setProviderPool(provider: string, pool: ProviderPoolState, filePath?: string): void {
  const data = loadCredentialsFile(filePath);
  data.pools[provider] = pool;
  saveCredentialsFile(data, filePath);
}

export function getOAuthToken(provider: string, filePath?: string): OAuthTokenRecord | null {
  return loadCredentialsFile(filePath).oauth[provider] ?? null;
}

export function setOAuthToken(provider: string, token: OAuthTokenRecord, filePath?: string): void {
  const data = loadCredentialsFile(filePath);
  data.oauth[provider] = token;
  saveCredentialsFile(data, filePath);
}

export function deleteOAuthToken(provider: string, filePath?: string): void {
  const data = loadCredentialsFile(filePath);
  delete data.oauth[provider];
  saveCredentialsFile(data, filePath);
}

export function redactSecret(value: string): string {
  if (!value) return '(empty)';
  if (value.length <= 8) return '***';
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}
