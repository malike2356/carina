import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';

function resolveKey(): Buffer | null {
  const hex = process.env.CHANNEL_CREDENTIAL_KEY?.trim();
  if (!hex || hex.length !== 64) return null;
  return Buffer.from(hex, 'hex');
}

export function credentialsConfigured(): boolean {
  return resolveKey() !== null;
}

export function encryptCredentials(obj: Record<string, string>): string {
  const key = resolveKey();
  if (!key) {
    throw new Error('CHANNEL_CREDENTIAL_KEY is not configured (32-byte hex required)');
  }
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const plaintext = JSON.stringify(obj);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

export function decryptCredentials(blob: string): Record<string, string> {
  const key = resolveKey();
  if (!key) {
    throw new Error('CHANNEL_CREDENTIAL_KEY is not configured (32-byte hex required)');
  }
  const buf = Buffer.from(blob, 'base64');
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const encrypted = buf.subarray(28);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return JSON.parse(decrypted.toString('utf8')) as Record<string, string>;
}

export function packCredentials(raw: Record<string, string>): { encrypted: string } {
  return { encrypted: encryptCredentials(raw) };
}

export function unpackCredentials(stored: { encrypted?: string } | null | undefined): Record<string, string> {
  if (!stored?.encrypted) return {};
  return decryptCredentials(stored.encrypted);
}
