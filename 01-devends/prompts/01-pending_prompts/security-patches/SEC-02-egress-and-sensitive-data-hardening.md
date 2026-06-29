# SEC-02: Egress Filter and Sensitive Data Pattern Hardening

**Severity:** Critical
**Status:** Unpatched - wildcard domains active, 7 of 23+ provider keys missing
**Affects:** core.carinaai.uk, console.labyrinthscout.com, carina-agent-public SDK

## Problem 1: Wildcard Egress Domains

`DEFAULT_ALLOWED_DOMAINS` contains two wildcards:
- `*.github.com` - allows ANY github.com subdomain. An attacker only needs to
  create a GitHub repo or Gist and route the agent there to bypass the filter.
  `attacker.github.io`, `raw.githubusercontent.com/attacker/...`, GitHub Actions
  artifact URLs, Pages sites, and Gist CDN URLs all match this wildcard.
- `*.${config.product.domain}` - allows any subdomain of carinaai.uk. If an
  attacker can create or compromise any subdomain (via DNS takeover, dangling CNAME,
  or a path on a legitimate subdomain), the egress filter offers no protection.

## Problem 2: Missing Sensitive Data Patterns

Only 7 of the 23+ LLM provider API keys are in `SENSITIVE_PATTERNS`. Missing:
Groq, OpenRouter, Together AI, Gemini, Mistral, HuggingFace, Cohere, Perplexity,
ElevenLabs, plus infrastructure keys (Stripe, AWS if used, PostgreSQL URL with password, JWTs).

## Files to Patch (apply to all three copies)

```
02-backends/core.carinaai.uk/src/security/egress-filter.ts
02-backends/console.labyrinthscout.com/src/security/egress-filter.ts
03-frontends/sdks/carina-agent-public/src/security/egress-filter.ts
```

## Replacement for DEFAULT_ALLOWED_DOMAINS

Replace the current DEFAULT_ALLOWED_DOMAINS block with:

```typescript
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
  'vllm.carinaai.uk',          // self-hosted vLLM if deployed on the product domain

  // Image generation
  'api.openai.com',             // DALL-E (already listed - deduped at runtime)
  'comfyui.carinaai.uk',        // self-hosted ComfyUI

  // Messaging channels
  'api.telegram.org',
  'api.twilio.com',
  'slack.com',
  'api.slack.com',
  'discord.com',
  'discordapp.com',
  'graph.facebook.com',         // WhatsApp Cloud API
  'matrix.org',
  '_matrix.carinaai.uk',        // self-hosted Matrix if used
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
```

## Replacement for SENSITIVE_PATTERNS

Replace the current SENSITIVE_PATTERNS block with:

```typescript
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
  { pattern: /-----BEGIN (RSA |EC |OPENSSH |PGP |PRIVATE KEY|DSA )PRIVATE KEY-----/, name: 'private_key_pem' },

  // Database URLs with embedded credentials
  { pattern: /postgres:\/\/[^:]+:[^@]{3,}@/, name: 'postgres_url_with_password' },
  { pattern: /mysql:\/\/[^:]+:[^@]{3,}@/, name: 'mysql_url_with_password' },
  { pattern: /redis:\/\/:[^@]{3,}@/, name: 'redis_url_with_auth' },

  // JWT tokens (three base64url segments)
  { pattern: /eyJ[A-Za-z0-9_\-]{10,}\.eyJ[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}/, name: 'jwt_token' },

  // Bearer tokens in headers
  { pattern: /Authorization:\s*Bearer\s+[A-Za-z0-9._\-]{20,}/i, name: 'bearer_token' },

  // Generic high-entropy secrets (long random strings in env var context)
  { pattern: /(?:SECRET|PASSWORD|API_KEY|TOKEN|PRIVATE_KEY)\s*=\s*['"]?[A-Za-z0-9+\/=_\-]{32,}['"]?/i, name: 'generic_env_secret' },
];
```

## Additional Change: Path-Level Checking for GitHub

After the hostname check in `checkRequest`, add path-level filtering for
GitHub to prevent access to arbitrary user content even on allowed hostnames.

Add this method to the `EgressFilter` class:

```typescript
private isPathAllowed(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  const hostname = parsed.hostname.toLowerCase();
  const path = parsed.pathname.toLowerCase();

  // GitHub: allow only API and specific raw content paths
  if (hostname === 'api.github.com') {
    // Allow: /repos/, /user, /search, /rate_limit, /meta
    return /^\/(repos|user|orgs|search|rate_limit|meta|gists\/public)/.test(path);
  }
  if (hostname === 'raw.githubusercontent.com') {
    // Allow malike2356-owned repos only (both carina-aiva and carina-mutant).
    return /^\/malike2356\//.test(path);
  }
  if (hostname === 'objects.githubusercontent.com') {
    // Release artifacts only
    return path.startsWith('/github-production-release-asset');
  }

  return true; // no path restriction for other domains
}
```

Then call it in `checkRequest`:
```typescript
if (!this.isAllowed(url) || !this.isPathAllowed(url)) {
  await this.reportFn('egress_blocked', 'critical', { url, hostname });
  throw new EgressBlockedError(url, hostname);
}
```

## Verification

```bash
# Verify no wildcards remain in any of the three copies
grep -n "\*\." \
  02-backends/core.carinaai.uk/src/security/egress-filter.ts \
  02-backends/console.labyrinthscout.com/src/security/egress-filter.ts \
  03-frontends/sdks/carina-agent-public/src/security/egress-filter.ts
# Must return no output

# Count sensitive patterns
cat 02-backends/core.carinaai.uk/src/security/egress-filter.ts \
  | grep -c "name: '"
# Must be >= 25

# Run existing egress filter tests
cd 02-backends/core.carinaai.uk && pnpm test -- egress 2>&1

# Manual smoke test: verify GitHub wildcard is gone
node -e "
const {EgressFilter} = await import('./dist/src/security/egress-filter.js');
const f = new EgressFilter();
console.assert(!f.isAllowed('https://attacker.github.io/payload'), 'FAIL: attacker.github.io allowed');
console.assert(f.isAllowed('https://api.github.com/repos'), 'FAIL: api.github.com blocked');
console.log('PASS');
"
```

## Deployment

1. Apply to all three copies.
2. Add new env var `CARINA_EGRESS_EXTRA_DOMAINS` to `.env.production.example`
   so operators can add domains without code changes:
   ```
   # Comma-separated additional egress domains (no wildcards)
   CARINA_EGRESS_EXTRA_DOMAINS=
   ```
3. Rebuild and restart.
4. Watch for egress_blocked events in Scout or logs for 1 hour after deploy.
   Any legitimate blocked domain must be added explicitly, not via wildcard.
