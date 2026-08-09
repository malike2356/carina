/** SSRF defenses for Document Vault URL imports (prompt 714). */

import { VaultError } from '../errors.js';

export function assertSafeFetchUrl(url: string): string {
  const raw = String(url || '').trim();
  if (!raw) throw new VaultError('url required', 'invalid_args');
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new VaultError('invalid url', 'ssrf_blocked');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new VaultError('only http/https URLs allowed', 'ssrf_blocked');
  }
  const host = (parsed.hostname || '').trim().toLowerCase();
  if (!host) throw new VaultError('url host required', 'ssrf_blocked');

  const blocked = new Set([
    'localhost',
    '127.0.0.1',
    '0.0.0.0',
    '::1',
    'metadata.google.internal',
    '169.254.169.254',
  ]);
  if (blocked.has(host) || host.endsWith('.local') || host.endsWith('.internal')) {
    throw new VaultError(`host ${host} is not allowed`, 'ssrf_blocked');
  }
  if (host.startsWith('10.') || host.startsWith('192.168.') || host.startsWith('169.254.')) {
    throw new VaultError(`host ${host} is not allowed`, 'ssrf_blocked');
  }
  if (host.startsWith('172.')) {
    const second = Number(host.split('.')[1]);
    if (Number.isFinite(second) && second >= 16 && second <= 31) {
      throw new VaultError(`host ${host} is not allowed`, 'ssrf_blocked');
    }
  }
  return raw;
}
