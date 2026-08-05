# Sprint: Carina Self-Configuration; Dynamic Credential Store with Env Var Fallback

**Status: COMPLETED 2026-07-26**

**What was built:**
- Implemented and archived

## What This Builds

Carina gains the ability to accept API keys conversationally and wire them up herself. You give her a Tavily key in chat; she encrypts it, stores it, activates web search, and starts using it. No `.env` edit. No redeploy. No developer.

The manual `.env` method REMAINS as fallback. If the credential store is unavailable (DB down, no encryption key), Carina falls back to `process.env`. The resolver chain is: **credential store → process.env → null**.

---

## Architecture Overview

```
User gives Carina a key
        │
        ▼
┌──────────────────────────┐
│  Self-Config Tools        │  ← Carina calls these herself
│  configure_credential     │
│  list_credentials         │
│  test_credential          │
│  remove_credential        │
│  tool_status              │
└──────────┬───────────────┘
           │ encrypt & store
           ▼
┌──────────────────────────┐
│  Credential Store          │  ← Encrypted DB table
│  service | key | value     │
│  tavily  | TAVILY_API_KEY  │
│  claude  | ANTHROPIC_API_KEY│
└──────────┬───────────────┘
           │ read at runtime
           ▼
┌──────────────────────────┐
│  Credential Resolver       │  ← Tools call this, not process.env
│  1. Check store (decrypt)  │
│  2. Fallback to process.env│
│  3. Return null if neither  │
└──────────────────────────┘
```

**Key design decisions:**
- Store wins over env vars when both exist (explicitly configured state beats ambient state)
- Tools never read `process.env` directly after this sprint; they call `resolveCredential(keyName)`
- Encryption key is `CREDENTIAL_ENCRYPTION_KEY` in `.env`; if missing, store is read-only (can't save new keys, but existing env vars still work)
- Self-config tools are gated; only available to operator sessions, not tenant users

---

## Part 1: Database Migration

### Migration pattern

The project uses inline TypeScript SQL constants, NOT separate `.sql` files. The DB is PostgreSQL. Follow the existing pattern: define an exported SQL constant in the persistence file and import it in `src/memory/migrations.ts`.

### File: `src/credentials/credential-store.ts` (defined alongside the store below)

Export this constant at the top of the file:

```typescript
export const TOOL_CREDENTIALS_MIGRATION = `
CREATE TABLE IF NOT EXISTS tool_credentials (
    id          SERIAL PRIMARY KEY,
    service     TEXT NOT NULL,
    key_name    TEXT NOT NULL,
    encrypted_value TEXT NOT NULL,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(service, key_name)
);
CREATE INDEX IF NOT EXISTS idx_tool_credentials_service ON tool_credentials(service);
CREATE INDEX IF NOT EXISTS idx_tool_credentials_active ON tool_credentials(is_active);
`;
```

### File: `src/memory/migrations.ts` - ADD

```typescript
import { TOOL_CREDENTIALS_MIGRATION } from '../credentials/credential-store.js';
// Include TOOL_CREDENTIALS_MIGRATION in the migrations list run at startup.
```

**Constraint**: The `encrypted_value` column stores base64-encoded AES-256-GCM output: `iv + authTag + ciphertext`, all concatenated and base64'd.

---

## Part 2: Types

### File: `src/credentials/types.ts`

```typescript
export interface ToolCredential {
  id: number;
  service: string;
  key_name: string;
  encrypted_value: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CredentialStatus {
  service: string;
  key_name: string;
  configured: boolean;
  source: 'store' | 'env' | 'none';
  masked_value?: string; // e.g. "tvly-***abc"
}

export interface ToolCapability {
  tool_name: string;
  description: string;
  required_credentials: string[];
  status: 'ready' | 'unconfigured' | 'partial' | 'error';
  missing_credentials: string[];
  category: string;
}
```

---

## Part 3: Encryption Service

### File: `src/credentials/encryption.ts`

```typescript
import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32; // 256 bits

function getEncryptionKey(): Buffer | null {
  const key = process.env.CREDENTIAL_ENCRYPTION_KEY;
  if (!key) return null;
  // Accept raw 32-byte hex string OR a passphrase (hashed to 32 bytes)
  if (key.length === 64 && /^[0-9a-fA-F]+$/.test(key)) {
    return Buffer.from(key, 'hex');
  }
  // Otherwise treat as passphrase, derive 32-byte key
  return crypto.scryptSync(key, 'carina-credential-salt', KEY_LENGTH);
}

export function encrypt(plaintext: string): string | null {
  const key = getEncryptionKey();
  if (!key) return null;

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  
  const authTag = cipher.getAuthTag();
  
  // Format: iv (16) + authTag (16) + ciphertext
  return Buffer.concat([iv, authTag, encrypted]).toString('base64');
}

export function decrypt(encoded: string): string | null {
  const key = getEncryptionKey();
  if (!key) return null;

  try {
    const buffer = Buffer.from(encoded, 'base64');
    const iv = buffer.subarray(0, IV_LENGTH);
    const authTag = buffer.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const ciphertext = buffer.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    return Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]).toString('utf8');
  } catch {
    return null; // Decryption failed; corrupted data or wrong key
  }
}

export function isEncryptionAvailable(): boolean {
  return getEncryptionKey() !== null;
}
```

**Important**: If `CREDENTIAL_ENCRYPTION_KEY` is not set, `encrypt()` returns `null`. The credential store can still READ (env var fallback works), but cannot WRITE. Self-config tools report "encryption not available" when this happens.

---

## Part 4: Credential Store

### File: `src/credentials/credential-store.ts`

```typescript
import { pool } from '../memory/db.js';
import { encrypt, decrypt, isEncryptionAvailable } from './encryption.js';
import type { ToolCredential } from './types.js';

export class CredentialStore {

  /** Store or update a credential. Returns false if encryption unavailable. */
  async set(service: string, keyName: string, plaintextValue: string): Promise<boolean> {
    if (!isEncryptionAvailable()) return false;

    const encrypted = encrypt(plaintextValue);
    if (!encrypted) return false;

    await pool.query(`
      INSERT INTO tool_credentials (service, key_name, encrypted_value, is_active, updated_at)
      VALUES ($1, $2, $3, TRUE, NOW())
      ON CONFLICT(service, key_name) DO UPDATE SET
        encrypted_value = EXCLUDED.encrypted_value,
        is_active = TRUE,
        updated_at = NOW()
    `, [service, keyName, encrypted]);

    return true;
  }

  /** Retrieve and decrypt a credential. Returns null if not found or decryption fails. */
  async get(keyName: string): Promise<string | null> {
    const result = await pool.query<ToolCredential>(
      'SELECT * FROM tool_credentials WHERE key_name = $1 AND is_active = TRUE LIMIT 1',
      [keyName],
    );
    const row = result.rows[0];
    if (!row) return null;
    return decrypt(row.encrypted_value);
  }

  /** Get all credentials (values masked). For listing/admin. */
  async list(): Promise<Array<{ service: string; key_name: string; is_active: boolean; created_at: string }>> {
    const result = await pool.query(
      'SELECT service, key_name, is_active, created_at FROM tool_credentials ORDER BY service, key_name',
    );
    return result.rows;
  }

  /** Deactivate a credential (soft delete; keeps audit trail). */
  async remove(service: string, keyName: string): Promise<boolean> {
    const result = await pool.query(
      'UPDATE tool_credentials SET is_active = FALSE, updated_at = NOW() WHERE service = $1 AND key_name = $2',
      [service, keyName],
    );
    return (result.rowCount ?? 0) > 0;
  }

  /** Hard delete a credential. Use with caution. */
  async delete(service: string, keyName: string): Promise<boolean> {
    const result = await pool.query(
      'DELETE FROM tool_credentials WHERE service = $1 AND key_name = $2',
      [service, keyName],
    );
    return (result.rowCount ?? 0) > 0;
  }

  /** Check if a credential exists in the store (without decrypting). */
  async exists(keyName: string): Promise<boolean> {
    const result = await pool.query<{ cnt: string }>(
      'SELECT COUNT(*) AS cnt FROM tool_credentials WHERE key_name = $1 AND is_active = TRUE',
      [keyName],
    );
    return parseInt(result.rows[0]?.cnt ?? '0', 10) > 0;
  }
}

export const credentialStore = new CredentialStore();
```

---

## Part 5: Credential Resolver

### File: `src/credentials/resolver.ts`

This is the SINGLE function every tool calls instead of `process.env`. It replaces ALL direct `process.env` reads across the tool codebase.

```typescript
import { credentialStore } from './credential-store.js';
import { isEncryptionAvailable } from './encryption.js';
import type { CredentialStatus } from './types.js';

/**
 * Resolve a credential with the chain: store → env → null.
 * 
 * Store wins over env vars because an explicitly configured value
 * is more intentional than ambient environment state.
 */
export async function resolveCredential(keyName: string): Promise<string | null> {
  // 1. Check encrypted store (only if encryption is available)
  if (isEncryptionAvailable()) {
    try {
      const stored = await credentialStore.get(keyName);
      if (stored) return stored;
    } catch {
      // Store unavailable; fall through to env
    }
  }

  // 2. Fallback to process.env
  const envValue = process.env[keyName];
  if (envValue !== undefined && envValue !== '') return envValue;

  // 3. Nothing found
  return null;
}

/**
 * Synchronous version; checks env only. Use for startup/bootstrap code
 * where async DB access isn't available yet.
 */
export function resolveCredentialSync(keyName: string): string | null {
  const envValue = process.env[keyName];
  if (envValue !== undefined && envValue !== '') return envValue;
  return null;
}

/**
 * Get the status of a credential; where it's coming from.
 */
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
```

---

## Part 6: Tool Capability Manifest

### File: `src/credentials/tool-capabilities.ts`

Each tool that requires credentials declares them here. This is the source of truth for "what does Carina need to be fully operational."

```typescript
export interface ToolCapabilityEntry {
  tool_name: string;
  description: string;
  required_credentials: string[]; // key_names from tool_credentials or process.env
  category: string;
  /** If true, the tool is only listed when at least one credential is configured */
  hide_when_unconfigured?: boolean;
}

/**
 * Master registry of every tool that needs credentials.
 * 
 * Adding a new tool? Add its entry here. The tool_status command
 * reads this list to report what's ready vs missing.
 */
export const TOOL_CAPABILITIES: ToolCapabilityEntry[] = [
  // === Search ===
  {
    tool_name: 'web_search_tavily',
    description: 'Web search via Tavily API',
    required_credentials: ['TAVILY_API_KEY'],
    category: 'search',
  },
  
  // === AI Providers ===
  {
    tool_name: 'chat_anthropic',
    description: 'Claude chat via Anthropic API',
    required_credentials: ['ANTHROPIC_API_KEY'],
    category: 'ai-providers',
  },
  {
    tool_name: 'chat_openai',
    description: 'GPT chat via OpenAI API',
    required_credentials: ['OPENAI_API_KEY'],
    category: 'ai-providers',
  },
  {
    tool_name: 'chat_deepseek',
    description: 'DeepSeek chat',
    required_credentials: ['DEEPSEEK_API_KEY'],
    category: 'ai-providers',
  },
  
  // === Messaging ===
  {
    tool_name: 'email_smtp_send',
    description: 'Send email via SMTP',
    required_credentials: ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS'],
    category: 'messaging',
  },
  {
    tool_name: 'email_imap_read',
    description: 'Read email via IMAP',
    required_credentials: ['IMAP_HOST', 'IMAP_USER', 'IMAP_PASS'],
    category: 'messaging',
  },
  
  // === Payments ===
  {
    tool_name: 'stripe_billing',
    description: 'Process payments via Stripe',
    required_credentials: ['STRIPE_SECRET_KEY'],
    category: 'payments',
  },
  
  // === Media ===
  {
    tool_name: 'text_to_speech',
    description: 'Generate voice audio',
    required_credentials: [],  // Uses built-in edge-tts or env OPENAI_API_KEY
    category: 'media',
  },
  
  // === Security ===
  {
    tool_name: 'scout_govern',
    description: 'Scout security governance',
    required_credentials: ['SCOUT_API_KEY'],
    category: 'security',
  },
  
  // === Integrations ===
  {
    tool_name: 'notion_api',
    description: 'Notion workspace integration',
    required_credentials: ['NOTION_API_KEY'],
    category: 'integrations',
  },
  {
    tool_name: 'github_api',
    description: 'GitHub API access',
    required_credentials: ['GITHUB_TOKEN'],
    category: 'integrations',
  },
  {
    tool_name: 'google_workspace',
    description: 'Google Workspace (Gmail, Calendar, Drive)',
    required_credentials: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REFRESH_TOKEN'],
    category: 'integrations',
  },
];
```

**IMPORTANT**: This is the STARTING list. Extend it to cover every tool in the codebase that reads from process.env. Use `search_files` to find ALL `process.env` reads in `src/tools/` and add entries. The more complete this manifest, the more useful `tool_status` becomes.

---

## Part 7: Self-Configuration Tools

These are tools Carina can call HERSELF. They go in `src/tools/` and follow the standard tool registration pattern (register in `index.ts`, add to toolset in `toolset.ts`).

### Tool 1: `configure_credential`

### File: `src/tools/configure-credential.ts`

```typescript
import { credentialStore } from '../credentials/credential-store.js';
import { isEncryptionAvailable } from '../credentials/encryption.js';

export const configureCredentialTool = {
  name: 'configure_credential',
  description: `Store an API key or credential. Carina uses this to self-configure when a user provides a key.
Use this when the user says "here's my X API key" or "add this credential."
The value is encrypted at rest. After storing, the associated tool becomes available immediately.`,
  parameters: {
    type: 'object',
    properties: {
      service: {
        type: 'string',
        description: 'Service name: "tavily", "claude", "stripe", "openai", "notion", etc.',
      },
      key_name: {
        type: 'string',
        description: 'Environment variable name: "TAVILY_API_KEY", "ANTHROPIC_API_KEY", etc.',
      },
      value: {
        type: 'string',
        description: 'The API key or credential value to store.',
      },
    },
    required: ['service', 'key_name', 'value'],
  },
  async execute(params: Record<string, unknown>) {
    const { service, key_name, value } = params as { service: string; key_name: string; value: string };
    if (!isEncryptionAvailable()) {
      return {
        success: false,
        error: 'Credential encryption is not available. Set CREDENTIAL_ENCRYPTION_KEY in .env first.',
        hint: 'Generate one: openssl rand -hex 32',
      };
    }

    const stored = await credentialStore.set(service, key_name, value);
    if (!stored) {
      return { success: false, error: 'Failed to store credential. Check encryption key and database.' };
    }

    return {
      success: true,
      service,
      key_name,
      message: `Credential ${key_name} for ${service} stored and encrypted. It is now available for use.`,
    };
  },
};
```

### Tool 2: `list_credentials`

### File: `src/tools/list-credentials.ts`

```typescript
import { credentialStore } from '../credentials/credential-store.js';

export const listCredentialsTool = {
  name: 'list_credentials',
  description: `List all stored credentials (values are masked). Shows what services are configured.`,
  parameters: {
    type: 'object',
    properties: {},
    required: [],
  },
  async execute(_params: Record<string, unknown>) {
    const creds = await credentialStore.list();
    
    if (creds.length === 0) {
      return {
        credentials: [],
        count: 0,
        message: 'No credentials stored yet. Use configure_credential to add one, or check process.env for manual config.',
      };
    }

    return {
      credentials: creds.map(c => ({
        service: c.service,
        key_name: c.key_name,
        active: c.is_active === 1,
        stored_at: c.created_at,
      })),
      count: creds.length,
    };
  },
};
```

### Tool 3: `test_credential`

### File: `src/tools/test-credential.ts`

```typescript
import { resolveCredential } from '../credentials/resolver.js';

const TEST_PATTERNS: Record<string, { url: string; header: string; expectedStatus: number[] }> = {
  TAVILY_API_KEY: {
    url: 'https://api.tavily.com/search',
    header: 'Authorization: Bearer {VALUE}',
    expectedStatus: [200, 401, 403], // 200 = valid, 401/403 = invalid key
  },
  ANTHROPIC_API_KEY: {
    url: 'https://api.anthropic.com/v1/messages',
    header: 'x-api-key: {VALUE}',
    expectedStatus: [200, 401, 403],
  },
  OPENAI_API_KEY: {
    url: 'https://api.openai.com/v1/models',
    header: 'Authorization: Bearer {VALUE}',
    expectedStatus: [200, 401],
  },
  STRIPE_SECRET_KEY: {
    url: 'https://api.stripe.com/v1/balance',
    header: 'Authorization: Bearer {VALUE}',
    expectedStatus: [200, 401],
  },
};

export const testCredentialTool = {
  name: 'test_credential',
  description: `Test if a stored credential works by making a lightweight API call to the service.
Use this after configure_credential to verify the key is valid.`,
  parameters: {
    type: 'object',
    properties: {
      key_name: {
        type: 'string',
        description: 'The credential key to test: "TAVILY_API_KEY", "ANTHROPIC_API_KEY", etc.',
      },
    },
    required: ['key_name'],
  },
  async execute(params: Record<string, unknown>) {
    const { key_name } = params as { key_name: string };
    const value = await resolveCredential(key_name);
    if (!value) {
      return {
        success: false,
        key_name,
        error: `Credential ${key_name} is not configured. Use configure_credential to add it, or set it in .env.`,
      };
    }

    const pattern = TEST_PATTERNS[key_name];
    if (!pattern) {
      return {
        success: null,
        key_name,
        message: `No test endpoint defined for ${key_name}. The credential exists but cannot be auto-tested.`,
        source: 'stored',
      };
    }

    try {
      const headerLine = pattern.header.replace('{VALUE}', value);
      const [headerName, ...headerValueParts] = headerLine.split(': ');
      const headerValue = headerValueParts.join(': ');

      const response = await fetch(pattern.url, {
        method: 'GET',
        headers: { [headerName]: headerValue },
        signal: AbortSignal.timeout(10000),
      });

      const isValid = response.status === 200;

      return {
        success: isValid,
        key_name,
        status_code: response.status,
        message: isValid
          ? `Credential is valid. Service responded in ${response.status}ms.`
          : `Credential was rejected (HTTP ${response.status}). The key may be invalid or expired.`,
        endpoint: pattern.url,
      };
    } catch (err: any) {
      return {
        success: false,
        key_name,
        error: `Connection test failed: ${err.message}`,
        hint: 'Check network connectivity and the service endpoint.',
      };
    }
  },
};
```

### Tool 4: `remove_credential`

### File: `src/tools/remove-credential.ts`

```typescript
import { credentialStore } from '../credentials/credential-store.js';

export const removeCredentialTool = {
  name: 'remove_credential',
  description: `Deactivate a stored credential. The key is soft-deleted (marked inactive).
After removal, Carina falls back to process.env if available.`,
  parameters: {
    type: 'object',
    properties: {
      service: {
        type: 'string',
        description: 'Service name: "tavily", "claude", etc.',
      },
      key_name: {
        type: 'string',
        description: 'Credential key to remove: "TAVILY_API_KEY", etc.',
      },
    },
    required: ['service', 'key_name'],
  },
  async execute(params: Record<string, unknown>) {
    const { service, key_name } = params as { service: string; key_name: string };
    const removed = await credentialStore.remove(service, key_name);
    if (!removed) {
      return {
        success: false,
        error: `No active credential found for ${service}/${key_name}.`,
      };
    }

    return {
      success: true,
      service,
      key_name,
      message: `Credential ${key_name} deactivated. Falling back to process.env if set.`,
    };
  },
};
```

### Tool 5: `tool_status`

### File: `src/tools/tool-status.ts`

```typescript
import { TOOL_CAPABILITIES, type ToolCapabilityEntry } from '../credentials/tool-capabilities.js';
import { resolveCredential } from '../credentials/resolver.js';
import { isEncryptionAvailable } from '../credentials/encryption.js';

export const toolStatusTool = {
  name: 'tool_status',
  description: `Report which tools are ready and which are missing credentials.
Shows the full picture: what's configured, what's missing, and where each credential comes from (store vs env).
Use this when asked "what can you do" or "what's missing."`,
  parameters: {
    type: 'object',
    properties: {
      category: {
        type: 'string',
        description: 'Optional: filter by category ("search", "ai-providers", "messaging", etc.)',
      },
    },
    required: [],
  },
  async execute(params: Record<string, unknown>) {
    const { category } = params as { category?: string };
    const entries = category
      ? TOOL_CAPABILITIES.filter(e => e.category === category)
      : TOOL_CAPABILITIES;

    const results = await Promise.all(
      entries.map(async (entry): Promise<ToolCapabilityEntry & { status: string; missing: string[] }> => {
        const missing: string[] = [];
        for (const cred of entry.required_credentials) {
          const value = await resolveCredential(cred);
          if (!value) missing.push(cred);
        }

        let status: string;
        if (missing.length === 0) {
          status = 'ready';
        } else if (missing.length === entry.required_credentials.length) {
          status = 'unconfigured';
        } else {
          status = 'partial';
        }

        return { ...entry, status, missing };
      })
    );

    const ready = results.filter(r => r.status === 'ready').length;
    const partial = results.filter(r => r.status === 'partial').length;
    const unconfigured = results.filter(r => r.status === 'unconfigured').length;
    const total = results.length;

    return {
      summary: {
        total_tools: total,
        ready,
        partial,
        unconfigured,
        encryption_available: isEncryptionAvailable(),
        store_active: isEncryptionAvailable(),
        env_fallback: 'active',
      },
      tools: results.map(r => ({
        tool: r.tool_name,
        category: r.category,
        status: r.status,
        missing_credentials: r.missing,
      })),
    };
  },
};
```

---

## Part 8: Registration

### File: `src/tools/index.ts`; ADD these imports and registrations

```typescript
// At the top, with other imports:
import { configureCredentialTool } from './configure-credential.js';
import { listCredentialsTool } from './list-credentials.js';
import { testCredentialTool } from './test-credential.js';
import { removeCredentialTool } from './remove-credential.js';
import { toolStatusTool } from './tool-status.js';

// In the registry.register() section:
registry.register(configureCredentialTool);
registry.register(listCredentialsTool);
registry.register(testCredentialTool);
registry.register(removeCredentialTool);
registry.register(toolStatusTool);
```

### File: `src/tools/toolset.ts`; ADD to TOOLSET_MAP

```typescript
// Add a new toolset category. Tool name strings must match the `name` field on each tool object.
'self-config': [
  'configure_credential',
  'list_credentials',
  'test_credential',
  'remove_credential',
  'tool_status',
],
```

Note: `TOOLSET_MAP` values are tool `name` strings (snake_case), not file names (kebab-case).

### File: `src/tools/toolset-config.ts`; ADD to LEAST_PRIVILEGE_TOOLSETS or per-operator YAML

Platform defaults are NOT hardcoded in `toolset-config.ts`; they are driven by `LEAST_PRIVILEGE_TOOLSETS` and per-instance YAML/DB config. Add `self-config` to the operator's `toolsets.yaml` under `platforms.cli` and `platforms.telegram`. Do NOT add to `web` or `cron`; these tools are operator-only.

Example entry in `~/.carina/toolsets.yaml`:
```yaml
platforms:
  cli:
    enabled: ['self-config']
  telegram:
    enabled: ['self-config']
```

### File: `src/tools/toolset.ts`; ADD to LEAF_EXCLUDED_TOOLS (these should never reach tenant agents)

```typescript
export const LEAF_EXCLUDED_TOOLS = [
  'delegate-task', 'kanban', 'clarify', 'memory',
  'session-search', 'todo', 'email-send', 'code-exec', 'cronjob',
  'webhook', 'checkpoint-manager', 'debug-helpers',
  'mixture-of-agents', 'computer-use',
  // Self-config tools; operator only
  'configure_credential', 'list_credentials', 'test_credential',
  'remove_credential', 'tool_status',
] as const;
```

---

## Part 9: Migrate Existing Tools to Use Resolver

Every tool that reads `process.env.SOME_KEY` must switch to `resolveCredential('SOME_KEY')`. This is the migration work.

### Pattern; BEFORE:

```typescript
const apiKey = process.env.TAVILY_API_KEY;
if (!apiKey) throw new Error('TAVILY_API_KEY not configured');
```

### Pattern; AFTER:

```typescript
import { resolveCredential } from '../../credentials/resolver.js';

// ... inside execute():
const apiKey = await resolveCredential('TAVILY_API_KEY');
if (!apiKey) {
  return {
    success: false,
    error: 'TAVILY_API_KEY is not configured.',
    hint: 'Provide your Tavily API key and I can configure it for you, or set TAVILY_API_KEY in .env.',
  };
}
```

### Migration approach

1. Run a search: `grep -rn "process.env\." src/tools/` to find ALL direct env reads
2. For each tool file:
   - Import `resolveCredential` from `../credentials/resolver.js` (adjust relative path)
   - Replace `process.env.KEY_NAME` with `await resolveCredential('KEY_NAME')`
   - Handle null return with a helpful error message that mentions self-config
3. Do NOT change tools that read non-credential env vars (e.g., `process.env.NODE_ENV`, `process.env.PORT`)

### Priority tools to migrate first

- Tavily search (`src/tools/web-search-tavily.ts` or similar)
- Anthropic chat (`src/tools/chat-anthropic.ts` or similar)
- OpenAI chat
- Stripe billing
- SMTP/IMAP email
- Notion API
- Google Workspace

---

## Part 10: REST API Endpoint (Optional; for Dashboard)

### File: `src/api/tool-status.ts`

A simple REST endpoint so the ops dashboard can show credential status without going through the agent.

```typescript
import { Router } from 'express';
import { TOOL_CAPABILITIES } from '../credentials/tool-capabilities.js';
import { resolveCredential, getCredentialStatus } from '../credentials/resolver.js';

const router = Router();

router.get('/api/tool-status', async (_req, res) => {
  const results = await Promise.all(
    TOOL_CAPABILITIES.map(async (entry) => {
      const statuses = await Promise.all(
        entry.required_credentials.map(getCredentialStatus)
      );
      const allConfigured = statuses.every(s => s.configured);
      return {
        tool: entry.tool_name,
        category: entry.category,
        status: allConfigured ? 'ready' : 'unconfigured',
        credentials: statuses,
      };
    })
  );

  res.json({
    tools: results,
    ready: results.filter(r => r.status === 'ready').length,
    total: results.length,
  });
});

export default router;
```

Mount in the gateway (`src/api/` alongside existing routes like `src/api/rag-upload-api.ts`):
```typescript
import toolStatusRouter from './tool-status-api.js';
app.use(toolStatusRouter);
```

Note: name the file `tool-status-api.ts` (not `tool-status.ts`) to avoid name collision with the existing `src/tools/tool-status.ts`.

---

## Part 11: Environment Variable

Add to `.env` and `.env.example`:

```bash
# Credential encryption key for self-configuration feature.
# Generate: openssl rand -hex 32
# If not set, Carina cannot store new credentials (env var fallback still works).
CREDENTIAL_ENCRYPTION_KEY=
```

---

## Verification Checklist

After building, verify:

- [ ] **Migration**: `tool_credentials` table exists in the database
- [ ] **Encryption**: `CREDENTIAL_ENCRYPTION_KEY` is set → `isEncryptionAvailable()` returns true
- [ ] **Store**: Can store a credential → `credentialStore.set('test', 'TEST_KEY', 'test-value')` returns true
- [ ] **Retrieve**: Can retrieve and decrypt → `credentialStore.get('TEST_KEY')` returns 'test-value'
- [ ] **Resolver chain**: With a stored credential, `resolveCredential('TEST_KEY')` returns the stored value
- [ ] **Env fallback**: Without a stored credential, `resolveCredential('TAVILY_API_KEY')` falls back to `process.env.TAVILY_API_KEY`
- [ ] **Null case**: Neither store nor env → `resolveCredential('NONEXISTENT_KEY')` returns null
- [ ] **Tools registered**: `configure_credential`, `list_credentials`, `test_credential`, `remove_credential`, `tool_status` all appear in tool list
- [ ] **Operator gated**: Self-config tools NOT available to tenant/web users
- [ ] **tool_status**: Returns correct ready/partial/unconfigured counts
- [ ] **Existing tools still work**: Tavily, Claude, Stripe tools function after migration to resolver
- [ ] **Manual fallback intact**: Removing a stored credential → tool falls back to process.env
- [ ] **TypeScript**: `tsc --noEmit` passes with zero errors
- [ ] **Build**: `pnpm build` (or `npm run build`) succeeds

---

## Files Summary

| Action | File | Purpose |
|--------|------|---------|
| CREATE | `src/credentials/types.ts` | Type definitions |
| CREATE | `src/credentials/encryption.ts` | AES-256-GCM encrypt/decrypt |
| CREATE | `src/credentials/credential-store.ts` | PostgreSQL CRUD for credentials + migration export |
| CREATE | `src/credentials/resolver.ts` | Store → env → null chain |
| CREATE | `src/credentials/tool-capabilities.ts` | Tool capability manifest |
| CREATE | `src/tools/configure-credential.ts` | Self-config: store a key |
| CREATE | `src/tools/list-credentials.ts` | Self-config: list stored keys |
| CREATE | `src/tools/test-credential.ts` | Self-config: test a key |
| CREATE | `src/tools/remove-credential.ts` | Self-config: remove a key |
| CREATE | `src/api/tool-status-api.ts` | REST endpoint for dashboard (not tool-status.ts which already exists) |
| MODIFY | `src/memory/migrations.ts` | Import and run TOOL_CREDENTIALS_MIGRATION |
| MODIFY | `src/tools/index.ts` | Register 5 new tools |
| MODIFY | `src/tools/toolset.ts` | Add self-config toolset + LEAF_EXCLUDED |
| MODIFY | `~/.carina/toolsets.yaml` (operator config) | Enable self-config for cli/telegram platforms |
| MODIFY | `.env` + `.env.production.example` | Add CREDENTIAL_ENCRYPTION_KEY |
| MODIFY | `src/tools/web-search.ts` | Migrate to resolveCredential |
| MODIFY | All other tools reading process.env directly | Migrate to resolveCredential |

---

## Success Criteria

Laud opens Carina on Telegram and says:

> "Carina, here's my Tavily API key: tvly-EXAMPLE"

Carina responds:

> "Tavily search configured. I can now search the web. Want me to test it?"

Laud says "yes." Carina tests the key. It works. No deploy. No `.env` edit. No terminal.

If Carina's database is down or the encryption key is missing, she says:

> "I can't store that right now; credential encryption isn't available. But if you add TAVILY_API_KEY=tvly-EXAMPLE to your .env file, I can use it immediately."
