import { getCredentialPoolManager } from '../credentials/pool-manager.js';

export class CredentialPool {
  private index = 0;

  constructor(private readonly keys: string[]) {
    this.keys = keys.filter((k) => k.trim().length > 0);
  }

  get size(): number {
    return this.keys.length;
  }

  next(): string {
    if (this.keys.length === 0) return '';
    const key = this.keys[this.index % this.keys.length];
    this.index++;
    return key;
  }

  peek(): string {
    if (this.keys.length === 0) return '';
    return this.keys[this.index % this.keys.length];
  }
}

export function parseKeyPool(envValue: string | undefined): CredentialPool {
  if (!envValue) return new CredentialPool([]);
  const keys = envValue.split(',').map((k) => k.trim()).filter(Boolean);
  return new CredentialPool(keys);
}

export function resolveApiKey(
  singleKey: string,
  poolEnv?: string,
  provider?: string,
): string {
  if (provider) {
    return getCredentialPoolManager().nextKey(provider, singleKey, poolEnv);
  }
  const pool = parseKeyPool(poolEnv);
  if (pool.size > 0) return pool.next();
  return singleKey;
}
