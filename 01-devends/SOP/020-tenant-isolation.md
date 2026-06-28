# SOP 020: Tenant Isolation
**Classification:** Internal VERLOX only. Do not share externally.
**Source:** Migrated from planning/operations/carina_workspace_tenant_isolation.md
**Last reviewed:** 2026-06-25

---

# Workspace and tenant isolation

This document explains how Carina and Aiva separate one customer's data from another. The three layers are enforced at the database, API key, and file system levels.

---

## Three layers of separation

### Layer 1: Database (Postgres Row-Level Security)

Every query runs through Postgres Row-Level Security. The engine does not need to know about tenants; the database enforces it.

```sql
-- Every table has this
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON conversations
  FOR ALL USING (tenant_id = current_setting('app.tenant_id'));
```

When a user logs in as tenant A, the database sees `tenant_id = 'tenantA'`. When another user logs in as tenant B, the database sees `tenant_id = 'tenantB'`. They can run identical queries (`SELECT * FROM conversations`) and get completely different results. The engine code never changes. The database walls do the work.

### Layer 2: API keys (per-tenant)

For self-hosted Carina users, each operator brings their own provider API keys stored in their own config:

```yaml
# operator config
providers:
  deepseek:
    api_key: sk-their-key-here
  openai:
    api_key: sk-their-openai-key
```

For Aiva (managed): VERLOX provides the API infrastructure and bills tenants for usage via message quotas. Tenant BYOK (bring your own key) is supported via encrypted `tenant_provider_keys` in the database. One tenant's API credentials are never visible to another.

### Layer 3: File system (per-tenant schema / directory)

```
/var/carina/tenants/
  tenantA/
    memory/          <- tenantA's memory, skills, session history
    files/           <- tenantA's uploaded documents
    config/          <- tenantA's settings
  tenantB/
    memory/          <- tenantB's memory, skills, session history
    files/           <- tenantB's uploaded documents
    config/          <- tenantB's settings
```

The engine resolves paths relative to the tenant root. `read_file("config.yaml")` resolves to `/var/carina/tenants/tenantA/config.yaml` for tenant A, and `/var/carina/tenants/tenantB/config.yaml` for tenant B. Same code, different files.

---

## How you (VERLOX operator) use this as a regular user

You do not get a backdoor. If you want to use Aiva as a customer, you sign up at app.carinaai.uk like anyone else:

```bash
# Self-hosted: install and run
npm install -g carina-agent
carina chat

# Aiva: sign up at app.carinaai.uk
```

Behind the scenes, you are a tenant in the database, same as everyone else. The operator tools you use to manage the platform are at:

- `ops.carinaai.uk` (VERLOX engineering: chat with Carina, manage tenants, security proxy, terminal)
- `admin.carinaai.uk` (VERLOX business ops: customers, fleet, revenue, VA queue, audit log)

These are VERLOX-internal only and are never accessible to Aiva customers.

---

## VERLOX operator access (admin.carinaai.uk)

`admin.carinaai.uk` (port 4200, TOTP 2FA) provides VERLOX business operations with:

- `/customers` - all Aiva workspaces with status and plan
- `/customers/[id]` - workspace detail, subscription, usage
- `/fleet` - all Aiva workers across all tenants
- `/fleet/attestation` - cryptographic audit log (SHA-256 per action, tamper-evident PostgreSQL)
- `/revenue` - Stripe revenue view
- `/va-queue` - human VA handoff queue
- `/audit-log` - platform-level audit log

This is the only place VERLOX has aggregate visibility. Customers at app.carinaai.uk see only their own workspace.

---

## Aiva plan quotas (tenant isolation enforced per plan)

| Plan | Messages | Workers |
|------|----------|---------|
| trial | 200 | 1 |
| starter | 2,000 | 1 |
| team | 10,000 | 5 |
| business | Unlimited | Unlimited |

Quota enforcement is per `hosted_users.tenant_id` row. One tenant exceeding quota does not affect another.

---

## What tenants cannot see

- Other tenants' conversations, memory, files, or config
- Platform-level metrics or aggregate data
- `ops.carinaai.uk` or `admin.carinaai.uk` (VERLOX-internal, not routed externally)
- Scout fleet data (Scout at console.labyrinthscout.com is a separate product for Carina self-hosters; Aiva built-in governance does not expose cross-tenant data)

---

## Tests

`src/hosted/hosted-isolation.test.ts` covers:
- Postgres RLS enforcement per tenant
- API key scoping
- Cross-tenant read attempts returning 403/404
- Schema-per-tenant memory isolation
