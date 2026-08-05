# Prompt 19: Approvals, Secrets, Credentials, and Security

You are working in the Carina mono-repo at `core.carinaai.uk/`.

## What already exists

**Approval backend:**
- `src/security/approval-store.ts` - exports:
  - `listApprovalRules(): ApprovalRule[]`
  - `listApprovalGrants(includeExpired): ApprovalGrant[]`
  - `listApprovalAudit(limit): ApprovalAuditEntry[]`
  - `addApprovalRule(rule)`, `removeApprovalRule(id)`
  - `ApprovalRule` type: `{ id, scope, toolName, pattern, expiresAt?, createdAt }`
  - `ApprovalGrant` type: `{ id, ruleId, sessionId, grantedAt, expiresAt?, expired }`
  - `ApprovalAuditEntry` type: `{ id, toolName, params, decision, reason, timestamp }`
- `src/security/approval-policy.ts` - `evaluateApproval(request)`, `ApprovalScope`
- `src/cli/commands/approvals-cli.ts` - CLI for approval management

**Secrets backend:**
- `src/ops/secrets-audit.ts` - `auditSecrets(): SecretsAuditResult`, lists which env vars are set
- `src/ops/secrets-plan.ts` - `planSecretsRotation()`, `SecretsRotationPlan`
- `src/ops/secrets-reload.ts` - `reloadSecrets()` - hot-reload secrets from env

**Credentials:**
- `src/credentials/oauth-providers.ts` - OAuth provider definitions
- Sensitive items are listed in `SENSITIVE_BACKUP_ITEMS` constant

**Security page (exists):**
- `packages/web/assets/web/security.html` - existing security page
- Served at GET `/security` with `requireHostedSession` auth

## What to build

The security page already exists. Add four tabs to it: Approvals, Secrets, Audit, Rules.

### Step 1: Create `src/api/approvals-api.ts`

```typescript
import { Router, type Request, type Response } from 'express';
import {
  listApprovalRules, listApprovalGrants, listApprovalAudit,
  addApprovalRule, removeApprovalRule,
} from '../security/approval-store.js';
import { auditSecrets } from '../ops/secrets-audit.js';
import { reloadSecrets } from '../ops/secrets-reload.js';

export const approvalsApiRouter = Router();

// Approval rules
approvalsApiRouter.get('/rules', (_req, res) => {
  res.json({ rules: listApprovalRules() });
});

approvalsApiRouter.post('/rules', async (req, res) => {
  const { scope, toolName, pattern, expiresAt } = req.body ?? {};
  if (!scope || !toolName) {
    res.status(400).json({ error: 'scope and toolName are required' });
    return;
  }
  try {
    const rule = addApprovalRule({ scope, toolName, pattern, expiresAt });
    res.status(201).json(rule);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

approvalsApiRouter.delete('/rules/:id', (req, res) => {
  try {
    removeApprovalRule(req.params.id);
    res.status(204).end();
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// Grants
approvalsApiRouter.get('/grants', (req, res) => {
  const includeExpired = req.query.expired === '1';
  res.json({ grants: listApprovalGrants(includeExpired) });
});

// Audit log
approvalsApiRouter.get('/audit', (req, res) => {
  const limit = Number(req.query.limit) || 50;
  res.json({ entries: listApprovalAudit(limit) });
});

// Secrets audit
approvalsApiRouter.get('/secrets', async (_req, res) => {
  try {
    const result = await auditSecrets();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

approvalsApiRouter.post('/secrets/reload', async (_req, res) => {
  try {
    await reloadSecrets();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});
```

Mount in `createWebServer()`:
```typescript
import { approvalsApiRouter } from '#core/api/approvals-api.js';
app.use('/api/approvals', express.json(), requireAuth, approvalsApiRouter);
```

### Step 2: Enhance `packages/web/assets/web/security.html`

Read the existing file first. Add four tabs inside the workspace section if they don't already exist:

```html
<div style="display:flex;gap:0;border-bottom:1px solid var(--border);margin-bottom:0;">
  <button class="sec-tab active" data-tab="rules">Rules</button>
  <button class="sec-tab" data-tab="grants">Grants</button>
  <button class="sec-tab" data-tab="audit">Audit</button>
  <button class="sec-tab" data-tab="secrets">Secrets</button>
</div>
```

Tab CSS:
```css
.sec-tab { padding:0.55rem 1rem; border:none; border-bottom:2px solid transparent; background:transparent; color:var(--muted); cursor:pointer; font-size:0.82rem; }
.sec-tab.active { color:var(--text); border-bottom-color:var(--accent); }
```

**Rules tab (`#tab-rules`):**
- Lists all approval rules (GET /api/approvals/rules)
- Each rule: tool name, scope badge, pattern if any, expiry if any, Delete button
- "Add rule" form: scope selector (global/profile/session), toolName input, optional pattern, optional expiry
- POST /api/approvals/rules, refresh on success

Rule card example:
```html
<div style="background:var(--surface-2);border:1px solid var(--border);border-radius:8px;padding:0.65rem 0.85rem;margin-bottom:0.35rem;display:flex;align-items:center;gap:0.5rem;">
  <div style="flex:1;">
    <div style="font-size:0.84rem;font-weight:600;">TOOL_NAME</div>
    <div style="font-size:0.72rem;color:var(--muted);">Scope: SCOPE | Pattern: PATTERN | Expires: EXPIRY</div>
  </div>
  <button data-delete-rule="RULE_ID" style="background:none;border:1px solid var(--border);color:var(--danger);border-radius:6px;padding:0.2rem 0.5rem;font-size:0.72rem;cursor:pointer;">Delete</button>
</div>
```

**Grants tab (`#tab-grants`):**
- Lists active grants (GET /api/approvals/grants)
- Checkbox "Include expired" re-fetches with ?expired=1
- Each grant: ruleId, sessionId, granted date, expiry or "never", expired badge
- Read-only (grants are created by the runtime, not manually)
- Skeleton: 3 rows while loading

**Audit tab (`#tab-audit`):**
- Lists recent audit entries (GET /api/approvals/audit?limit=100)
- Each entry: tool name, decision (allow/deny/pending), reason, timestamp
- Decision color: green for allow, red for deny, yellow for pending
- Search input to client-side filter by tool name
- "Load more" button increases limit by 50

Audit row:
```javascript
function renderAuditRow(entry) {
  var decColor = entry.decision === 'allow' ? '#4ade80' : entry.decision === 'deny' ? 'var(--danger)' : '#fbbf24';
  return '<div style="display:flex;align-items:center;gap:0.6rem;padding:0.45rem 0;border-bottom:1px solid var(--border);font-size:0.8rem;">' +
    '<div style="flex:1;min-width:0;">' + escapeHtml(entry.toolName) + '</div>' +
    '<div style="color:' + decColor + ';font-weight:600;white-space:nowrap;">' + escapeHtml(entry.decision || '') + '</div>' +
    '<div style="font-size:0.68rem;color:var(--muted);white-space:nowrap;">' + escapeHtml(entry.reason || '') + '</div>' +
    '<div style="font-size:0.68rem;color:var(--muted);white-space:nowrap;">' + escapeHtml(entry.timestamp ? new Date(entry.timestamp).toLocaleTimeString() : '') + '</div>' +
  '</div>';
}
```

**Secrets tab (`#tab-secrets`):**
- Fetches GET /api/approvals/secrets and renders the audit result
- Shows which env vars are set vs. missing, never shows actual values
- "Reload secrets" button POSTs to /api/approvals/secrets/reload

Secrets panel:
```html
<div style="padding:0.65rem 0;font-size:0.75rem;color:var(--muted);margin-bottom:0.5rem;">
  Values are never shown. Only configuration status is displayed.
</div>
<button id="reload-secrets" style="background:var(--surface-2);border:1px solid var(--border);color:var(--text);border-radius:8px;padding:0.4rem 0.75rem;font-size:0.8rem;cursor:pointer;margin-bottom:0.75rem;">
  Reload secrets from env
</button>
<div id="secrets-list"></div>
```

Secrets list JS:
```javascript
function renderSecrets(result) {
  var el = document.getElementById('secrets-list');
  var groups = result.groups || [];
  el.innerHTML = groups.map(function(g) {
    return '<div style="margin-bottom:1rem;">' +
      '<div style="font-size:0.75rem;text-transform:uppercase;letter-spacing:0.04em;color:var(--muted);margin-bottom:0.35rem;">' + escapeHtml(g.name) + '</div>' +
      (g.vars || []).map(function(v) {
        var setIcon = v.set ? '+ ' : '- ';
        var color = v.set ? '#4ade80' : (v.required ? 'var(--danger)' : 'var(--muted)');
        return '<div style="font-size:0.8rem;color:' + color + ';font-family:monospace;padding:0.15rem 0;">' + setIcon + escapeHtml(v.name) + (v.required && !v.set ? ' (required)' : '') + '</div>';
      }).join('') +
    '</div>';
  }).join('');
}
```

### Step 3: Create `packages/web/assets/web/security-ext.js`

Extend the security page's JS with the tab-switching and API calls for all four tabs. Load this after the existing security page script:

```html
<script src="/security-ext.js"></script>
```

Serve from web-server.ts:
```typescript
app.get('/security-ext.js', (_req, res) => {
  res.set('Cache-Control', 'no-cache');
  res.type('application/javascript').sendFile(path.join(WEB_STATIC, 'security-ext.js'));
});
```

## Tests

Create `src/api/approvals-api.test.ts`:
- GET /api/approvals/rules returns `{ rules: [] }` initially
- POST /api/approvals/rules with missing fields returns 400
- POST /api/approvals/rules with valid body returns 201 and the new rule
- DELETE /api/approvals/rules/:id returns 204
- GET /api/approvals/grants returns `{ grants: [] }`
- GET /api/approvals/audit returns `{ entries: [] }`
- GET /api/approvals/secrets returns result with groups array
- POST /api/approvals/secrets/reload returns `{ ok: true }`

## Acceptance criteria

- Security page has four tabs: Rules, Grants, Audit, Secrets
- Rules tab supports create and delete; each rule shows scope, tool, pattern, expiry
- Grants tab shows active session grants; expired flag is a filter option
- Audit tab shows last 50 decisions with color-coded allow/deny/pending
- Secrets tab shows env var configuration status, never values
- Reload secrets hot-reloads without restart
- All routes require operator authentication
