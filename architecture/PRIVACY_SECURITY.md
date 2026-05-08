# Carina AI — Privacy & Security

**Last updated:** 8 May 2026  
**Status:** Architecture specification  

---

## Core Principles

1. **Database-per-tenant isolation** — Every tenant gets their own PostgreSQL database. No tenant data is ever mixed.
2. **Encryption at rest** — All tenant databases are encrypted. Backups are encrypted.
3. **Encryption in transit** — All API traffic is HTTPS/TLS 1.3.
4. **Least privilege** — AI providers only see the current request. They cannot enumerate tenants, list documents, or access billing data.
5. **Audit trail** — Every API call, document upload, and model training job is logged.
6. **GDPR by design** — Data portability, right to deletion, right to export.

---

## Tenant Data Isolation

```
┌──────────────────────┐   ┌──────────────────────┐
│  Tenant A Database   │   │  Tenant B Database   │
│  propreneur_t_a      │   │  propreneur_t_b      │
│                      │   │                      │
│  - Conversations     │   │  - Conversations     │
│  - Uploaded docs     │   │  - Uploaded docs     │
│  - RAG embeddings    │   │  - RAG embeddings    │
│  - Usage logs        │   │  - Usage logs        │
│  - Fine-tuned model  │   │  - Fine-tuned model  │
└──────────────────────┘   └──────────────────────┘
         │                           │
         └──────────┬───────────────┘
                    │
         ┌──────────▼───────────┐
         │  Central Database    │
         │  (Tenant metadata)   │
         │  - Tenant records    │
         │  - Billing/subscriptions
         │  - Platform settings │
         └──────────────────────┘
```

- No cross-tenant queries. No shared vector stores. No aggregated training data across tenants.
- Tenant databases are created, migrated, and destroyed independently.
- Billing data is in the central DB only (tenant ID + subscription + usage rollups). No conversation content.

---

## Continuous Learning (Opt-In Only)

### Feature: Train My AI

Available to Pro+ tier and above. Allows users to:

1. Upload documents (PDF, DOCX, TXT, MD, URL, audio)
2. Documents are chunked, embedded, and stored in the tenant's RAG store
3. Carina references these documents when answering that tenant's questions
4. **Optional:** Opt-in to fine-tune a private model on anonymised data

### Opt-In Levels

| Level | What's Shared | Result |
|---|---|---|
| **Off (default)** | Nothing | Carina uses pre-loaded knowledge + tenant's own uploaded RAG docs |
| **Conversation only** | Anonymised chat logs (no personal data) | Carina improves response quality for that tenant's account |
| **Full training** | Anonymised data + feedback scores | A per-tenant LoRA adapter is trained. Never shared with other tenants. |

### Privacy Guarantees

- Opt-in is off by default for all new accounts.
- User can toggle on/off at any time.
- Opting out triggers deletion of all training data within 7 days.
- No tenant data is ever used to train public/general models.
- Fine-tuned adapters are per-tenant and deleted with the account.
- Uploaded documents remain in the tenant's own database only.
- API call payloads are never logged beyond the usage metering system (token counts only).

---

## API Security

| Measure | Detail |
|---|---|
| Authentication | Bearer token (`Authorization: Bearer ca_live_xxx`) |
| Key generation | 64-character random hex. Generated via `/settings/api-keys`. |
| Key rotation | User can revoke and regenerate at any time. |
| Key permissions | Read-only chat, read+write knowledge, admin (Enterprise only). |
| Rate limiting | Per-key: 10/min (Free) → 300/min (Ultra) → Custom (Enterprise). |
| IP allowlisting | Enterprise tier: restrict API keys to specific IP ranges. |
| Request validation | All inputs validated. JSON Schema for complex endpoints. |
| Response sanitisation | No SQL, no file paths, no internal stack traces in responses. |
| CORS | Configurable per tenant. Enterprise can set custom origins. |

### API Key Scopes

| Scope | Permissions | Available To |
|---|---|---|
| `chat:read` | Send messages, read conversation history | All paid tiers |
| `knowledge:read` | Search uploaded documents | Pro+ and above |
| `knowledge:write` | Upload new documents | Pro+ and above |
| `analytics:read` | Access ML reports (deals, areas, portfolio) | Pro+ and above |
| `billing:read` | Read usage data and invoices | All paid tiers |
| `admin:all` | Full API access (manage users, billing) | Enterprise only |

---

## Data Retention

| Data Type | Retention | Deletion |
|---|---|---|
| Chat history (Free) | 7 days | Automatic |
| Chat history (Pro) | 30 days | Automatic |
| Chat history (Pro+) | 90 days | Automatic |
| Chat history (Ultra) | 365 days | Automatic |
| Chat history (Enterprise) | Forever | On request |
| Uploaded documents | Duration of subscription | On plan downgrade or account deletion |
| Fine-tuned models | Duration of subscription + 30 days | On opt-out or account deletion |
| Usage logs | 90 days (rolling) | Automatic |
| Billing records | 7 years (legal requirement) | Permanent (anonymised) |
| Personal data (GDPR) | On request | Full export + hard delete within 30 days |

---

## DevOps Security

| Measure | Detail |
|---|---|
| VPS firewall | Ports restricted: 22 (SSH), 80/443 (HTTPS), DB ports internal only |
| Docker | No privileged containers. Read-only root filesystem where possible. |
| Secrets | Never in code. `.env` file (local) or environment variables (production). |
| Monitoring | Failed login alerts, unusual API usage alerts, provider outage alerts. |
| Backups | Daily automated backups. 7-day retention. Encrypted. |
| Updates | Automated security patch updates. Manual review for major versions. |
