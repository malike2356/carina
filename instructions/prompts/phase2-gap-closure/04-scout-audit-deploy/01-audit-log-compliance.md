# Phase 2.12 — Full Audit Log & Compliance

## Goal
Build Scout's immutable audit log. Every tool call, model request, security event, and admin action is recorded with full context. Searchable, exportable, and GDPR-compliant. This fulfills "Full Audit Log & Compliance" on both websites.

## Files to create
```
packages/scout/src/
  audit/
    audit-logger.ts             — Audit event writer
    audit-store.ts              — PostgreSQL audit table with immutability
    audit-search.ts             — Search API with filters
    audit-export.ts             — CSV/PDF export
    audit-retention.ts          — Configurable retention policies
    audit-schemas.ts            — Event type definitions
    compliance/
      gdpr-report.ts            — GDPR compliance report generator
      data-access-request.ts    — SAR (Subject Access Request) handler
      data-deletion.ts          — Right to erasure handler
      retention-policy.ts       — Auto-deletion schedules
```

## Audit event schema
```typescript
interface AuditEvent {
  id: string;                    // UUID
  timestamp: Date;               // When the event occurred
  tenant_id: string;             // Which tenant
  user_id?: string;              // Which user (if interactive)
  event_type: AuditEventType;    // Category
  action: string;                // What happened
  resource: string;              // What was affected
  detail: Record<string, any>;   // Full context
  result: 'success' | 'failure' | 'blocked';
  severity: 'info' | 'warning' | 'critical';
  session_id?: string;           // Link to conversation
  request_id?: string;           // Link to API request
  ip_address?: string;           // Source IP
  user_agent?: string;           // Client info
}
```

## Event types logged

### Tool calls
```
event_type: "tool_execution"
action: "terminal"
detail: { command: "ls -la", exit_code: 0, duration_ms: 45, output_length: 230 }
```

### Model requests
```
event_type: "model_request"
action: "chat_completion"
detail: { provider: "deepseek", model: "deepseek-v4-pro", tokens_in: 450, tokens_out: 120, cost_estimate: 0.002 }
```

### Security events
```
event_type: "security"
action: "injection_blocked"
detail: { layer: 1, pattern_id: "INJ-001", input_snippet: "ignore all previous..." }
severity: "critical"
```

### Admin actions
```
event_type: "admin"
action: "kill_switch_triggered"
detail: { triggered_by: "laud@carinaai.uk", reason: "injection bypass", agents_stopped: 47 }
```

### Auth events
```
event_type: "auth"
action: "login_success"
detail: { method: "password", ip: "192.168.1.45", location: "London, UK" }
```

## Database immutability
```sql
-- Audit table is append-only
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(255) NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  event_type VARCHAR(50) NOT NULL,
  action VARCHAR(255) NOT NULL,
  detail JSONB,
  severity VARCHAR(20),
  session_id UUID,
  ip_address INET
);

-- No UPDATE or DELETE allowed (enforced by RLS)
CREATE POLICY audit_append_only ON audit_log
  FOR INSERT WITH CHECK (true);
-- No UPDATE policy, no DELETE policy = immutable
```

## Search API
```
GET /api/admin/scout/audit/search
  ?tenant_id=tenant-07
  &event_type=security
  &severity=critical
  &from=2026-06-01
  &to=2026-06-07
  &query=injection
  &page=1
  &per_page=50
```

## GDPR compliance features

### Subject Access Request (SAR)
```
POST /api/admin/compliance/sar
{ "tenant_id": "tenant-07", "email": "user@example.com" }

Response: exports all data for tenant-07 in machine-readable JSON
Timeline: auto-responds within 30 days (GDPR requirement)
```

### Right to Erasure
```
POST /api/admin/compliance/erase
{ "tenant_id": "tenant-07" }

Action:
1. Marks tenant as "erasure_requested"
2. Anonymizes all personally identifiable data
3. Deletes conversations, uploaded files, memory
4. Retains audit log entries (legal requirement) but anonymizes
5. Confirms completion within 30 days
```

### Retention policies
```typescript
const RETENTION_POLICIES = {
  conversations:    90 days,   // Auto-delete after 90 days
  tool_outputs:     30 days,   // Clean up after 30 days
  uploaded_files:   30 days,   // Remove after 30 days
  audit_log:        7 years,   // Legal requirement
  security_events:  7 years,   // Security forensics
  billing_records:  7 years,   // Financial records
  session_metadata: 1 year     // Non-PII metadata
};
```

## Verification
```bash
# 1. Check audit log
curl /api/admin/scout/audit/search?tenant_id=tenant-07&limit=10
# Expected: last 10 audit events for tenant-07

# 2. Search by event type
curl "/api/admin/scout/audit/search?event_type=security&severity=critical"
# Expected: all critical security events

# 3. Export CSV
curl /api/admin/scout/audit/export?from=2026-06-01&to=2026-06-07
# Expected: CSV download with all events in date range

# 4. GDPR SAR
curl -X POST /api/admin/compliance/sar -d '{"tenant_id":"tenant-07"}'
# Expected: JSON export of all tenant data

# 5. GDPR Erasure
curl -X POST /api/admin/compliance/erase -d '{"tenant_id":"tenant-07"}'
# Expected: confirmation, tenant data anonymized
```
