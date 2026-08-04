const DEFAULT_ALLOWED_DOMAINS: readonly string[] = [
  // Search providers
  'api.search.brave.com',
  'api.tavily.com',

  // LLM providers - all 23 explicitly named, no wildcards
  'api.openai.com',
  'api.anthropic.com',
  'api.deepseek.com',
  'api.groq.com',
  'openrouter.ai',
  'api.openrouter.ai',
  'generativelanguage.googleapis.com',
  'api.together.xyz',
  'api.mistral.ai',
  'api.cohere.com',
  'api.perplexity.ai',
  'api.replicate.com',
  'api-inference.huggingface.co',
  'api.elevenlabs.io',
  'api.fal.ai',
  'vllm.carinaai.uk',

  // Image generation
  'comfyui.carinaai.uk',

  // Messaging channels
  'api.telegram.org',
  'api.twilio.com',
  'slack.com',
  'api.slack.com',
  'discord.com',
  'discordapp.com',
  'graph.facebook.com',
  'matrix.org',
  '_matrix.carinaai.uk',
  'api.line.me',
  'api.viber.com',

  // Email
  'api.resend.com',
  'smtp.resend.com',

  // Property and business data
  'api.propertydata.co.uk',

  // GitHub - explicit paths only (no wildcard)
  'api.github.com',
  'raw.githubusercontent.com',
  'objects.githubusercontent.com',

  // Carina Aiva own services - explicit subdomains only
  'telemetry.carinaai.uk',
  'hub.carinaai.uk',
  'install.carinaai.uk',
  'docs.carinaai.uk',
  'api.carinaai.uk',

  // Scout (Labyrinth)
  'console.labyrinthscout.com',
  'api.labyrinthscout.com',

  // Threat intelligence (used by cyber tools)
  'www.virustotal.com',
  'api.abuseipdb.com',
  'otx.alienvault.com',
  'api.greynoise.io',
  'urlhaus-api.abuse.ch',

  // npm (for supply chain check tool)
  'registry.npmjs.org',
];

const SENSITIVE_PATTERNS: ReadonlyArray<{ pattern: RegExp; name: string }> = [
  // OpenAI
  { pattern: /sk-[A-Za-z0-9]{48}/, name: 'openai_key' },
  { pattern: /sk-proj-[A-Za-z0-9_\-]{80,}/, name: 'openai_project_key' },

  // Anthropic
  { pattern: /sk-ant-api[0-9A-Za-z\-_]{95,}/, name: 'anthropic_key' },

  // DeepSeek
  { pattern: /sk-[a-f0-9]{32}(?![A-Za-z0-9])/, name: 'deepseek_key' },

  // Groq
  { pattern: /gsk_[A-Za-z0-9]{52}/, name: 'groq_key' },

  // OpenRouter
  { pattern: /sk-or-v1-[a-f0-9]{64}/, name: 'openrouter_key' },

  // Google Gemini / GCP
  { pattern: /AIza[0-9A-Za-z\-_]{35}/, name: 'google_api_key' },

  // Together AI
  { pattern: /[a-f0-9]{64}(?=["'\s])/, name: 'together_key_candidate' },

  // Mistral
  { pattern: /[A-Za-z0-9]{32}(?=["'\s])/, name: 'mistral_key_candidate' },

  // HuggingFace
  { pattern: /hf_[A-Za-z0-9]{34}/, name: 'huggingface_token' },

  // Cohere
  { pattern: /co-[A-Za-z0-9]{40}/, name: 'cohere_key' },

  // Perplexity
  { pattern: /pplx-[a-f0-9]{48}/, name: 'perplexity_key' },

  // ElevenLabs
  { pattern: /[a-f0-9]{32}(?=["'\s])/, name: 'elevenlabs_key_candidate' },

  // GitHub
  { pattern: /ghp_[A-Za-z0-9]{36}/, name: 'github_pat' },
  { pattern: /gho_[A-Za-z0-9]{36}/, name: 'github_oauth_token' },
  { pattern: /ghs_[A-Za-z0-9]{36}/, name: 'github_server_token' },
  { pattern: /ghr_[A-Za-z0-9]{36}/, name: 'github_refresh_token' },

  // Resend
  { pattern: /re_[A-Za-z0-9_]{32,}/, name: 'resend_key' },

  // Stripe
  { pattern: /sk_live_[0-9a-zA-Z]{24,}/, name: 'stripe_live_key' },
  { pattern: /sk_test_[0-9a-zA-Z]{24,}/, name: 'stripe_test_key' },
  { pattern: /rk_live_[0-9a-zA-Z]{24,}/, name: 'stripe_restricted_key' },

  // Twilio
  { pattern: /SK[a-f0-9]{32}/, name: 'twilio_api_key' },
  { pattern: /AC[a-f0-9]{32}/, name: 'twilio_account_sid' },

  // AWS
  { pattern: /AKIA[0-9A-Z]{16}/, name: 'aws_access_key' },
  { pattern: /(?<![A-Za-z0-9\/+])[A-Za-z0-9\/+]{40}(?![A-Za-z0-9\/+])/, name: 'aws_secret_candidate' },

  // Private keys (PEM format)
  {
    pattern: /-----BEGIN (RSA |EC |OPENSSH |PGP |PRIVATE KEY|DSA )PRIVATE KEY-----/,
    name: 'private_key_pem',
  },

  // Database URLs with embedded credentials
  { pattern: /postgres:\/\/[^:]+:[^@]{3,}@/, name: 'postgres_url_with_password' },
  { pattern: /mysql:\/\/[^:]+:[^@]{3,}@/, name: 'mysql_url_with_password' },
  { pattern: /redis:\/\/:[^@]{3,}@/, name: 'redis_url_with_auth' },

  // JWT tokens (three base64url segments)
  {
    pattern: /eyJ[A-Za-z0-9_\-]{10,}\.eyJ[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}/,
    name: 'jwt_token',
  },

  // Bearer tokens in headers
  { pattern: /Authorization:\s*Bearer\s+[A-Za-z0-9._\-]{20,}/i, name: 'bearer_token' },

  // Generic high-entropy secrets (long random strings in env var context)
  {
    pattern: /(?:SECRET|PASSWORD|API_KEY|TOKEN|PRIVATE_KEY)\s*=\s*['"]?[A-Za-z0-9+\/=_\-]{32,}['"]?/i,
    name: 'generic_env_secret',
  },
];

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

function resolveExtraDomains(): string | undefined {
  return process.env.CARINA_EGRESS_EXTRA_DOMAINS ?? process.env.SCOUT_ALLOWED_DOMAINS;
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
    this.allowedDomains = options.allowedDomains ?? mergeAllowedDomains(resolveExtraDomains());
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

  private isPathAllowed(url: string): boolean {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return false;
    }

    const hostname = parsed.hostname.toLowerCase();
    const path = parsed.pathname.toLowerCase();

    if (hostname === 'api.github.com') {
      return /^\/(repos|user|orgs|search|rate_limit|meta|gists\/public)/.test(path);
    }
    if (hostname === 'raw.githubusercontent.com') {
      return /^\/malike2356\//.test(path);
    }
    if (hostname === 'objects.githubusercontent.com') {
      return path.startsWith('/github-production-release-asset');
    }

    return true;
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

    if (!this.isAllowed(url) || !this.isPathAllowed(url)) {
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
