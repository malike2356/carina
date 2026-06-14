# SPEC: Missing API Endpoints; Carina Mobile

**Status:** Spec only. Claude to implement.
**Base:** `carina/carinaMobile/`

---

## 1. Cross-Reference: Backend → Mobile

| Backend Endpoint | Mobile Client | Covered? |
|------------------|---------------|----------|
| `GET /api/health` | `CarinaClient.health()` | Done:  |
| `GET /api/config` | `CarinaClient.config()` | Done:  |
| `GET /api/providers` | `CarinaClient.providers()` | Done:  |
| `POST /api/providers/switch` |; | Failed:  |
| `POST /api/chat` | `CarinaClient.chat()` | Done:  |
| `POST /api/chat/send` | (alias for /api/chat) | Done:  |
| `POST /api/clear` | `CarinaClient.clearSession()` | Done:  |
| `GET /api/chat/stream` | `chat-stream.ts` | Done:  |
| `GET /api/hosted/context` | `CarinaClient.hostedContext()` | Done:  |
| `POST /app/auth/login` | `CarinaClient.login()` | Done:  |
| `POST /app/auth/logout` | `CarinaClient.logout()` | Done:  |
| `POST /app/auth/register` |; | Failed:  |
| `POST /app/auth/forgot-password` |; | Failed:  |
| `POST /app/auth/reset-password` |; | Failed:  |
| `GET /app/auth/me` |; | Failed:  |
| `POST /app/auth/billing/checkout` | `billing-client.ts` | Done:  |
| `POST /app/auth/billing/portal` | `billing-client.ts` | Done:  |
| `GET /app/auth/billing/usage` | `billing-client.ts` | Done:  |
| `GET /app/auth/scout/status` | `scout-hosted.ts` | Done:  |
| `GET /app/auth/scout/killswitch/status` | `scout-hosted.ts` | Done:  |
| `POST /app/auth/scout/killswitch/trigger` | `scout-hosted.ts` | Done:  |
| `GET /app/auth/scout/key` |; | Failed:  |
| `POST /app/auth/push/register` | `push-client.ts` | Done:  |
| `DELETE /app/auth/push/unregister` | `push-client.ts` | Done:  |
| `GET /app/auth/push/status` | `push-client.ts` | Done:  |
| `GET /api/memory` (list) | `memory-client.ts` | Done:  |
| `GET /api/memory/search` | `memory-client.ts` (q param) | Done:  |
| `GET /api/memory/sessions` |; | Failed:  |
| `GET /api/memory/stats` |; | Failed:  |
| `POST /api/memory` (create) |; | Failed:  |
| `PUT /api/memory/:id` | `memory-client.ts` | Done:  |
| `DELETE /api/memory/:id` | `memory-client.ts` | Done:  |
| `GET /api/packs/available` | `packs-client.ts` | Done:  |
| `GET /api/packs/active` |; | Failed:  |
| `PUT /api/packs/active` |; | Failed:  |
| `GET /api/packs/installed` | `packs-client.ts` | Done:  |
| `GET /api/packs/custom` |; | Failed:  |
| `POST /api/packs/custom/upload` |; | Failed:  |
| `DELETE /api/packs/custom/:kind/:filename` |; | Failed:  |
| `GET /api/packs/:name` |; | Failed:  |
| `POST /api/packs/:name/install` | `packs-client.ts` | Done:  |
| `POST /api/packs/:name/uninstall` | `packs-client.ts` | Done:  |
| `GET /api/packs/:name/config` |; | Failed:  |
| `PUT /api/packs/:name/config` |; | Failed:  |
| `GET /api/tenant/providers` |; | Failed:  |
| `POST /api/tenant/providers` |; | Failed:  |
| `DELETE /api/tenant/providers/:provider` |; | Failed:  |
| `/app/auth/org/invites` (POST, GET, DELETE) |; | Failed:  |
| `/app/auth/org/invites/accept` |; | Failed:  |

**Excluded (server-side only / web-only / not relevant for mobile):**
- `/webhooks/*`; server inbound only
- `/api/web/context`; web-specific context
- `/api/subscribe`; WebSocket, use SSE stream instead
- Carina Ops routes (`/app/auth/ops/*`); admin web console
- Console Scout routes behind `requireApiKey`; proxied through `/app/auth/scout`

---

## 2. Priority Tiers

###  Tier 1; Auth completeness (user-facing)

| Endpoint | Reason |
|----------|--------|
| `POST /app/auth/register` | Users must be able to sign up from mobile |
| `POST /app/auth/forgot-password` | Password reset flow |
| `POST /app/auth/reset-password` | Complete reset flow |
| `GET /app/auth/me` | Full user profile (email, tier, org, apiKey, scoutActive). Currently mobile only gets partial via `hostedContext` |

###  Tier 2; Feature gaps

| Endpoint | Reason |
|----------|--------|
| `POST /api/providers/switch` | Switch active model provider from mobile |
| `GET /app/auth/scout/key` | Display Scout API key + env snippet for self-hosted setup |
| `GET /api/memory/sessions` | Memory modal session list |
| `GET /api/memory/stats` | Memory analytics |
| `POST /api/memory` | Create memory entries |
| `GET /api/packs/active` | Currently active packs |
| `GET /api/packs/:name` | Pack detail screen |
| `GET /api/packs/:name/config` | Pack configuration |
| `PUT /api/packs/:name/config` | Save pack configuration |

###  Tier 3; Self-hosted / advanced

| Endpoint | Reason |
|----------|--------|
| `GET /api/tenant/providers` | List tenant API keys (self-hosted mode) |
| `POST /api/tenant/providers` | Add tenant API key |
| `DELETE /api/tenant/providers/:provider` | Remove tenant API key |
| `GET /api/packs/custom` | Custom resources |
| `POST /api/packs/custom/upload` | Upload custom skill/knowledge |
| `DELETE /api/packs/custom/:kind/:filename` | Delete custom resource |
| `PUT /api/packs/active` | Set active packs (operator only, unlikely on mobile) |
| `/app/auth/org/invites` | Org member management |

---

## 3. Implementation Plan

### 3.1 Modified file: `src/api/carina-client.ts`

Add methods to the `CarinaClient` class:

```typescript
// ── Auth ──
async register(email: string, password: string): Promise<{ ok: boolean }> {
  return this.request<{ ok: boolean }>('/app/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

async forgotPassword(email: string): Promise<{ ok: boolean }> {
  return this.request<{ ok: boolean }>('/app/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

async resetPassword(token: string, password: string): Promise<{ ok: boolean }> {
  return this.request<{ ok: boolean }>('/app/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ token, password }),
  });
}

async me(): Promise<{
  id: string;
  email: string;
  tier: string;
  apiKey: string | null;
  scoutActive: boolean;
  org: { id: string; name: string; role: string } | null;
}> {
  return this.request('/app/auth/me');
}

// ── Providers ──
async switchProvider(provider: string): Promise<{ active: string }> {
  return this.request<{ active: string }>('/api/providers/switch', {
    method: 'POST',
    body: JSON.stringify({ provider }),
  });
}
```

### 3.2 Modified file: `src/api/memory-client.ts`

Add:

```typescript
export interface MemorySessionRow {
  session_id: string;
  turn_count: number;
  last_active: string;
}

export interface MemorySessionsResponse {
  sessions: MemorySessionRow[];
}

export interface MemoryStatsResponse {
  categories: Array<{ category: string; count: string; chars: string }>;
}

export function listMemorySessions(
  baseUrl: string,
  auth?: GatewayAuthOptions,
): Promise<MemorySessionsResponse> {
  return memoryFetch<MemorySessionsResponse>(baseUrl, '/api/memory/sessions', auth);
}

export function fetchMemoryStats(
  baseUrl: string,
  auth?: GatewayAuthOptions,
): Promise<MemoryStatsResponse> {
  return memoryFetch<MemoryStatsResponse>(baseUrl, '/api/memory/stats', auth);
}

export function createMemory(
  baseUrl: string,
  content: string,
  options?: { category?: string; priority?: number; auth?: GatewayAuthOptions },
): Promise<EpisodicMemory> {
  return memoryFetch<EpisodicMemory>(baseUrl, '/api/memory', options?.auth, {
    method: 'POST',
    body: JSON.stringify({
      content,
      category: options?.category ?? 'general',
      priority: options?.priority ?? 0,
    }),
  });
}
```

### 3.3 Modified file: `src/api/packs-client.ts`

Add:

```typescript
export interface PackConfigResponse {
  config: Record<string, unknown>;
}

export function fetchActivePacks(
  baseUrl: string,
  auth?: GatewayAuthOptions,
): Promise<{
  active: string[];
  installed: InstalledPack[];
  management: string;
  lastChange?: { at: string; by: string; source: string };
}> {
  return packsFetch(baseUrl, '/api/packs/active', auth);
}

export function fetchPackDetail(
  baseUrl: string,
  packName: string,
  auth?: GatewayAuthOptions,
): Promise<PackMeta> {
  return packsFetch(baseUrl, `/api/packs/${encodeURIComponent(packName)}`, auth);
}

export function fetchPackConfig(
  baseUrl: string,
  packName: string,
  auth?: GatewayAuthOptions,
): Promise<PackConfigResponse> {
  return packsFetch(baseUrl, `/api/packs/${encodeURIComponent(packName)}/config`, auth);
}

export function savePackConfig(
  baseUrl: string,
  packName: string,
  config: Record<string, unknown>,
  auth?: GatewayAuthOptions,
): Promise<{ saved: boolean }> {
  return packsFetch(baseUrl, `/api/packs/${encodeURIComponent(packName)}/config`, auth, {
    method: 'PUT',
    body: JSON.stringify(config),
  });
}

export function setActivePacks(
  baseUrl: string,
  packs: string[],
  auth?: GatewayAuthOptions,
): Promise<{ ok: boolean; active: string[] }> {
  return packsFetch(baseUrl, '/api/packs/active', auth, {
    method: 'PUT',
    body: JSON.stringify({ packs }),
  });
}

export interface CustomResourceFile {
  kind: string;
  filename: string;
  size: number;
  modified: string;
}

export function listCustomResources(
  baseUrl: string,
  auth?: GatewayAuthOptions,
): Promise<{ files: CustomResourceFile[] }> {
  return packsFetch(baseUrl, '/api/packs/custom', auth);
}

export function uploadCustomResource(
  baseUrl: string,
  kind: 'skill' | 'knowledge',
  filename: string,
  content: string,
  auth?: GatewayAuthOptions,
): Promise<{ ok: boolean; file: CustomResourceFile }> {
  return packsFetch(baseUrl, '/api/packs/custom/upload', auth, {
    method: 'POST',
    body: JSON.stringify({ kind, filename, content }),
  });
}

export function deleteCustomResource(
  baseUrl: string,
  kind: 'skill' | 'knowledge',
  filename: string,
  auth?: GatewayAuthOptions,
): Promise<{ deleted: boolean }> {
  return packsFetch(
    baseUrl,
    `/api/packs/custom/${encodeURIComponent(kind)}/${encodeURIComponent(filename)}`,
    auth,
    { method: 'DELETE' },
  );
}
```

### 3.4 Modified file: `src/api/scout-hosted.ts`

Add:

```typescript
export interface ScoutKeyResponse {
  apiKey: string;
  instanceId: string;
  envSnippet: string;
}

export function fetchScoutKey(baseUrl: string): Promise<ScoutKeyResponse> {
  return hostedScoutFetch<ScoutKeyResponse>(baseUrl, '/app/auth/scout/key');
}
```

### 3.5 New file: `src/api/tenant-client.ts`

For self-hosted mode:

```typescript
import type { GatewayAuthOptions } from '@/lib/gateway-auth';
import { mergeGatewayInit } from '@/lib/gateway-auth';

export interface TenantProvider {
  provider: string;
  hasKey: boolean;
  baseUrl?: string | null;
  model?: string | null;
}

async function tenantFetch<T>(
  baseUrl: string,
  path: string,
  auth?: GatewayAuthOptions,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(
    `${baseUrl.replace(/\/+$/, '')}${path}`,
    mergeGatewayInit(auth, init),
  );
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Tenant API ${response.status}: ${body || response.statusText}`);
  }
  return response.json() as Promise<T>;
}

export function listTenantProviders(
  baseUrl: string,
  auth?: GatewayAuthOptions,
): Promise<{ providers: TenantProvider[] }> {
  return tenantFetch(baseUrl, '/api/tenant/providers', auth);
}

export function addTenantProvider(
  baseUrl: string,
  provider: string,
  apiKey: string,
  options?: { baseUrl?: string; model?: string; auth?: GatewayAuthOptions },
): Promise<{ success: boolean }> {
  return tenantFetch(baseUrl, '/api/tenant/providers', options?.auth, {
    method: 'POST',
    body: JSON.stringify({
      provider,
      apiKey,
      baseUrl: options?.baseUrl,
      model: options?.model,
    }),
  });
}

export function removeTenantProvider(
  baseUrl: string,
  provider: string,
  auth?: GatewayAuthOptions,
): Promise<{ success: boolean }> {
  return tenantFetch(baseUrl, `/api/tenant/providers/${encodeURIComponent(provider)}`, auth, {
    method: 'DELETE',
  });
}
```

### 3.6 New file: `src/api/org-client.ts`

For hosted org management (Tier 3; deferred):

```typescript
export interface OrgInvite {
  id: string;
  email: string;
  role: string;
  status: string;
  createdAt: string;
  expiresAt: string;
}

export async function listOrgInvites(baseUrl: string): Promise<{ invites: OrgInvite[] }> { ... }
export async function createOrgInvite(baseUrl: string, email: string, role: string): Promise<{ ok: boolean; inviteId: string; token: string }> { ... }
export async function revokeOrgInvite(baseUrl: string, inviteId: string): Promise<{ ok: boolean }> { ... }
export async function acceptOrgInvite(baseUrl: string, token: string): Promise<{ ok: boolean; orgId: string; role: string }> { ... }
```

### 3.7 Modified file: `src/api/types.ts`

Add new types:

```typescript
// Already partially covered; add these if missing:

export interface MeResponse {
  id: string;
  email: string;
  tier: string;
  apiKey: string | null;
  scoutActive: boolean;
  org: { id: string; name: string; role: string } | null;
}

export interface ScoutKeyResponse {
  apiKey: string;
  instanceId: string;
  envSnippet: string;
}
```

---

## 4. Files to Touch

### New files (2)
```
src/api/tenant-client.ts; tenant provider key management
src/api/org-client.ts; org invite management (deferred)
```

### Modified files (6)
```
src/api/carina-client.ts; add register, forgotPassword, resetPassword, me, switchProvider
src/api/memory-client.ts; add listMemorySessions, fetchMemoryStats, createMemory
src/api/packs-client.ts; add fetchActivePacks, fetchPackDetail, fetchPackConfig, savePackConfig, setActivePacks, listCustomResources, uploadCustomResource, deleteCustomResource
src/api/scout-hosted.ts; add fetchScoutKey
src/api/types.ts; add MeResponse, ScoutKeyResponse
```

### Untouched files
- `src/api/chat-stream.ts`; unchanged
- `src/api/billing-client.ts`; unchanged
- `src/api/push-client.ts`; unchanged
- `src/api/scout-trust.ts`; unchanged
- All hooks, components, stores; unchanged

---

## 5. Build Order

1. Update `src/api/types.ts`; add `MeResponse`, `ScoutKeyResponse`
2. Modify `src/api/carina-client.ts`; Tier 1 auth + provider switch
3. Modify `src/api/memory-client.ts`; Tier 2 memory additions
4. Modify `src/api/packs-client.ts`; Tier 2 packs additions
5. Modify `src/api/scout-hosted.ts`; Tier 2 scout key
6. Create `src/api/tenant-client.ts`; Tier 3 tenant providers
7. (Deferred) Create `src/api/org-client.ts`; Tier 3 org invites
8. `pnpm typecheck`; must pass
9. `pnpm test`; must pass
