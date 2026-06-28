import { credentialStore } from './credential-store.js';
import { isEncryptionAvailable } from './encryption.js';
import type { CredentialStatus } from './types.js';

export async function resolveCredential(keyName: string): Promise<string | null> {
  if (isEncryptionAvailable()) {
    try {
      const stored = await credentialStore.get(keyName);
      if (stored) return stored;
    } catch {
      // Store unavailable - fall through to env
    }
  }

  const envValue = process.env[keyName];
  if (envValue !== undefined && envValue !== '') return envValue;

  return null;
}

export function resolveCredentialSync(keyName: string): string | null {
  const envValue = process.env[keyName];
  if (envValue !== undefined && envValue !== '') return envValue;
  return null;
}

export async function getCredentialStatus(keyName: string): Promise<CredentialStatus> {
  if (isEncryptionAvailable()) {
    try {
      const exists = await credentialStore.exists(keyName);
      if (exists) {
        const value = await credentialStore.get(keyName);
        return {
          service: keyName,
          key_name: keyName,
          configured: true,
          source: 'store',
          masked_value: value ? maskValue(value) : undefined,
        };
      }
    } catch { /* fall through */ }
  }

  const envValue = process.env[keyName];
  if (envValue !== undefined && envValue !== '') {
    return {
      service: keyName,
      key_name: keyName,
      configured: true,
      source: 'env',
      masked_value: maskValue(envValue),
    };
  }

  return {
    service: keyName,
    key_name: keyName,
    configured: false,
    source: 'none',
  };
}

function maskValue(value: string): string {
  if (value.length <= 8) return '***';
  return value.substring(0, 4) + '***' + value.substring(value.length - 4);
}
