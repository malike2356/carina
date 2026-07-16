# Propreneur v3 Architecture

**Principle:** Laravel owns the property OS. Carina kernel owns the agent runtime.

---

## Layer diagram

```
                         Public internet
                               |
                    +----------+----------+
                    |   nginx / Cloudflare |
                    +----------+----------+
                               |
              +----------------+----------------+
              |         Laravel (propreneur-v3)  |
              |  Blade UI, modules, billing,     |
              |  stancl tenancy, Filament, API   |
              +----------------+----------------+
                               |
                   internal Docker network
                   (propreneur_internal)
                               |
         +---------------------+---------------------+
         |                                           |
+--------v--------+                         +--------v--------+
|  Carina sidecar |                         | Postgres + Redis |
|  carina-agent   |                         | (tenant DBs)     |
|  port 4500      |                         +------------------+
|  NOT public     |
+--------+--------+
         |
         |  tool calls (HTTP)
         v
+------------------------------------------+
| Laravel Internal Tool Bridge             |
| POST /api/internal/carina/tools/{name}   |
| Auth: service JWT + tenant context       |
| Executes existing CarinaToolRegistry     |
+------------------------------------------+
```

---

## Responsibility split

| Concern | Owner | Notes |
|---------|-------|-------|
| Tenant resolution (subdomain) | Laravel | stancl/tenancy unchanged |
| User auth (web guard) | Laravel | Session + Sanctum |
| Property CRUD, calculators, pipeline | Laravel modules | No move to Node |
| Agent loop (LLM turns, tool dispatch) | **Carina sidecar** | Replaces `CarinaAgentService` loop |
| Skills (property-uk, workspace) | **Carina sidecar** | `ACTIVE_SKILL_PACKS` |
| Hub pack sync | Sidecar manifest + Laravel cron trigger | Replaces PHP-only compile for runtime |
| Tenant RAG (pgvector) | Laravel DB; **query via bridge** | Kernel never holds tenant DB credentials |
| Remote API / Hub channels | Laravel routes; **dispatch to sidecar** | Adapters stay in PHP |
| Confirmation gates | Laravel stores pending; sidecar pauses | Same UX as v2 |
| Audit | Laravel `CarinaSecurityAuditLogger` | Tool bridge logs every call |
| Scout security | **Required on BE kernel path** | Sidecar client + Tool Bridge guard (prompts 22-23) |
| Billing / subscriptions | Laravel central DB | Unchanged |

---

## Request flow: in-app chat (target)

```
1. User sends message in Propreneur UI
2. Laravel Controller -> CarinaSidecarGateway.chat()
3. Gateway builds JWT { tenant_id, user_id, conversation_id, abilities }
4. POST http://carina:4500/v1/agent/chat  (internal)
5. Sidecar: LLM turn -> needs tool "list_properties"
6. Sidecar -> POST http://laravel/api/internal/carina/tools/list_properties
7. Laravel: CarinaToolRegistry executes PHP tool against tenant DB
8. Result -> sidecar -> next LLM turn -> final reply
9. Laravel persists CarinaMessage rows (same schema as v2)
10. Reply rendered in UI
```

---

## Request flow: Remote API (Aiva / external)

```
External client
  -> POST https://{slug}.propreneur.uk/api/remote/carina/chat
  -> CarinaRemoteGateway (Laravel)
  -> if runtime=kernel: CarinaSidecarGateway
  -> else: CarinaAgentService (fallback)
```

Hub inbound (`carina-hub`) follows the same gateway branch after signature verification.

---

## Tool Bridge contract

### Internal route (Laravel)

```
POST /api/internal/carina/tools/{toolName}
Authorization: Bearer {service_jwt}
X-Carina-Tenant: {tenant_uuid}
X-Carina-User: {user_id}
Content-Type: application/json

{ "args": { ... }, "conversation_id": 123 }
```

Response:

```json
{
  "ok": true,
  "result": { ... },
  "requires_confirmation": false
}
```

On confirmation required:

```json
{
  "ok": true,
  "requires_confirmation": true,
  "pending_token": "uuid",
  "preview": "Human-readable summary"
}
```

### Sidecar registration

Each tool from manifest becomes an HTTP tool in the kernel:

```typescript
// Conceptual; implemented in prompt 14
registerHttpTool({
  name: 'list_properties',
  description: '...',
  parameters: { ... },
  execute: (args, ctx) => laravelToolBridge.call('list_properties', args, ctx),
});
```

---

## JWT claims (tenant context)

| Claim | Purpose |
|-------|---------|
| `sub` | User ID in tenant DB |
| `tid` | Tenant UUID (central) |
| `slug` | Tenant slug for logging |
| `cid` | Carina conversation ID (optional) |
| `abilities` | `carina:chat`, `carina:tools:read`, `carina:tools:write` |
| `exp` | 5 minute TTL |
| `iss` | `propreneur-v3-internal` |

Signed with `CARINA_INTERNAL_JWT_SECRET` (shared Laravel + sidecar).

---

## Data stores

| Store | Contents |
|-------|----------|
| `propreneur_central` | Tenants, domains, subscriptions (unchanged) |
| `propreneur_t_{slug}` | All module data, Carina conversations, RAG |
| Sidecar volume | Compiled skills JSON, session cache, optional kernel memory |
| Redis | JWT nonce, confirmation pending, sidecar session hints |

**Rule:** Sidecar must not connect directly to tenant PostgreSQL. All tenant data access goes through Laravel Tool Bridge or RAG proxy.

---

## Docker services (production)

| Service | Image | Network | Ports |
|---------|-------|---------|-------|
| `nginx` | nginx | public + internal | 443 |
| `propreneur-fpm` | Laravel PHP-FPM | internal | 9000 |
| `carina` | node carina sidecar | internal only | 4500 |
| `postgres` | pgvector/pg16 | internal | 5432 |
| `redis` | redis:7 | internal | 6379 |
| `horizon` | Laravel queue | internal | - |

---

## Feature flags

| Flag | Values | Effect |
|------|--------|--------|
| `CARINA_AGENT_RUNTIME` | `php`, `kernel`, `kernel_canary` | Global default |
| `tenant.settings.carina_runtime` | override per tenant | Pilot tenants |
| `CARINA_SIDECAR_ENABLED` | bool | Kill switch |

Canary: 10% of conversations random assignment for comparison logging (optional).

---

## Security boundaries

1. Sidecar not routable from public internet
2. Internal tool routes reject requests without valid service JWT
3. Tool bridge re-validates user permissions via existing Laravel policies
4. Confirmation writes never execute without `pending_token` resume
5. Cross-tenant: JWT `tid` must match stancl resolved tenant on every internal call

---

## What stays in PHP forever (v3 scope)

- All Eloquent models and migrations
- Calculator services (`RunCalculatorTool` backend)
- Pipeline, CRM, compliance modules
- Billing, mentoring, viCal, accounting
- Filament / Blade UI
- Mobile API controllers (they call same gateway)

---

## What moves to kernel (v3 scope)

- Multi-step agent loop
- LLM provider routing (23 providers vs v2 single chain)
- Skill selection and pack skills
- Kernel memory (optional; tenant long-term memory may stay Laravel-backed)
- Subagents / delegate-task (future Propreneur premium feature)
- Channel message formatting (where not tenant-specific)

---

## Package layout (propreneur-v3 repo)

```
propreneur-v3/
├── app/                          # Laravel (from v2 fork)
├── apps/
│   └── carina/                   # Sidecar wrapper
│       ├── package.json          # pinned carina-agent
│       ├── src/index.ts
│       └── .env.example
├── docker/
│   ├── compose.yml
│   └── carina/Dockerfile
├── routes/
│   └── internal.php              # Tool bridge routes
└── config/carina.php             # Runtime flags, sidecar URL
```

Planning docs live in `carina/02-backends/proprenuer-v3/` until v3 repo is created (prompt 01).

---

## Branding

User-facing: **"Propreneur, powered by Carina"**

Do not expose "sidecar", "kernel", or "v3" in customer UI. Internal docs and env vars may use `CARINA_SIDECAR_*`.
