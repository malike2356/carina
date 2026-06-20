import dns from 'node:dns/promises';

const DOMAIN_RE = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;
const BLOCKED_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1']);

export function normalizeDomain(input: string): string | null {
  const trimmed = input.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  if (!trimmed || trimmed.length > 253) return null;
  if (BLOCKED_HOSTS.has(trimmed)) return null;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(trimmed)) return null;
  if (trimmed.startsWith('10.') || trimmed.startsWith('192.168.') || trimmed.startsWith('172.')) {
    return null;
  }
  if (!DOMAIN_RE.test(trimmed)) return null;
  return trimmed;
}

export async function resolveDomain(domain: string): Promise<string | null> {
  try {
    const records = await dns.resolve4(domain);
    const ip = records[0];
    if (!ip) return null;
    if (ip.startsWith('10.') || ip.startsWith('192.168.') || ip.startsWith('127.')) {
      return null;
    }
    return ip;
  } catch {
    return null;
  }
}

export function clientIp(req: { ip?: string; headers?: Record<string, string | string[] | undefined> }): string {
  const forwarded = req.headers?.['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0]!.trim();
  }
  return req.ip ?? 'unknown';
}
