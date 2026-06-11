const DEFAULT_ALLOWED_DOMAINS = [
  'api.search.brave.com',
  'api.tavily.com',
  'api.openai.com',
  'api.anthropic.com',
  'api.deepseek.com',
  'api.resend.com',
  'api.telegram.org',
  'api.twilio.com',
  'api.propertydata.co.uk',
  'generativelanguage.googleapis.com',
  '*.carinaai.uk',
  '*.github.com',
  'github.com',
] as const;

const SENSITIVE_PATTERNS = [
  { pattern: /sk-[A-Za-z0-9]{48}/, name: 'openai_key' },
  { pattern: /sk-ant-api[0-9A-Za-z\-_]{100,}/, name: 'anthropic_key' },
  { pattern: /sk-[a-f0-9]{32}/, name: 'deepseek_key' },
  { pattern: /-----BEGIN (RSA|OPENSSH|PGP) PRIVATE KEY-----/, name: 'private_key' },
  { pattern: /ghp_[A-Za-z0-9]{36}/, name: 'github_token' },
  { pattern: /re_[A-Za-z0-9_]{32,}/, name: 'resend_key' },
  { pattern: /Authorization:\s*Bearer\s+[A-Za-z0-9._-]+/i, name: 'bearer_token' },
] as const;

export class EgressBlockedError extends Error {
  constructor(
    public readonly url: string,
    public readonly hostname: string,
  ) {
    super(`Egress blocked: hostname '${hostname}' is not in the allowlist`);
    this.name = 'EgressBlockedError';
  }
}

export class DataLeakError extends Error {
  constructor(public readonly patternName: string) {
    super(`Data leak detected: pattern '${patternName}' found in request body`);
    this.name = 'DataLeakError';
  }
}

export type EgressReportFn = (
  eventType: string,
  severity: string,
  meta: Record<string, unknown>,
) => Promise<void>;

export interface EgressFilterOptions {
  allowedDomains?: string[];
  scoutBaseUrl?: string | null;
  scoutApiKey?: string | null;
  instanceId?: string;
  reportFn?: EgressReportFn;
}

function mergeAllowedDomains(extra?: string): string[] {
  const fromEnv = extra
    ? extra.split(',').map((s) => s.trim()).filter(Boolean)
    : [];
  return [...new Set([...DEFAULT_ALLOWED_DOMAINS, ...fromEnv])];
}

function resolveScoutBaseUrl(): string | null {
  const url = process.env.SCOUT_BASE_URL ?? process.env.LABYRINTH_URL ?? '';
  return url.trim() || null;
}

function resolveScoutApiKey(): string | null {
  const key = process.env.SCOUT_API_KEY ?? process.env.LABYRINTH_API_KEY ?? '';
  return key.trim() || null;
}

export class EgressFilter {
  private readonly allowedDomains: string[];
  private readonly scoutBaseUrl: string | null;
  private readonly scoutApiKey: string | null;
  private readonly instanceId: string;
  private readonly reportFn: EgressReportFn;

  constructor(options: EgressFilterOptions = {}) {
    this.allowedDomains = options.allowedDomains ?? mergeAllowedDomains(process.env.SCOUT_ALLOWED_DOMAINS);
    this.scoutBaseUrl = options.scoutBaseUrl !== undefined ? options.scoutBaseUrl : resolveScoutBaseUrl();
    this.scoutApiKey = options.scoutApiKey !== undefined ? options.scoutApiKey : resolveScoutApiKey();
    this.instanceId =
      options.instanceId ??
      process.env.SCOUT_INSTANCE_ID ??
      process.env.LABYRINTH_INSTANCE_ID ??
      'carina-local';
    this.reportFn = options.reportFn ?? ((eventType, severity, meta) => this.reportToScout(eventType, severity, meta));
  }

  isAllowed(url: string): boolean {
    let hostname: string;
    try {
      hostname = new URL(url).hostname.toLowerCase();
    } catch {
      return false;
    }

    for (const entry of this.allowedDomains) {
      if (entry.startsWith('*.')) {
        const base = entry.slice(2).toLowerCase();
        if (hostname.endsWith('.' + base)) return true;
        continue;
      }
      if (hostname === entry.toLowerCase()) return true;
    }
    return false;
  }

  async scanForSensitiveData(content: string): Promise<{ found: boolean; patternName?: string }> {
    for (const match of SENSITIVE_PATTERNS) {
      if (match.pattern.test(content)) {
        return { found: true, patternName: match.name };
      }
    }
    return { found: false };
  }

  async checkRequest(url: string, body?: string): Promise<void> {
    let hostname: string;
    try {
      hostname = new URL(url).hostname;
    } catch {
      hostname = url;
    }

    if (!this.isAllowed(url)) {
      await this.reportFn('egress_blocked', 'critical', { url, hostname });
      throw new EgressBlockedError(url, hostname);
    }

    if (body !== undefined) {
      const scan = await this.scanForSensitiveData(body);
      if (scan.found && scan.patternName) {
        await this.reportFn('data_leak_outbound', 'critical', { patternName: scan.patternName, url });
        throw new DataLeakError(scan.patternName);
      }
    }
  }

  async checkResponse(url: string, body: string): Promise<void> {
    const scan = await this.scanForSensitiveData(body);
    if (scan.found && scan.patternName) {
      await this.reportFn('data_leak_inbound', 'critical', { patternName: scan.patternName, url });
    }
  }

  private async reportToScout(
    eventType: string,
    severity: string,
    meta: Record<string, unknown>,
  ): Promise<void> {
    if (!this.scoutBaseUrl) {
      console.warn('[egress-filter] Scout URL not configured; event not reported:', eventType, meta);
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.scoutApiKey) {
      headers['X-Scout-Key'] = this.scoutApiKey;
    }

    try {
      await fetch(`${this.scoutBaseUrl}/api/events`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          instance_id: this.instanceId,
          event_type: eventType,
          severity,
          source: 'egress-filter',
          description: `Egress filter: ${eventType}`,
          metadata: meta,
          session_id: typeof meta.sessionId === 'string' ? meta.sessionId : 'system',
        }),
        signal: controller.signal,
      });
    } catch {
      // Reporting must never crash the agent.
    } finally {
      clearTimeout(timeout);
    }
  }
}

export const egressFilter = new EgressFilter();
