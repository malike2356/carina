# BYOK: Ops Panel Management UI

The BYOK backend is fully implemented in `core.carinaai.uk`:

- `src/brain/tenant-provider-keys.ts` - AES-256-CBC encrypt/decrypt, `setTenantProviderKey`, `removeTenantProviderKey`, `listTenantProviders`
- `src/api/tenant-keys.ts` - REST router at `/api/tenant/providers` (GET list, POST add, DELETE remove)
- `src/memory/migrations.ts` - `tenant_provider_keys` table migration in place
- `src/brain/llm.ts` - `setTenant()` applies tenant keys per request

The ops panel (`ops.carinaai.uk`) already shows BYOK keys read-only in `views/tenant-detail.ejs` (BYOK section lists provider name and enabled status). What's missing: add, remove, and enable/disable controls.

## What to build

All changes are in `ops.carinaai.uk/`.

### 1. `lib/tenant-byok.ts` (new file)

DB helper for the ops panel. Uses the same `pool` from `lib/db.ts` and the same AES-256-CBC scheme as Carina.

```typescript
import crypto from 'crypto';
import { pool, query } from './db.js';

export interface ProviderKeyRow {
  provider: string;
  enabled: boolean;
  hasCustomBaseUrl: boolean;
  hasCustomModel: boolean;
}

function encryptionKey(): Buffer {
  const k = process.env.TENANT_KEY_ENCRYPTION_KEY
    ?? process.env.CARINA_ENCRYPTION_KEY
    ?? 'carina-dev-key-change-in-production-32';
  return Buffer.from(k.slice(0, 32), 'utf-8');
}

function encrypt(plaintext: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', encryptionKey(), iv);
  let enc = cipher.update(plaintext, 'utf-8', 'hex');
  enc += cipher.final('hex');
  return `${iv.toString('hex')}:${enc}`;
}

export async function listProviderKeys(tenantId: string): Promise<ProviderKeyRow[]> {
  const res = await query<{
    provider: string; enabled: boolean;
    custom_base_url: string | null; custom_model: string | null;
  }>(
    `SELECT provider, enabled, custom_base_url, custom_model
     FROM tenant_provider_keys WHERE tenant_id = $1 ORDER BY provider`,
    [tenantId],
  );
  return res.rows.map((r) => ({
    provider: r.provider,
    enabled: r.enabled,
    hasCustomBaseUrl: !!r.custom_base_url,
    hasCustomModel: !!r.custom_model,
  }));
}

export async function addProviderKey(
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
    [tenantId, provider, encrypted, baseUrl || null, model || null],
  );
}

export async function removeProviderKey(tenantId: string, provider: string): Promise<void> {
  await pool.query(
    'DELETE FROM tenant_provider_keys WHERE tenant_id = $1 AND provider = $2',
    [tenantId, provider],
  );
}

export async function toggleProviderKey(
  tenantId: string,
  provider: string,
  enabled: boolean,
): Promise<void> {
  await pool.query(
    `UPDATE tenant_provider_keys SET enabled = $3, updated_at = NOW()
     WHERE tenant_id = $1 AND provider = $2`,
    [tenantId, provider, enabled],
  );
}
```

### 2. `routes/tenants.ts` - add three POST routes

Add after the existing `POST /:id/notes` route. Import `addProviderKey`, `removeProviderKey`, `toggleProviderKey` from `../lib/tenant-byok.js`.

```typescript
// POST /tenants/:id/provider-keys  - add or overwrite a provider key
tenantsRouter.post('/:id/provider-keys', async (req, res) => {
  const { provider, apiKey, baseUrl, model } = req.body as {
    provider?: string; apiKey?: string; baseUrl?: string; model?: string;
  };
  if (!provider?.trim() || !apiKey?.trim()) {
    return res.redirect(`/tenants/${req.params.id}?tab=byok&err=provider+and+API+key+required`);
  }
  try {
    await addProviderKey(req.params.id, provider.trim(), apiKey.trim(), baseUrl?.trim(), model?.trim());
    await logAudit(req.params.id, 'byok:add', `admin`, { provider: provider.trim() });
    res.redirect(`/tenants/${req.params.id}?tab=byok&ok=key-saved`);
  } catch (err) {
    res.redirect(`/tenants/${req.params.id}?tab=byok&err=${encodeURIComponent(String(err))}`);
  }
});

// POST /tenants/:id/provider-keys/:provider/remove
tenantsRouter.post('/:id/provider-keys/:provider/remove', async (req, res) => {
  try {
    await removeProviderKey(req.params.id, req.params.provider);
    await logAudit(req.params.id, 'byok:remove', 'admin', { provider: req.params.provider });
    res.redirect(`/tenants/${req.params.id}?tab=byok&ok=key-removed`);
  } catch (err) {
    res.redirect(`/tenants/${req.params.id}?tab=byok&err=${encodeURIComponent(String(err))}`);
  }
});

// POST /tenants/:id/provider-keys/:provider/toggle
tenantsRouter.post('/:id/provider-keys/:provider/toggle', async (req, res) => {
  const enabled = req.body.enabled === 'true';
  try {
    await toggleProviderKey(req.params.id, req.params.provider, enabled);
    res.redirect(`/tenants/${req.params.id}?tab=byok&ok=toggled`);
  } catch (err) {
    res.redirect(`/tenants/${req.params.id}?tab=byok&err=${encodeURIComponent(String(err))}`);
  }
});
```

Update `flashMessage()` to handle `ok=key-saved`, `ok=key-removed`, `ok=toggled`.

### 3. Update `fetchTenantById` in `lib/tenants.ts`

The existing code already queries `tenant_provider_keys` and returns `providers: Array<{ provider: string; enabled: boolean }>`. No changes needed - the existing data is sufficient.

But `VALID_TABS` in `routes/tenants.ts` does not include `'byok'`. Add it:

```typescript
const VALID_TABS = ['overview', 'subscription', 'payments', 'usage', 'packs', 'access', 'byok', 'audit'] as const;
```

### 4. `views/tenant-detail.ejs` - wire up the BYOK section

The BYOK section already exists at line ~309. Replace the read-only section with an interactive version.

The section currently:
- Shows "No provider keys configured." when `!tenant.providers.length`
- Lists `{ provider, enabled }` rows

Replace with:

```ejs
<% } else if (tab === 'byok') { %>
<section class="space-y-6">
  <%# Flash message %>
  <% if (flash.text) { %>
    <div class="<%= flash.isError ? 'bg-red-900/30 border-red-700 text-red-300' : 'bg-green-900/30 border-green-700 text-green-300' %> border rounded px-4 py-2 text-sm">
      <%= flash.text %>
    </div>
  <% } %>

  <%# Existing keys %>
  <div class="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg overflow-hidden">
    <div class="px-4 py-3 border-b border-[#2a2a2a] flex items-center justify-between">
      <h2 class="text-sm font-semibold text-white">Provider keys</h2>
      <span class="text-xs text-gray-500"><%= tenant.providers.length %> configured</span>
    </div>
    <% if (!tenant.providers.length) { %>
      <p class="p-6 text-sm text-gray-500">No provider keys configured.</p>
    <% } else { %>
      <table class="w-full text-sm">
        <thead class="text-gray-500 border-b border-[#2a2a2a] bg-[#141414]">
          <tr>
            <th class="text-left px-4 py-2">Provider</th>
            <th class="text-left px-4 py-2">Status</th>
            <th class="text-left px-4 py-2">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-[#2a2a2a]">
          <% for (const p of tenant.providers) { %>
            <tr class="text-gray-300">
              <td class="px-4 py-3 font-mono text-[#06b6d4]"><%= p.provider %></td>
              <td class="px-4 py-3">
                <span class="<%= p.enabled ? 'text-green-400' : 'text-gray-500' %>">
                  <%= p.enabled ? 'active' : 'disabled' %>
                </span>
              </td>
              <td class="px-4 py-3 flex gap-2">
                <form method="post" action="/tenants/<%= tenant.id %>/provider-keys/<%= p.provider %>/toggle">
                  <input type="hidden" name="enabled" value="<%= p.enabled ? 'false' : 'true' %>">
                  <button type="submit" class="text-xs px-2 py-1 rounded border border-[#2a2a2a] hover:border-gray-500 text-gray-400">
                    <%= p.enabled ? 'Disable' : 'Enable' %>
                  </button>
                </form>
                <form method="post" action="/tenants/<%= tenant.id %>/provider-keys/<%= p.provider %>/remove"
                      onsubmit="return confirm('Remove <%= p.provider %> key for this tenant?')">
                  <button type="submit" class="text-xs px-2 py-1 rounded border border-red-800 text-red-400 hover:border-red-600">
                    Remove
                  </button>
                </form>
              </td>
            </tr>
          <% } %>
        </tbody>
      </table>
    <% } %>
  </div>

  <%# Add / overwrite key %>
  <div class="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4">
    <h2 class="text-sm font-semibold text-white mb-3">Add or overwrite provider key</h2>
    <form method="post" action="/tenants/<%= tenant.id %>/provider-keys" class="space-y-3">
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="text-xs text-gray-500 block mb-1">Provider name</label>
          <input name="provider" required placeholder="e.g. deepseek, openai, anthropic"
            class="w-full bg-[#0f0f0f] border border-[#2a2a2a] rounded px-3 py-2 text-sm text-white placeholder-gray-600">
        </div>
        <div>
          <label class="text-xs text-gray-500 block mb-1">API key</label>
          <input name="apiKey" type="password" required
            class="w-full bg-[#0f0f0f] border border-[#2a2a2a] rounded px-3 py-2 text-sm text-white">
        </div>
        <div>
          <label class="text-xs text-gray-500 block mb-1">Custom base URL (optional)</label>
          <input name="baseUrl" placeholder="https://..."
            class="w-full bg-[#0f0f0f] border border-[#2a2a2a] rounded px-3 py-2 text-sm text-white placeholder-gray-600">
        </div>
        <div>
          <label class="text-xs text-gray-500 block mb-1">Model override (optional)</label>
          <input name="model" placeholder="e.g. gpt-4o-mini"
            class="w-full bg-[#0f0f0f] border border-[#2a2a2a] rounded px-3 py-2 text-sm text-white placeholder-gray-600">
        </div>
      </div>
      <button type="submit"
        class="text-sm bg-[#22c55e] hover:bg-green-400 text-black px-4 py-2 rounded font-medium">
        Save key
      </button>
    </form>
    <p class="text-xs text-gray-600 mt-3">
      Keys are AES-256 encrypted at rest. Saving overwrites any existing key for that provider.
    </p>
  </div>
</section>
```

Also add "BYOK" to the tab navigation in `tenant-detail.ejs`. Find the existing tabs list (overview, subscription, payments, usage, packs, access, audit) and insert:

```ejs
<a href="?tab=byok" class="tab-link <%= tab === 'byok' ? 'active' : '' %>">BYOK</a>
```

### 5. `flashMessage()` additions

```typescript
if (query.ok === 'key-saved') return { text: 'Provider key saved.', isError: false };
if (query.ok === 'key-removed') return { text: 'Provider key removed.', isError: false };
if (query.ok === 'toggled') return { text: 'Provider key updated.', isError: false };
```

## Constraints

- No changes to `core.carinaai.uk/` - only ops panel
- Encryption in `lib/tenant-byok.ts` must be identical to `core.carinaai.uk/src/brain/tenant-provider-keys.ts` (same key env vars, same AES-256-CBC, same `iv:hex` format)
- Use `logAudit` for add/remove actions (already imported in `routes/tenants.ts`)
- Forms use POST (HTML forms don't support DELETE); POST `/:id/provider-keys/:provider/remove` and `/:id/provider-keys/:provider/toggle`
- No em dashes in any output. No emojis.
- No new npm packages

## No tests required

The ops panel has no test suite. Write the code clean and correct first time.
