function isBlockedHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === 'localhost' || h === '127.0.0.1' || h === '::1') return true;
  if (h.startsWith('10.')) return true;
  if (h.startsWith('192.168.')) return true;
  if (h.startsWith('172.') && /^172\.(1[6-9]|2\d|3[01])\./.test(h)) return true;
  return false;
}

export async function assertNavigationAllowed(url: string): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('Invalid URL.');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`Blocked protocol: ${parsed.protocol}. Only http(s) allowed.`);
  }

  if (isBlockedHost(parsed.hostname)) {
    throw new Error('Navigation to internal or localhost addresses is blocked.');
  }

  return parsed;
}
