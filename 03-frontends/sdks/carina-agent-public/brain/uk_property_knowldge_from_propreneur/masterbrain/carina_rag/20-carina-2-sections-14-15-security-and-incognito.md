---
source: `brain/prompts/08-carina-2-0-complete.md`
extracted: 2026-05-15
note: Auto-split for Carina RAG / masterbrain. Verify against live code if implementing.
---

## SECTION 14 - SECURITY ENFORCEMENT

### Tenant Isolation - Enforce at Service Layer

Never rely on the controller for tenant scoping. Every service method that reads or writes tenant data must scope by `tenant_id`.

```php
// Correct pattern - every CarinaService read:
$conversation = CarinaConversation::where('tenant_id', $tenantId)->findOrFail($id);

// Correct pattern - every RAG query:
$chunks = RagChunk::whereHas('document', fn($q) => $q->where('tenant_id', $tenantId))
    ->selectRaw('*, (embedding <=> ?) AS distance', [$vector])
    ->orderBy('distance')
    ->limit($limit)
    ->get();
```

### Role-Based Access - Enforce at Service Layer

Read role definitions from `prompts/03-user-manager.md` and `knowledge/09-auth.md`.

| Role | Carina Access Permitted |
|---|---|
| `admin` | Full capabilities, system prompts, settings, all tenant conversations, analytics |
| `property_manager` | Chat, own conversations, RAG search, document upload, deal analysis |
| `investor` | Chat, own conversations, deal analysis and calculator capabilities |
| `agent` | Chat, own conversations, lead and CRM-related capabilities |
| `staff` | Chat, own conversations, task-related context only |
| `viewer` | Chat (guidance only), no write operations, no sensitive financial outputs |

Implement as a `CarinaAccessGate` service or policy class. Check on every service method that returns sensitive data.

### Cross-Tenant Analytics - Anonymisation Protocol

Reference `prompts/30-gdpr-compliance.md` for GDPR obligations.

When using aggregated data for benchmarks or calculations:

1. Strip: full names, full addresses, phone numbers, email addresses, NI/UTR numbers, company names
2. Replace property addresses with outcode only (e.g. `PO5`) - never full postcode
3. Minimum cohort of 5 records before exposing any aggregate figure
4. Log all cross-tenant analytics queries to `prompts/22-audit-logging.md` audit log
5. Always append to response: `[Analysis based on anonymised aggregated data. No individual tenant data has been used.]`

---

## SECTION 15 - INCOGNITO MODE

### Session Flag Implementation

```php
// On activation - set in session middleware or controller
session(['carina.incognito' => true]);

// Check before ANY write to masterbrain or RAG
if (session('carina.incognito', false)) {
    // SKIP: do not write to masterbrain/, Carina_RAG/, user profiles, or training logs
    return;
}
```

### Activation Triggers - Detect in ChatRequest or Carina middleware

```
"Incognito mode on"
"Private mode"
"Don't learn from this"
"Ethical mode"
"Go incognito"
"Off the record"
"Temporary session"
"Do not memorize this"
```

### Deactivation Triggers

```
"Incognito mode off"
"Back to normal mode"
"Resume learning"
"On the record"
```

### What Is BLOCKED During Incognito

```
- All writes to brain/masterbrain/ (every subfolder)
- All updates to brain/masterbrain/Carina_RAG/ vector store
- User preference / profile creation or updates
- Training data logging
- Retention of any PII
```

### What PERSISTS During Incognito

```
- carina_conversations / carina_messages (for session UX continuity)
- Rate limit increments (incognito does not bypass rate limits)
- Token tracking (for billing accuracy)
- Flag conversation metadata: metadata->incognito = true
```

### Incognito Conversation Cleanup

- `PruneOldConversations` job detects `metadata->incognito = true`
- Deletes these conversations after 24 hours automatically

### Response Header - Every Response While Active

```
[INCOGNITO MODE ACTIVE - No learning or memory is happening]
```

### Once-Per-Session Reminder

```
"You are in incognito mode. Carina will not remember or learn from anything we discuss.
To save anything permanently, exit with 'Back to normal mode'."
```

### If User Asks to Remember Something While Incognito

```
"I cannot remember anything while incognito mode is active.
Exit with 'Back to normal mode' and share this again if you want me to retain it."
```

**Default state: Normal Mode.** Incognito must be activated explicitly each session. Zero learning means zero - no partial exceptions.

---
