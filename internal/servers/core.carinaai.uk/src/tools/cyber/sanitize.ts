const UNSAFE = /[;&|`$<>]/;

export function sanitizeTarget(raw: unknown): string | { error: string } {
  const target = String(raw ?? '').trim();
  if (!target || target.length > 512) {
    return { error: 'target is required and must be under 512 characters' };
  }
  if (UNSAFE.test(target)) {
    return { error: 'target contains invalid characters' };
  }
  return target;
}

export function sanitizeDomain(raw: unknown): string | { error: string } {
  const domain = String(raw ?? '').trim().toLowerCase();
  if (!domain || domain.length > 253) {
    return { error: 'domain is required and must be under 253 characters' };
  }
  if (UNSAFE.test(domain) || !/^[a-z0-9.*_-]+(\.[a-z0-9.*_-]+)*$/i.test(domain)) {
    return { error: 'domain format is invalid' };
  }
  return domain;
}

export function sanitizeUsername(raw: unknown): string | { error: string } {
  const username = String(raw ?? '').trim();
  if (!username || username.length > 128) {
    return { error: 'username is required and must be under 128 characters' };
  }
  if (UNSAFE.test(username) || !/^[a-zA-Z0-9._-]+$/.test(username)) {
    return { error: 'username format is invalid' };
  }
  return username;
}

export function sanitizeUrl(raw: unknown): string | { error: string } {
  const url = String(raw ?? '').trim();
  if (!url || url.length > 2048) {
    return { error: 'url is required and must be under 2048 characters' };
  }
  if (UNSAFE.test(url)) {
    return { error: 'url contains invalid characters' };
  }
  if (!/^https?:\/\//i.test(url)) {
    return { error: 'url must start with http:// or https://' };
  }
  return url;
}

export function sanitizePath(raw: unknown): string | { error: string } {
  const path = String(raw ?? '').trim();
  if (!path || path.length > 512) {
    return { error: 'path is required and must be under 512 characters' };
  }
  if (UNSAFE.test(path) || path.includes('..')) {
    return { error: 'path contains invalid characters' };
  }
  return path;
}

export function sanitizeInterface(raw: unknown): string | { error: string } {
  const iface = String(raw ?? '').trim();
  if (!iface || iface.length > 32) {
    return { error: 'interface is required and must be under 32 characters' };
  }
  if (!/^[a-zA-Z0-9._-]+$/.test(iface)) {
    return { error: 'interface format is invalid' };
  }
  return iface;
}

export function sanitizeBssid(raw: unknown): string | { error: string } {
  const bssid = String(raw ?? '').trim().toLowerCase();
  if (!/^[0-9a-f]{2}(:[0-9a-f]{2}){5}$/.test(bssid)) {
    return { error: 'BSSID must be AA:BB:CC:DD:EE:FF format' };
  }
  return bssid;
}

export function sanitizeEttercapTarget(raw: unknown): string | { error: string } {
  const input = String(raw ?? '').trim().replace(/\//g, '');
  if (!input || input.length > 64) {
    return { error: 'target is required and must be under 64 characters' };
  }
  if (UNSAFE.test(input)) {
    return { error: 'target contains invalid characters' };
  }
  if (!/^(?:\d{1,3}\.){3}\d{1,3}(?:\/\d{1,2})?$/.test(input)) {
    return { error: 'target must be an IPv4 address or CIDR' };
  }
  return `/${input}/`;
}

export function sanitizeBlockDevice(raw: unknown): string | { error: string } {
  const device = String(raw ?? '').trim();
  if (!device || device.length > 64) {
    return { error: 'device is required and must be under 64 characters' };
  }
  if (!/^\/dev\/[a-zA-Z0-9._-]+$/.test(device)) {
    return { error: 'device must be a block device path like /dev/sda' };
  }
  return device;
}

export function sanitizePacketFilter(raw: unknown): string | { error: string } {
  const filter = String(raw ?? '').trim();
  if (!filter || filter.length > 512) {
    return { error: 'filter is required and must be under 512 characters' };
  }
  if (UNSAFE.test(filter)) {
    return { error: 'filter contains invalid characters' };
  }
  return filter;
}

export function normalizeScanUrl(raw: unknown): string | { error: string } {
  const input = String(raw ?? '').trim();
  if (!input || input.length > 2048) {
    return { error: 'target is required and must be under 2048 characters' };
  }
  if (UNSAFE.test(input)) {
    return { error: 'target contains invalid characters' };
  }
  if (/^https?:\/\//i.test(input)) {
    const url = sanitizeUrl(input);
    return typeof url === 'string' ? url : url;
  }
  if (/^[a-zA-Z0-9.*_-]+(\.[a-zA-Z0-9.*_-]+)*$/.test(input) || /^(?:\d{1,3}\.){3}\d{1,3}(?:\/\d{1,2})?$/.test(input)) {
    return `https://${input}`;
  }
  return { error: 'target must be a URL, hostname, IP, or CIDR' };
}

export function parseSeverityList(raw: unknown): string {
  if (Array.isArray(raw)) {
    return raw.map((item) => String(item).trim().toLowerCase()).filter(Boolean).join(',');
  }
  if (typeof raw === 'string' && raw.trim()) {
    return raw.split(',').map((item) => item.trim().toLowerCase()).filter(Boolean).join(',');
  }
  return 'critical,high,medium';
}

export function sanitizeWindowsUser(raw: unknown): string | { error: string } {
  const user = String(raw ?? '').trim();
  if (!user || user.length > 256) {
    return { error: 'username is required and must be under 256 characters' };
  }
  if (/[;&|`$<>]/.test(user)) {
    return { error: 'username contains invalid characters' };
  }
  return user;
}

export function sanitizeNtlmHash(raw: unknown): string | { error: string } {
  const hash = String(raw ?? '').trim();
  if (!/^[a-fA-F0-9]{32}$/.test(hash)) {
    return { error: 'NTLM hash must be 32 hex characters' };
  }
  return hash.toLowerCase();
}

export function sanitizeMsfModule(raw: unknown): string | { error: string } {
  const module = String(raw ?? '').trim();
  if (!module || module.length > 256) {
    return { error: 'module path is required' };
  }
  if (!/^[a-zA-Z0-9_/]+$/.test(module)) {
    return { error: 'module path contains invalid characters' };
  }
  return module;
}

export function clampInt(raw: unknown, fallback: number, min: number, max: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

export function tokenizeOptions(raw: unknown): string[] | { error: string } {
  const input = String(raw ?? '').trim();
  if (!input) return [];

  const tokens: string[] = [];
  let current = '';
  let quote: '"' | "'" | null = null;

  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i]!;
    if (quote) {
      if (ch === quote) {
        quote = null;
        continue;
      }
      current += ch;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (/\s/.test(ch)) {
      if (current) {
        tokens.push(current);
        current = '';
      }
      continue;
    }
    if (UNSAFE.test(ch)) {
      return { error: 'options contain invalid characters' };
    }
    current += ch;
  }

  if (quote) return { error: 'unclosed quote in options' };
  if (current) tokens.push(current);
  return tokens;
}
