# Carina AI — Security, Cyber & Forensics Architecture

**Principal:** Security first + AI powered (VERLOX philosophy)  
**Author's background:** MSc Cyber Security & Forensic IT (Distinction) — University of Portsmouth  
**Applies to:** Carina Standalone platform, API, data pipelines, and all user data  

---

## Security Principles

1. **Defence in depth** — Every layer has independent security controls. Breaching one does not expose the system.
2. **Least privilege** — Every user, service, and API key has the minimum permissions needed. Nothing more.
3. **Tenant isolation is inviolable** — No tenant accesses another tenant's data. Not in aggregate. Not in logs. Not in backups.
4. **Zero trust** — No request is trusted by default. Every request is authenticated, authorised, validated, and audited.
5. **Security is not optional** — Every feature must pass security review. No exceptions.
6. **Forensic readiness** — Every action is logged with sufficient detail for post-incident investigation.
7. **Privacy by design** — Data minimisation, purpose limitation, and user control are built in, not bolted on.

---

## Attack Surface

```
┌────────────────────────────────────────────┐
│  ATTACK SURFACE MAP                         │
│                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐ │
│  │  Web UI  │  │  Mobile  │  │  API     │ │
│  │  (Blade) │  │  (Kotlin │  │  (REST)  │ │
│  │          │  │  /Swift) │  │          │ │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘ │
│       │             │             │        │
│  ┌────▼─────────────▼─────────────▼─────┐  │
│  │          AUTH LAYER                   │  │
│  │  Login · Session · MFA · API Keys    │  │
│  └────────────────┬─────────────────────┘  │
│                   │                        │
│  ┌────────────────▼─────────────────────┐  │
│  │          APPLICATION LAYER            │  │
│  │  Input validation · CSRF · Rate limit │  │
│  │  Prompt injection · Jailbreak guards  │  │
│  └────────────────┬─────────────────────┘  │
│                   │                        │
│  ┌────────────────▼─────────────────────┐  │
│  │          TENANT ISOLATION             │  │
│  │  Database-per-tenant · Row-level      │  │
│  │  guards · Cross-tenant audit         │  │
│  └────────────────┬─────────────────────┘  │
│                   │                        │
│  ┌────────────────▼─────────────────────┐  │
│  │          DATA LAYER                   │  │
│  │  Encryption · Access control · Audit  │  │
│  │  Logging · Retention · Forensics     │  │
│  └──────────────────────────────────────┘  │
│                                            │
│  ┌──────────────────────────────────────┐  │
│  │          INFRASTRUCTURE               │  │
│  │  Firewall · OS hardening · Container  │  │
│  │  security · Network isolation         │  │
│  └──────────────────────────────────────┘  │
└────────────────────────────────────────────┘
```

---

## 1. Authentication & Identity

### User Authentication

| Measure | Implementation | Standard |
|---|---|---|
| Password policy | Min 12 chars, mixed case + numbers + symbols. Bcrypt (cost 12). | OWASP |
| MFA | TOTP (authenticator app) or SMS fallback. Required for Ultra/Enterprise. | RFC 6238 |
| Session management | HTTP-only, Secure, SameSite=Strict cookies. 60-minute expiry. Regenerate on privilege escalation. | OWASP ASVS |
| Failed login | 5 attempts = 15-minute lockout. IP throttling. Progressive delay. | OWASP |
| Password reset | Email with 15-minute token. Token is single-use. Invalidated on use. | |
| Device fingerprinting | Optional: flag unrecognised devices/login locations. | |
| Account recovery | Email + KYC questions for Enterprise accounts. | |

### API Key Authentication

| Measure | Implementation |
|---|---|
| Key format | `ca_live_` prefix + 64-character random hex (256-bit entropy) |
| Key storage | Bcrypt hash in database. Key shown once on creation. Never stored in plaintext. |
| Key permissions | Scoped per key: `chat:read`, `knowledge:write`, `admin:all` |
| Key expiry | Optional: set expiry date on key creation. Auto-revoke. |
| Key rotation | User can revoke + regenerate at any time. Old key invalidated immediately. |
| Rate limiting | Per-key: 10/min (Free) → 300/min (Ultra) → Custom (Enterprise) |
| IP allowlisting | Enterprise: restrict key to specific IP ranges. |

### OAuth / SSO (Enterprise)

| Provider | Purpose |
|---|---|
| Google Workspace | Enterprise SSO via SAML 2.0 / OIDC |
| Microsoft Entra ID | Enterprise SSO via SAML 2.0 / OIDC |
| GitHub | Developer-focused OAuth for API users |

---

## 2. Application Security

### Input Validation

| Attack Vector | Mitigation |
|---|---|
| SQL injection | Parameterised queries via Eloquent ORM. No raw SQL in application code. |
| XSS | Blade auto-escaping. Content-Security-Policy header. |
| CSRF | Laravel CSRF tokens on all state-changing requests. SameSite cookies. |
| SSRF | Disallow internal IP ranges in URL fetch endpoints. URL validation whitelist. |
| File upload | MIME type validation. File size limits (50MB standard, 500MB Enterprise). Scan with ClamAV. |
| Command injection | No shell commands from user input. Use PHP APIs. |
| XML injection | Disable XML external entity processing. |
| JSON injection | Strict JSON parsing. Reject malformed payloads. |

### API Input Validation

```php
// Every API endpoint has a FormRequest with strict validation
class ChatRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'message' => ['required', 'string', 'max:8000', new NoPromptInjection()],
            'conversation_id' => ['nullable', 'uuid'],
            'context' => ['nullable', 'array', 'max:10'],
            'context.page' => ['nullable', 'string', 'max:180'],
        ];
    }
}
```

### AI-Specific Security

| Threat | Mitigation |
|---|---|
| **Prompt injection** | System prompt enforces Carina's identity. Input sanitisation strips known jailbreak patterns. User input is separated from system prompt by clear delimiters. |
| **Jailbreaking** | Anomaly detection on incoming messages. Known jailbreak pattern database. Rate-limit repeated attempts. |
| **Data extraction** | Carina cannot repeat system prompt verbatim. Cannot output internal instructions. Cannot list files or databases. |
| **Indirect prompt injection** | Retrieved RAG content is scanned for injection patterns before being passed to the LLM. External content (web search results) is sanitised. |
| **Model poisoning** | Tenant models are isolated. Opt-in training data is anonymised and validated before entering pipeline. |
| **Hallucination** | RAG-grounded responses only. Carina says "I don't know" when confidence is low. Sources cited where available. |

### Prompt Injection Guard

```php
class PromptInjectionGuard
{
    private const KNOWN_PATTERNS = [
        '/ignore all previous instructions/i',
        '/forget everything/i',
        '/you are now/i',
        '/system prompt/i',
        '/DAN|jailbreak|jail broken/i',
        '/output your initial prompt/i',
        '/act as if/i',
        '/do not follow/i',
    ];

    public function isClean(string $input): bool
    {
        foreach (self::KNOWN_PATTERNS as $pattern) {
            if (preg_match($pattern, $input)) {
                Log::warning('Prompt injection attempt detected', [
                    'input_hash' => md5($input),
                    'pattern' => $pattern,
                    'user_id' => auth()->id(),
                ]);
                return false;
            }
        }
        return true;
    }
}
```

---

## 3. Tenant Isolation

### Database-Per-Tenant (stancl/tenancy)

```
Central Database                    Tenant Databases
┌──────────────────┐               ┌──────────────────────┐
│ tenants          │               │ propreneur_t_a       │
│ domains          │               │ └─ tenant's data     │
│ subscriptions    │               │                      │
│ platform_users   │               ├──────────────────────┤
│ usage_rollups    │               │ propreneur_t_b       │
│ (aggregate only) │               │ └─ tenant's data     │
└──────────────────┘               │                      │
                                   ├──────────────────────┤
                                   │ propreneur_t_c       │
                                   │ └─ tenant's data     │
                                   └──────────────────────┘
```

### Isolation Guarantees

| What | How |
|---|---|
| Conversations | Stored in tenant's own DB. Central DB never stores message content. |
| Uploaded documents | Stored in tenant's own DB + tenant-specific storage directory. |
| RAG embeddings | Stored in tenant's own pgvector table. |
| API keys | Stored in tenant's own DB (hashed). |
| Usage logs | Stored in tenant's own DB. Central DB stores rollups only. |
| Fine-tuned models | Stored per-tenant. Never shared. |
| Billing data | Central DB only (tenant ID + amounts). No content. |

### Cross-Tenant Attack Prevention

```php
// Every tenant-scoped query is automatically scoped by the tenancy package
// But belt and braces:

class DealAnalysisService
{
    public function getAnalysis(int $analysisId): DealAnalysis
    {
        // tenancy()->tenant() is auto-resolved from the subdomain
        // This query can only return records from the current tenant's DB
        return DealAnalysis::query()
            ->where('id', $analysisId)
            ->where('tenant_id', tenant('id')) // extra guard
            ->firstOrFail();
    }
}
```

---

## 4. Data Security

### Encryption

| Layer | Algorithm | Key Management |
|---|---|---|
| At rest (database) | AES-256-CBC | Encrypted at storage layer (LUKS/cloud provider). Keys in environment. |
| At rest (files) | AES-256-GCM | Laravel built-in encryption. Keys in `.env`. |
| In transit (external) | TLS 1.3 | Let's Encrypt. Auto-renewing. |
| In transit (internal) | TLS 1.3 | Between Laravel and Python. Self-signed CA for internal. |
| API keys in DB | Bcrypt (cost 12) | One-way hash. Cannot be recovered. |
| Passwords | Bcrypt (cost 12) | One-way hash. |
| Backups | AES-256 | Key separate from backup location. |

### Data Retention & Deletion

| Data Type | Retention | Deletion Method | Forensic Hold? |
|---|---|---|---|
| Chat messages | Per plan (7-365 days) | Soft delete → hard delete after hold | On legal hold |
| Uploaded documents | Duration of subscription | Hard delete files + vectors from DB | On legal hold |
| Usage logs | 90 days rolling | Truncate partition | On legal hold |
| Billing records | 7 years (legal) | Anonymise after 7 years | On legal hold |
| Account data | Until account deletion | Hard delete all tenant databases | 30-day soft delete window |
| Failed auth attempts | 90 days | Rotating log | Always |
| Audit logs | 365 days (Enterprise: 7 years) | Append-only with tamper detection | Always |
| ML training data | Until opt-out | Delete adapters + source data within 7 days | On legal hold |

---

## 5. Forensics & Audit

### Audit Logging

Every security-relevant action is logged with:

```sql
CREATE TABLE audit_log (
    id BIGSERIAL PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    tenant_id UUID,
    user_id INT,
    action_type VARCHAR(50) NOT NULL,       -- 'login', 'api_call', 'doc_upload', 'plan_change', 'key_created'
    resource_type VARCHAR(50),              -- 'conversation', 'document', 'api_key', 'subscription'
    resource_id VARCHAR(100),
    ip_address INET,
    user_agent TEXT,
    request_method VARCHAR(10),
    request_path TEXT,
    response_status INT,
    metadata JSONB,                         -- Additional context
    tamper_hash VARCHAR(64),                -- SHA-256 of previous log entry + this entry
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tamper-evident chain:
-- hash_n = SHA256(hash_{n-1} || action_type || resource_type || timestamp)
```

### What Gets Audited

| Event | Logged | Retention |
|---|---|---|
| Successful login | ✅ | 365 days |
| Failed login | ✅ + IP + user agent | 365 days |
| Password change | ✅ | 365 days |
| MFA enrollment/removal | ✅ | 365 days |
| API key creation/revocation | ✅ | 365 days |
| API key usage | ✅ (sampled at 1:100 for high-volume keys) | 90 days |
| Plan change | ✅ | 7 years (billing) |
| Document upload/delete | ✅ | Duration of subscription + 30 days |
| Account deletion | ✅ | Permanent (after deletion) |
| Data export | ✅ | 365 days |
| Permission change | ✅ | 365 days |
| Admin action (Filament) | ✅ | 365 days |
| ML model training | ✅ | 1 year |
| Provider failover | ✅ | 90 days |

### Forensic Readiness

| Capability | Implementation |
|---|---|
| **Tamper-evident logs** | SHA-256 hash chain. Modifying any entry breaks the chain. |
| **Log immutability** | Logs are written via a separate, read-only-after-write API. Application code cannot modify audit_log. |
| **Log export** | Full audit log export in JSON/CSV format. Available to Enterprise tenants. |
| **Legal hold** | Freeze all logs and data for a tenant on request. No automatic deletion while hold is active. |
| **Point-in-time recovery** | PostgreSQL WAL archiving. Recover to any point within 30 days. |
| **Incident response** | Documented IR plan. Runbook for: data breach, service compromise, tenant compromise, AI failure. |

### Incident Response Plan

```
1. DETECT
   ├─ Automated: failed login spikes, unusual API patterns, provider circuit breaker
   ├─ User-reported: suspicious activity, data exposure
   └─ Proactive: periodic security scanning

2. CONTAIN
   ├─ Disable compromised account
   ├─ Revoke compromised API keys
   ├─ Block originating IP
   └─ Isolate affected tenant DB (if tenant-specific)

3. INVESTIGATE
   ├─ Review audit logs (tamper-evident chain)
   ├─ Determine scope: what was accessed, when, from where
   ├─ Preserve forensic evidence (DB snapshot, log export)
   └─ Determine root cause

4. REMEDIATE
   ├─ Patch vulnerability
   ├─ Rotate all affected keys/credentials
   ├─ Notify affected users (within 72 hours for GDPR)
   └─ Document lessons learned

5. RECOVER
   ├─ Restore from clean backup (if data corrupted)
   ├─ Re-enable accounts with new credentials
   └─ Verify fix

6. REPORT
   ├─ Internal: incident report with timeline + root cause
   ├─ Regulatory: ICO breach notification (if required)
   └─ User: breach notification letter (if personal data involved)
```

---

## 6. Infrastructure Security

### Operating System

| Measure | Implementation |
|---|---|
| OS | Ubuntu 24.04 LTS (minimal install) |
| Updates | Automatic security updates. Manual review for major versions. |
| SSH | Key-only. No password auth. Port non-standard (optional). Fail2ban. |
| Firewall | UFW: allow 22, 80, 443. Deny all other inbound. |
| AppArmor | Enforced for all services. |
| Malware scan | ClamAV on file uploads. Weekly system scan. |
| Rootkit detection | rkhunter weekly. |
| Intrusion detection | Fail2ban + log monitoring (Loki). |

### Docker Security

| Measure | Implementation |
|---|---|
| No privileged containers | All containers run as non-root user. |
| Read-only filesystem | Application containers use read-only root. Writes to tmpfs. |
| Resource limits | CPU, memory, and disk limits per container. |
| Image scanning | Trivy scans for vulnerabilities in base images. |
| Secrets | Never in Dockerfile. Always via environment variables or Docker secrets. |
| Network isolation | Internal network for inter-container communication. Only Nginx exposed to internet. |

### Database Security

| Measure | Implementation |
|---|---|
| Network | PostgreSQL binds to internal Docker network only. Not exposed to internet. |
| Authentication | Password + client certificate (optional). |
| Users | One database user per tenant (future). Shared user for MVP. |
| Connection pooling | PgBouncer. Limits concurrent connections. Prevents connection exhaustion. |
| Encryption | TLS for all client-server connections (internal). |

---

## 7. Privacy & GDPR

| Right | Implementation |
|---|---|
| **Right to be informed** | Privacy policy on signup. Data processing notice. |
| **Right of access** | Data export UI (`/settings/data/export`). JSON + CSV. |
| **Right to rectification** | Profile editing. Conversation deletion. |
| **Right to erasure** | Account deletion → hard-delete all tenant databases within 30 days. |
| **Right to restrict processing** | Opt-out of continuous learning. Limits Carina to pre-loaded knowledge only. |
| **Right to data portability** | Export all conversations + uploaded documents in standard format. |
| **Right to object** | Opt-out of all non-essential processing. |
| **Rights related to automated decision-making** | All AI decisions can be reviewed by a human. Appeal process documented. |
| **Breach notification** | ICO notification within 72 hours. User notification without undue delay. |

### DPA (Data Processing Agreement)

Available for Enterprise tenants. Covers:
- Data processor = VERLOX Ltd (Carina)
- Data controller = Customer (tenant)
- Purpose limitation
- Sub-processor list (AI providers: DeepSeek, OpenAI, Anthropic, Google)
- Data retention and deletion terms
- Security measures (as documented here)
- Breach notification procedures
- Audit rights (Enterprise only)

---

## 8. Security Testing Schedule

| Test | Frequency | Method |
|---|---|---|
| Dependency scanning | Daily | Dependabot / Snyk |
| Static analysis | Every PR | PHPStan level 6, Larastan |
| Dynamic scanning | Weekly | OWASP ZAP |
| Penetration test | Quarterly | External security firm |
| Vulnerability assessment | Monthly | Automated scanner |
| Dependency audit | Monthly | `composer audit` |
| Container scanning | Weekly | Trivy |
| Secret scanning | Real-time | GitLeaks on every push |
| API fuzzing | Monthly | Custom fuzzer |
| Social engineering | Quarterly | Phishing simulation (internal team) |

---

## 9. Responsible Disclosure

Carina has a documented vulnerability disclosure programme:

```
Report vulnerabilities to: security@verlox.uk
PGP key: Available on security.txt
SLA for acknowledgement: 24 hours
SLA for fix: 90 days (critical: 7 days)
Hall of fame: Optional credit in release notes
```

---

## 10. Compliance Roadmap

| Certification | Timeline | Scope |
|---|---|---|
| **ICO registration** | Before launch | Data protection |
| **GDPR compliance** | Before launch | All user data |
| **ISO 27001** | Year 2 | Information security management |
| **Cyber Essentials** | Year 1 | Basic cyber hygiene |
| **Cyber Essentials Plus** | Year 2 | Independent verification |
| **SOC 2 Type I** | Year 2 | Enterprise trust |
| **SOC 2 Type II** | Year 3 | Ongoing compliance |

---

## Security File Structure

```
app/Services/Security/
├── AuditService.php                 # Tamper-evident audit logging
├── PromptInjectionGuard.php         # Jailbreak/prompt injection detection
├── RateLimitService.php             # Per-key, per-user, per-IP rate limiting
├── SessionManager.php               # Secure session handling
├── ApiKeyService.php                # Key generation, hashing, scoping
├── TenantIsolationGuard.php         # Cross-tenant data access prevention
├── DataRetentionService.php         # Automated cleanup per plan
├── ForensicsService.php             # Incident evidence collection
└── Contracts/
    └── SecurityEventInterface.php

config/security.php                  # Rate limits, audit config, retention schedules
storage/audit/                       # Append-only audit log (WAL-style)
```

---

## Summary: Security by Layer

| Layer | Key Protections |
|---|---|
| **User** | MFA, strong password policy, device fingerprinting, session management |
| **API** | Key-based auth, scoped permissions, rate limiting, IP allowlisting |
| **Application** | Input validation, CSRF, prompt injection guard, file upload scanning |
| **Tenant** | Database-per-tenant, cross-tenant access guards |
| **Data** | AES-256 encryption at rest + in transit, hashed secrets, automated retention |
| **Audit** | Tamper-evident hash chain, immutable logs, legal hold |
| **Forensics** | Incident response plan, point-in-time recovery, evidence preservation |
| **Infrastructure** | OS hardening, Docker security, firewall, network isolation, ClamAV |
| **Privacy** | GDPR compliance, opt-in learning, data portability, DPAs |
| **Testing** | Daily dependency scanning, weekly dynamic scanning, quarterly pentests |
| **Compliance** | ICO, Cyber Essentials, ISO 27001, SOC 2 (roadmap) |
