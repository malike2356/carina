# Feature: Pre-action Approval Workflow

## Context

Scout currently has `require_approval` as a valid `PolicyDecision` value
(`src/security/policy-decisions.ts` line 13). Policy packs have `approvalThreshold`
fields. The `response-terminal.ts` has a `require_approval` case.

None of these enforce the wait. When `policyEvaluate` returns `require_approval`, the
calling agent receives that decision but nothing in Scout stops it from proceeding
immediately. The approval is advice, not enforcement.

This closes the structural gap identified in the governance strategy: Scout must move
from observer to gatekeeper at the tool-call boundary. The mechanism is an approval queue
with an SSE notification channel and a dashboard UI for operators to act on.

This is the most impactful feature in the remaining gap list. Without it, the governance
claim is incomplete: you cannot tell a board or auditor that Scout enforced human oversight
before destructive actions - only that it logged them.

## Architecture

```
Agent calls POST /api/policy/evaluate
  -> returns { decision: 'require_approval', approval_id: '...' }

Agent calls GET /api/approvals/:id/status (poll or SSE)
  -> waits until status is 'approved' | 'rejected' | 'expired'

Operator sees incoming request on dashboard
  -> clicks Approve or Reject
  -> POST /api/approvals/:id/approve|reject

Scout sends SSE event to agent's poll channel
  -> agent unblocks and proceeds (approved) or aborts (rejected/expired)
```

## What to build

### 1. Database migration

File: `src/migrations/add-pending-approvals.ts`

Follows the same pattern as existing migrations in `src/migrations/` (or wherever
the schema files live in this project - check `src/db.ts` for the migration runner).

```sql
CREATE TABLE IF NOT EXISTS pending_approvals (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id TEXT NOT NULL,
  session_id  TEXT NOT NULL,
  tool_name   TEXT,
  action_type TEXT NOT NULL DEFAULT 'unknown',
  content     TEXT,
  params      JSONB,
  risk_score  INTEGER NOT NULL DEFAULT 0,
  policy_pack TEXT,
  regulatory_category TEXT,
  regulation  TEXT,
  requested_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at    TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '15 minutes',
  status        TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),
  decided_by    TEXT,
  decided_at    TIMESTAMPTZ,
  rejection_reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_pending_approvals_status
  ON pending_approvals(status) WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_pending_approvals_instance
  ON pending_approvals(instance_id, requested_at DESC);
```

Run this migration on server startup inside `src/db.ts` (same as other tables). Use
`IF NOT EXISTS` so it is idempotent.

### 2. `src/api/approvals.ts`

New Express router. Mount at `/api/approvals` with `requireApiKey`.

#### `POST /api/approvals/request`

Called by the SDK when `policyEvaluate` returns `require_approval`.

Body:
```typescript
{
  instance_id: string;
  session_id: string;
  tool_name?: string;
  action_type?: string;
  params?: Record<string, unknown>;
  content?: string;
  risk_score?: number;
  policy_pack?: string;
  regulatory_category?: string;
  regulation?: string;
  expires_in_secs?: number; // default 900 (15 min)
}
```

Validation: `instance_id` and `session_id` are required. `expires_in_secs` clamp to
60-3600.

On success:
1. INSERT into `pending_approvals`
2. Publish SSE event `approval_request` to the dashboard channel with the row data
3. Return `{ approval_id, expires_at, status: 'pending' }`

```typescript
res.status(201).json({ approval_id: row.id, expires_at: row.expires_at, status: 'pending' });
```

#### `GET /api/approvals/:id/status`

Agent polls this to know the outcome.

Returns:
```typescript
{
  approval_id: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  decided_by?: string;
  decided_at?: string;
  rejection_reason?: string;
  expires_at: string;
}
```

Before returning, check if the row's `expires_at` has passed and status is still
`pending`. If so, UPDATE status to `expired` and return `expired`.

#### `POST /api/approvals/:id/approve`

Operator approves. Requires `requireSession` (browser auth), not `requireApiKey`.

Body: `{ decided_by?: string }` - defaults to `'operator'`

1. UPDATE `pending_approvals SET status='approved', decided_by=$1, decided_at=NOW()`
2. Publish SSE event `approval_decision` with `{ approval_id, status: 'approved' }`
3. Return `{ ok: true, approval_id, status: 'approved' }`

Returns 404 if approval_id not found or status is not `pending`.
Returns 409 if already decided.

#### `POST /api/approvals/:id/reject`

Operator rejects.

Body: `{ decided_by?: string, reason?: string }`

Same pattern as approve. Sets `rejection_reason` from body.

#### `GET /api/approvals/pending`

Lists all pending approvals for the dashboard. Requires `requireSession`.

Query params: `instance_id` (optional filter), `limit` (default 20, max 100).

Returns array, newest first:
```typescript
Array<{
  id: string;
  instance_id: string;
  session_id: string;
  tool_name: string | null;
  action_type: string;
  risk_score: number;
  regulatory_category: string | null;
  regulation: string | null;
  requested_at: string;
  expires_at: string;
  expires_in_secs: number; // seconds remaining
}>
```

#### `GET /api/approvals/history`

Lists all decided approvals (for audit trail). Requires `requireSession`.

Query params: `status` (approved/rejected/expired), `since`, `limit`.

Returns array with same shape as pending but including `decided_by`, `decided_at`,
`rejection_reason`.

### 3. SSE events for approvals

In `src/api/sse.ts` (the existing SSE stream), add two new event types:

`approval_request` - broadcast when a new approval is created:
```json
{
  "event": "approval_request",
  "data": {
    "approval_id": "...",
    "instance_id": "...",
    "session_id": "...",
    "tool_name": "email-send",
    "action_type": "email",
    "risk_score": 72,
    "regulatory_category": "Financial promotion",
    "expires_at": "2026-06-13T16:30:00Z"
  }
}
```

`approval_decision` - broadcast when operator approves or rejects:
```json
{
  "event": "approval_decision",
  "data": {
    "approval_id": "...",
    "status": "approved",
    "decided_by": "operator",
    "decided_at": "2026-06-13T16:18:00Z"
  }
}
```

Use the existing broadcast mechanism in `sse.ts` - do not create a new channel.

### 4. `POST /api/policy/evaluate` update

In `src/api/policy-evaluate.ts`, when the policy decision is `require_approval`:

Add `approval_id` to the response automatically. Do NOT require the agent to call
`/api/approvals/request` separately - this creates friction. Scout should atomically
create the approval record and return the `approval_id` in the policy decision response.

Modified response shape when `decision === 'require_approval'`:
```typescript
{
  decision: 'require_approval',
  actionType: string;
  reason: string;
  riskScore: number;
  shieldMode: string;
  approval_id: string; // NEW: UUID of the pending_approvals row
  expires_at: string; // NEW: ISO8601 expiry
  poll_url: string; // NEW: '/api/approvals/{approval_id}/status'
}
```

In the handler, after the policy decision is computed, if `decision === 'require_approval'`:
1. INSERT into `pending_approvals` (same logic as `POST /api/approvals/request`)
2. Publish the SSE `approval_request` event
3. Add `approval_id`, `expires_at`, `poll_url` to the response

This is the enforcement path. The agent must have the `approval_id` to proceed - and the
SDK will use it to block until decided.

### 5. SDK update (`labyrinth-scout-sdk/src/client.ts`)

Add two methods to `ScoutClient`:

#### `waitForApproval(approvalId, options?)`

```typescript
async waitForApproval(
  approvalId: string,
  options?: {
    timeoutMs?: number; // default: 14 minutes (one minute before server expiry)
    pollIntervalMs?: number; // default: 3000
  }
): Promise<{ approved: boolean; reason?: string }>
```

Implementation:
1. Poll `GET /api/approvals/{approvalId}/status` at `pollIntervalMs` intervals
2. If status === 'approved': return `{ approved: true }`
3. If status === 'rejected': return `{ approved: false, reason: rejection_reason }`
4. If status === 'expired': return `{ approved: false, reason: 'Approval expired' }`
5. If timeout exceeded: return `{ approved: false, reason: 'Timeout waiting for approval' }`

Fail-open behavior: if the poll request throws a network error, log a warning and
continue polling (same fail-open pattern as `report()`). Do NOT return `approved: true`
on network error - only on explicit server response.

If `!this.enabled`: return `{ approved: true }` immediately (test/disabled mode).

#### `evaluateAndWait(request, options?)`

```typescript
async evaluateAndWait(
  request: PolicyEvaluateRequest,
  options?: {
    waitTimeoutMs?: number;
  }
): Promise<{ proceed: boolean; decision: PolicyDecision; reason?: string }>
```

Combines `policyEvaluate` and `waitForApproval` in one call:

1. Call `policyEvaluate(request)` - gets the policy decision
2. If decision is `'allow'`: return `{ proceed: true, decision }`
3. If decision is `'block'`: return `{ proceed: false, decision, reason: decision.reason }`
4. If decision is `'require_approval'`:
   - Use `decision.approval_id` from the response
   - Call `waitForApproval(decision.approval_id, { timeoutMs: options?.waitTimeoutMs })`
   - Return `{ proceed: result.approved, decision, reason: result.reason }`
5. Any other decision: return `{ proceed: false, decision, reason: 'Unknown decision' }`

This is the one call an agent needs to block correctly on policy.

#### Update `scoutWrap` and `scoutMiddleware`

In `src/wrap.ts` and `src/middleware.ts`:

Replace the existing `policyEvaluate` call with `evaluateAndWait`. If `proceed` is false,
throw an error (wrap) or return 403 (middleware). Include the `reason` in the error message.

### 6. Dashboard UI (approval queue)

In `public/dashboard.html`, add an "Approvals" section below the Live Posture section.

HTML structure:
```html
<div class="op-section" id="approvals-section" aria-label="Pending approvals">
  <div class="section-title">
    Pending Approvals
    <span id="approvals-badge" class="approval-badge hidden">0</span>
  </div>
  <div id="approvals-empty" class="approvals-empty">No pending approvals</div>
  <table id="approvals-table" class="approvals-table hidden">
    <thead>
      <tr>
        <th>Agent</th><th>Tool</th><th>Risk</th><th>Category</th><th>Expires</th><th>Action</th>
      </tr>
    </thead>
    <tbody id="approvals-tbody"></tbody>
  </table>
</div>
```

CSS:
```css
.approval-badge {
  display: inline-block;
  background: var(--red);
  color: #fff;
  font-family: 'JetBrains Mono', monospace;
  font-size: .6rem;
  padding: .1rem .35rem;
  border-radius: 10px;
  margin-left: .4rem;
  vertical-align: middle;
}
.approval-badge.hidden { display: none; }
.approvals-table { width: 100%; border-collapse: collapse; font-size: .75rem; }
.approvals-table th { color: var(--text); font-weight: 500; padding: .3rem .5rem; border-bottom: 1px solid rgba(255,255,255,.08); }
.approvals-table td { padding: .35rem .5rem; border-bottom: 1px solid rgba(255,255,255,.04); color: var(--bright); }
.btn-approve { background: rgba(61,186,124,.15); border: 1px solid rgba(61,186,124,.4); color: var(--green); font-family: 'JetBrains Mono', monospace; font-size: .55rem; padding: .1rem .4rem; border-radius: 2px; cursor: pointer; margin-right: .25rem; }
.btn-reject  { background: rgba(255,34,68,.12); border: 1px solid rgba(255,34,68,.35); color: var(--red); font-family: 'JetBrains Mono', monospace; font-size: .55rem; padding: .1rem .4rem; border-radius: 2px; cursor: pointer; }
```

JS behavior:

On page load and every 15 seconds, `GET /api/approvals/pending` and rebuild the table.

When an `approval_request` SSE event fires, immediately refresh the approvals table and
show a browser notification (if `Notification.permission === 'granted'`):
`"Agent 'email-send' requires approval. Risk: 72."`.

Each row has Approve / Reject buttons:
```javascript
async function approveRequest(id) {
  await fetch(`/api/approvals/${id}/approve`, { method: 'POST', ... });
  refreshApprovals();
}
async function rejectRequest(id, reason) {
  const reason = prompt('Reason for rejection (optional):') ?? '';
  await fetch(`/api/approvals/${id}/reject`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
    ...
  });
  refreshApprovals();
}
```

Badge: show `#approvals-badge` with count when `pending.length > 0`.

When `approval_decision` SSE fires, call `refreshApprovals()` immediately.

### 7. Governance dashboard integration

In `public/governance.html` (from `feature-governance-dashboard.md`):

Add to the governance posture response and display:
```
Human oversight enforced: YES (approval workflow active)
Pending approvals: N
Approvals last 30 days: N approved, N rejected
Average response time: Xm Ys
```

Add `approval_stats` to `GET /api/governance/posture`:
```typescript
approval_stats: {
  workflow_active: boolean; // true if pending_approvals table exists
  pending_count: number;
  approved_30d: number;
  rejected_30d: number;
  expired_30d: number;
  avg_decision_secs: number | null;
}
```

Query:
```sql
SELECT
  COUNT(*) FILTER (WHERE status = 'pending') AS pending,
  COUNT(*) FILTER (WHERE status = 'approved' AND decided_at > NOW() - INTERVAL '30 days') AS approved_30d,
  COUNT(*) FILTER (WHERE status = 'rejected' AND decided_at > NOW() - INTERVAL '30 days') AS rejected_30d,
  COUNT(*) FILTER (WHERE status = 'expired' AND expires_at > NOW() - INTERVAL '30 days') AS expired_30d,
  AVG(EXTRACT(EPOCH FROM (decided_at - requested_at))) FILTER (WHERE decided_at IS NOT NULL) AS avg_secs
FROM pending_approvals
```

This feeds into the EU AI Act `high_risk` check in `feature-regulatory-risk-classification.md`:
if `approval_stats.workflow_active === false` AND agents are running, add it as a gap.

### 8. Tests

File: `src/api/__tests__/approvals.test.ts`

12 tests using Vitest + supertest:

1. `POST /api/approvals/request creates pending approval`
2. `POST /api/approvals/request requires instance_id`
3. `GET /api/approvals/:id/status returns pending for new request`
4. `POST /api/approvals/:id/approve sets status to approved`
5. `POST /api/approvals/:id/reject sets status to rejected with reason`
6. `GET /api/approvals/:id/status returns approved after approval`
7. `POST /api/approvals/:id/approve returns 409 if already decided`
8. `GET /api/approvals/pending returns empty array when none pending`
9. `GET /api/approvals/pending returns pending approvals after request`
10. `Expired approval: status becomes expired when past expires_at`
11. `GET /api/approvals/history returns decided approvals`
12. `POST /api/policy/evaluate with require_approval returns approval_id in response`

File: `labyrinth-scout-sdk/src/__tests__/approval.test.ts`

6 tests for SDK:

1. `waitForApproval: returns approved:true when status is approved`
2. `waitForApproval: returns approved:false with reason when rejected`
3. `waitForApproval: returns approved:false when expired`
4. `waitForApproval: enabled=false returns approved:true immediately`
5. `evaluateAndWait: returns proceed:true for allow decision`
6. `evaluateAndWait: polls and returns proceed:false for rejected approval`

## Files to create/modify

- CREATE `src/migrations/add-pending-approvals.ts`
- CREATE `src/api/approvals.ts`
- CREATE `src/api/__tests__/approvals.test.ts`
- CREATE `labyrinth-scout-sdk/src/__tests__/approval.test.ts`
- MODIFY `src/db.ts` - run the new migration on startup
- MODIFY `src/api/policy-evaluate.ts` - create approval record when decision is require_approval
- MODIFY `src/api/sse.ts` - add approval_request and approval_decision broadcast functions
- MODIFY `src/server.ts` - mount approvalsRouter
- MODIFY `labyrinth-scout-sdk/src/client.ts` - add waitForApproval and evaluateAndWait
- MODIFY `labyrinth-scout-sdk/src/wrap.ts` - use evaluateAndWait
- MODIFY `labyrinth-scout-sdk/src/middleware.ts` - use evaluateAndWait
- MODIFY `labyrinth-scout-sdk/src/index.ts` - export waitForApproval, evaluateAndWait
- MODIFY `public/dashboard.html` - add approvals section
- MODIFY `src/api/governance.ts` - add approval_stats to posture (if exists)

## Do not change

- `src/security/policy-decisions.ts` - `require_approval` is already a valid decision type
- `src/security/policy-packs.ts` - `approvalThreshold` fields stay, this feature activates them
- Existing auth middleware - use requireApiKey for agent-facing routes, requireSession for operator routes

## Acceptance check

Run `npm test`. All existing and new tests pass (18 new tests total across server + SDK).

Manual test:
```bash
# 1. Set policy to guard mode (approvalThreshold: 70)
curl -X POST http://localhost:4444/api/policy-packs/apply \
  -H "X-Scout-Key: $KEY" -d '{"packId":"guard","appliedBy":"test"}'

# 2. Evaluate a risky action
curl -X POST http://localhost:4444/api/policy/evaluate \
  -H "X-Scout-Key: $KEY" \
  -d '{"session_id":"s1","tool_name":"email-send","action_type":"email","content":"sensitive"}'
# -> expect: decision:require_approval, approval_id in response

# 3. Check approval dashboard at http://localhost:4444
# -> expect: one row in Pending Approvals section

# 4. Approve it
curl -X POST http://localhost:4444/api/approvals/{id}/approve \
  -b "connect.sid=..." 
# -> expect: { ok: true, status: 'approved' }

# 5. Check status
curl http://localhost:4444/api/approvals/{id}/status -H "X-Scout-Key: $KEY"
# -> expect: { status: 'approved' }
```
