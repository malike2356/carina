import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

const ENC_PREFIX = 'enc:v1:';
const ALGO = 'aes-256-gcm';

function encryptionKey(): Buffer {
  const raw =
    process.env.SCOUT_CONFIG_ENCRYPTION_KEY ||
    process.env.SCOUT_SESSION_SECRET ||
    process.env.SCOUT_API_KEY ||
    'scout-local-dev-encryption-fallback';
  return createHash('sha256').update(raw).digest();
}

export function encryptSecret(plaintext: string): string {
  if (!plaintext) return '';
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  const payload = Buffer.concat([iv, tag, encrypted]).toString('base64url');
  return `${ENC_PREFIX}${payload}`;
}

export function decryptSecret(stored: string): string {
  if (!stored) return '';
  if (!stored.startsWith(ENC_PREFIX)) return stored;
  const raw = Buffer.from(stored.slice(ENC_PREFIX.length), 'base64url');
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const data = raw.subarray(28);
  const decipher = createDecipheriv(ALGO, encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

export function maskSecret(value: string | undefined): string {
  if (!value) return '';
  const plain = value.startsWith(ENC_PREFIX) ? '********' : value;
  if (plain.length <= 8) return '********';
  return `${plain.slice(0, 4)}...${plain.slice(-4)}`;
}
