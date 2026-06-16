import crypto from 'node:crypto';

const VAULT_SALT = 'carina-vault-v1';

function deriveKey(workspaceId: string): Buffer {
  const secret = process.env.VAULT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('VAULT_SECRET must be at least 32 characters');
  }
  return crypto.scryptSync(secret, `${workspaceId}:${VAULT_SALT}`, 32);
}

export function encryptKey(
  plaintext: string,
  workspaceId: string,
): { encrypted: string; iv: string; tag: string } {
  const iv = crypto.randomBytes(12);
  const key = deriveKey(workspaceId);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    encrypted: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
  };
}

export function decryptKey(
  encrypted: string,
  iv: string,
  tag: string,
  workspaceId: string,
): string {
  const key = deriveKey(workspaceId);
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    key,
    Buffer.from(iv, 'base64'),
  );
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encrypted, 'base64')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}

export function maskKeyHint(plaintext: string): string {
  const trimmed = plaintext.trim();
  if (trimmed.length <= 4) return '****';
  return trimmed.slice(-4);
}
