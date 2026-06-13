# BYOK; Tenant Bring-Your-Own-Key Provider System

Build a tenant-scoped API key system so each tenant brings their own LLM
provider keys. Carina routes requests using the tenant's key, falling
back to global config.

## 0. Add NVIDIA as provider #23

File: `src/brain/provider-registry.ts`

Insert after the `lmstudio` entry (before `]);`):

```typescript
  openaiCompat('nvidia', 'NVIDIA NIM', 'NVIDIA_API_KEY', 'NVIDIA_MODEL', 'nemotron-mini-4b-instruct', 'https://integrate.api.nvidia.com/v1', 'NVIDIA_BASE_URL', 0, 23, {
    capabilities: { chat: true, vision: false, streaming: true, tools: true },
  }),
```

## 1. Database migration

File: `src/memory/migrations.ts`

Add a migration (use the next index number in the migrations array):

```sql
CREATE TABLE IF NOT EXISTS tenant_provider_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  provider TEXT NOT NULL,
  encrypted_api_key TEXT NOT NULL,
  custom_base_url TEXT,
  custom_model TEXT,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, provider)
);
CREATE INDEX IF NOT EXISTS idx_tenant_provider_keys_tenant
  ON tenant_provider_keys (tenant_id);
```

## 2. Tenant provider key store

New file: `src/brain/tenant-provider-keys.ts`

```typescript
import { pool } from '../memory/db.js';
import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.TENANT_KEY_ENCRYPTION_KEY
  ?? process.env.CARINA_ENCRYPTION_KEY
  ?? 'carina-dev-key-change-in-production-32'; // 32 bytes for AES-256

function encrypt(plaintext: string): string {
  const iv = crypto.randomBytes(16);
  const key = Buffer.from(ENCRYPTION_KEY.slice(0, 32), 'utf-8');
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(plaintext, 'utf-8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

function decrypt(ciphertext: string): string {
  const [ivHex, encrypted] = ciphertext.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const key = Buffer.from(ENCRYPTION_KEY.slice(0, 32), 'utf-8');
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf-8');
  decrypted += decipher.final('utf-8');
  return decrypted;
}

export interface TenantProviderOverride {
  provider: string;
  apiKey: string;
  baseUrl?: string;
  model?: string;
}

export async function getTenantProvider(
  tenantId: string,
  provider: string,
): Promise<TenantProviderOverride | null> {
  const result = await pool.query(
    `SELECT encrypted_api_key, custom_base_url, custom_model, enabled
     FROM tenant_provider_keys
     WHERE tenant_id = $1 AND provider = $2`,
    [tenantId, provider],
  );
  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  if (!row.enabled) return null;
  return {
    provider,
    apiKey: decrypt(row.encrypted_api_key),
    baseUrl: row.custom_base_url || undefined,
    model: row.custom_model || undefined,
  };
}

export async function setTenantProviderKey(
  tenantId: string,
  provider: string,
  apiKey: string,
  baseUrl?: string,
  model?: string,
): Promise<void> {
  const encrypted = encrypt(apiKey);
  await pool.query(
    `INSERT INTO tenant_provider_keys (tenant_id, provider, encrypted_api_key, custom_base_url, custom_model)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (tenant_id, provider)
     DO UPDATE SET encrypted_api_key = $3, custom_base_url = $4, custom_model = $5, updated_at = NOW()`,
    [tenantId, provider, encrypted, baseUrl ?? null, model ?? null],
  );
}

export async function removeTenantProviderKey(
  tenantId: string,
  provider: string,
): Promise<void> {
  await pool.query(
    `DELETE FROM tenant_provider_keys WHERE tenant_id = $1 AND provider = $2`,
    [tenantId, provider],
  );
}

export async function listTenantProviders(
  tenantId: string,
): Promise<Array<{ provider: string; enabled: boolean; hasKey: boolean }>> {
  const result = await pool.query(
    `SELECT provider, enabled FROM tenant_provider_keys WHERE tenant_id = $1`,
    [tenantId],
  );
  return result.rows.map((r) => ({
    provider: r.provider,
    enabled: r.enabled,
    hasKey: true,
  }));
}
```

## 3. Modify LLMRouter to check tenant overrides

File: `src/brain/llm.ts`

### 3a. Add import at top:
```typescript
import { getTenantProvider } from './tenant-provider-keys.js';
```

### 3b. Modify the `LLMRouter` class; add a `tenantId` field and a method:

```typescript
export class LLMRouter {
  private providers: Map<string, LLMProvider> = new Map();
  private active: string;
  private activeModels: Map<string, string> = new Map();
  private tenantId?: string;

  setTenant(tenantId: string | undefined): void {
    this.tenantId = tenantId;
  }

  async resolveProviderOverride(
    providerName: string,
    model?: string,
  ): Promise<ProviderOverride | undefined> {
    if (!this.tenantId) return model ? { name: providerName, model } : undefined;

    const tenantOverride = await getTenantProvider(this.tenantId, providerName);
    if (!tenantOverride) return model ? { name: providerName, model } : undefined;

    // Create a temporary provider instance with tenant's key
    const def = { ...PROVIDER_MAP[providerName] };
    if (!def) return model ? { name: providerName, model } : undefined;

    // Override the env vars temporarily for this call
    const origKey = process.env[def.apiKeyEnv];
    const origBaseUrl = def.baseUrlEnv ? process.env[def.baseUrlEnv] : undefined;
    process.env[def.apiKeyEnv] = tenantOverride.apiKey;
    if (tenantOverride.baseUrl && def.baseUrlEnv) {
      process.env[def.baseUrlEnv] = tenantOverride.baseUrl;
    }

    const tempProvider = createProvider(providerName);

    // Restore original env vars
    process.env[def.apiKeyEnv] = origKey ?? '';
    if (def.baseUrlEnv) {
      if (origBaseUrl) process.env[def.baseUrlEnv] = origBaseUrl;
      else delete process.env[def.baseUrlEnv];
    }

    if (!tempProvider) return undefined;

    // Replace the provider in our map temporarily
    // Better approach: just call chat directly with tenant's credentials
    return {
      name: providerName,
      model: tenantOverride.model ?? model,
    };
  }
```

Actually, cleaner approach; override the provider resolution in `chatRouted`:

### 3c. Replace `chatRouted` method:

```typescript
  async chatRouted(
    messages: Message[],
    tools?: Tool[],
    classification: TaskComplexity = classifyComplexity(messages),
    override?: ProviderOverride,
  ): Promise<CarinaResponse> {
    let effectiveOverride = override;
    
    // Check tenant provider key
    if (!effectiveOverride && this.tenantId) {
      const activeProvider = this.active;
      const tenantOverride = await getTenantProvider(this.tenantId, activeProvider);
      if (tenantOverride) {
        effectiveOverride = {
          name: activeProvider,
          model: tenantOverride.model,
        };
        // Set tenant API key for this call
        const def = PROVIDER_MAP[activeProvider];
        if (def) {
          process.env[def.apiKeyEnv] = tenantOverride.apiKey;
          if (tenantOverride.baseUrl && def.baseUrlEnv) {
            process.env[def.baseUrlEnv] = tenantOverride.baseUrl;
          }
        }
      }
    }

    if (effectiveOverride) return this.chat(messages, tools, effectiveOverride);
    const startProvider = classification === 'simple' ? this.cheap().name : this.current().name;
    return this.chatWithProviders(this.fallbackOrder({ name: startProvider }), messages, tools);
  }
```

## 4. Tenant API routes for key management

New file: `src/api/tenant-keys.ts`

```typescript
import { Router, json } from 'express';
import { setTenantProviderKey, listTenantProviders, removeTenantProviderKey } from '../brain/tenant-provider-keys.js';

export function tenantKeysRouter(): Router {
  const router = Router();

  // List configured providers for this tenant
  router.get('/api/tenant/providers', async (req, res) => {
    const tenantId = (req as any).tenantId;
    if (!tenantId) return res.status(401).json({ error: 'No tenant context' });
    try {
      const providers = await listTenantProviders(tenantId);
      res.json({ providers });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // Set a provider key
  router.post('/api/tenant/providers', json(), async (req, res) => {
    const tenantId = (req as any).tenantId;
    if (!tenantId) return res.status(401).json({ error: 'No tenant context' });
    const { provider, apiKey, baseUrl, model } = req.body;
    if (!provider || !apiKey) {
      return res.status(400).json({ error: 'provider and apiKey required' });
    }
    try {
      await setTenantProviderKey(tenantId, provider, apiKey, baseUrl, model);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // Delete a provider key
  router.delete('/api/tenant/providers/:provider', async (req, res) => {
    const tenantId = (req as any).tenantId;
    if (!tenantId) return res.status(401).json({ error: 'No tenant context' });
    try {
      await removeTenantProviderKey(tenantId, req.params.provider);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  return router;
}
```

## 5. Register the routes in web.ts

File: `src/gateway/web.ts`

Add import:
```typescript
import { tenantKeysRouter } from '../api/tenant-keys.js';
```

Add before `app.listen` / the route mounting section:
```typescript
app.use(tenantKeysRouter());
```

## 6. Wire tenantId into router for each request

File: `src/gateway/router.ts`

In the `initRouter` function or where messages are processed, extract
the tenant_id from the conversation and set it on the LLM router:

```typescript
import { llm } from '../brain/llm.js';

// Inside the message handler, before calling llm.chatRouted:
llm.setTenant(conversation.tenantId);
```

If your conversations don't have a tenantId yet, add it to the
conversation metadata in the database and extract it from the
incoming message context.

## 7. Tests

New file: `src/brain/tenant-provider-keys.test.ts`

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setTenantProviderKey, getTenantProvider, removeTenantProviderKey } from './tenant-provider-keys.js';
import { initDb, pool } from '../memory/db.js';

beforeAll(async () => {
  await initDb();
  // Run migration to create table
});

afterAll(async () => {
  await pool.query('DELETE FROM tenant_provider_keys WHERE tenant_id = $1', ['test-tenant']);
});

describe('tenant provider keys', () => {
  it('stores and retrieves an encrypted key', async () => {
    await setTenantProviderKey('test-tenant', 'nvidia', 'nvapi-test-key-123');
    const result = await getTenantProvider('test-tenant', 'nvidia');
    expect(result).not.toBeNull();
    expect(result!.apiKey).toBe('nvapi-test-key-123');
    expect(result!.provider).toBe('nvidia');
  });

  it('returns null for unknown tenant/provider', async () => {
    const result = await getTenantProvider('nonexistent', 'nvidia');
    expect(result).toBeNull();
  });

  it('removes a key', async () => {
    await setTenantProviderKey('test-tenant', 'openai', 'sk-test');
    await removeTenantProviderKey('test-tenant', 'openai');
    const result = await getTenantProvider('test-tenant', 'openai');
    expect(result).toBeNull();
  });
});
```

## Implementation order

1. Add NVIDIA to provider-registry.ts (step 0)
2. Add migration (step 1)
3. Create tenant-provider-keys.ts (step 2)
4. Modify llm.ts (step 3c; the clean approach in chatRouted)
5. Create tenant-keys.ts API routes (step 4)
6. Register routes in web.ts (step 5)
7. Wire tenantId in router.ts (step 6)
8. Build and test: `pnpm build && pnpm test`
9. Run the new tests specifically: `pnpm test -- tenant-provider`

## Pitfalls

- NEVER log or echo the decrypted API key; use `***masked***` in logs
- The encryption key must be 32 bytes for AES-256. Set `TENANT_KEY_ENCRYPTION_KEY`
  in .env for production (32+ char random string)
- Tenant IDs come from the existing subscriptions table
- Provider keys are per-tenant, per-provider; one tenant can have multiple
- If a tenant has no key for a provider, fall back to global env var
- Do NOT modify the PROVIDER_DEFINITIONS array structure; only append
- The `setTenant()` call must happen BEFORE `chatRouted()`; set it in the
  message handler in router.ts
