import { logSelfModEvent } from '../security/self-mod-logger.js';

let allowedDomains: string[] = [];

export function setAllowedDomains(domains: string[]): void {
  allowedDomains = domains.map((d) => d.trim().toLowerCase()).filter(Boolean);
}

export function getAllowedDomains(): string[] {
  return [...allowedDomains];
}

export function isFetchAllowed(url: string): boolean {
  if (allowedDomains.length === 0) return false;

  try {
    const { hostname } = new URL(url);
    return allowedDomains.includes(hostname.toLowerCase());
  } catch {
    return false;
  }
}

export function createGatedFetch(domainsForTool: string[]): typeof fetch {
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    let hostname: string;

    try {
      hostname = new URL(url).hostname.toLowerCase();
    } catch {
      throw new Error(`Fetch blocked: invalid URL "${url}".`);
    }

    const allowed = domainsForTool.map((d) => d.trim().toLowerCase());
    if (!allowed.includes(hostname)) {
      void logSelfModEvent('TOOL_FETCH_DENIED', {
        attempted_domain: hostname,
        allowed_domains: allowed,
        action_taken: 'Fetch request blocked.',
      });
      throw new Error(
        `Fetch blocked: "${hostname}" is not in the allowed domain list [${allowed.join(', ') || 'none'}]. ` +
          `Grant access at persistence time via fetch_allowed_domains.`,
      );
    }

    return fetch(input, init);
  };
}
