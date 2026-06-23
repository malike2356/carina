# GAP: Terminal - RBAC and Multi-tenant Isolation (Tier 3)

**Status: COMPLETED 2026-06-23**

**What was built:**
- `workspace_members` table and `terminal_audit_log` (migration `0008_terminal_rbac.sql`, schema.ts)
- `lib/terminal-access.ts` and `terminal-access-policy.ts` (owner/member RBAC, master switch)
- Middleware block for `x-carina-operator-token` on `/api/terminal`
- Terminal settings UI toggles for workspace owner; audit log API at `/api/terminal/audit`


## Post-build (MANDATORY)

When all "Done When" criteria in this prompt are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file (use today's date).
2. Add a "**What was built:**" bullet list of key files or features shipped.
3. Move this file from `carina/internal/prompts/pending_prompts/` to `carina/internal/prompts/archived_prompts/pending_prompts/`, keeping the same relative path. Use `git mv` when possible.
4. If every prompt in this gap folder is COMPLETED, move the whole gap folder and update its `README.md` the same way.
5. Do not leave completed prompts in `pending_prompts/`; agents treat that folder as active work only.

Full checklist: `carina/internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`

## Context

This gap assumes Tier 2 (Docker sandbox, gap-terminal-02) is already complete.
Tier 2 gives filesystem isolation per workspace. This gap adds role-based access control
and defines the access model for Carina as a multi-tenant SaaS product.

## Problem statement

Carina workspaces can have multiple members (owner + invited collaborators). When Carina is
sold as a product to operators, those operators may themselves have end users. The terminal
must never be reachable by end users of a Carina-powered product, and even within an operator
workspace it must be controlled per-role.

## Role model

Define three principals:

| Principal | Description | Terminal access |
|---|---|---|
| Workspace owner | Created the workspace, pays the bill | Configurable: can enable/disable terminal for themselves and grant it to members |
| Workspace member (collaborator) | Invited by owner | No terminal by default; owner can grant `terminal` permission per member |
| End user (chat user of an operator-deployed Carina) | External user talking to a Carina agent | Never - hard block, not configurable |

## DB changes needed

### 1. Workspace members table (may already exist - check schema)

```sql
CREATE TABLE IF NOT EXISTS workspace_members (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role         VARCHAR(30) NOT NULL DEFAULT 'member',  -- 'owner' | 'member'
  permissions  JSONB NOT NULL DEFAULT '{}',
  invited_at   TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(workspace_id, user_id)
);
```

### 2. Terminal permission field in member permissions JSONB

```json
{ "terminal": true }
```

### 3. workspace_settings.terminal_enabled remains the workspace-level master switch

If `terminal_enabled = false`, nobody in the workspace can use the terminal regardless of
member permissions. If `terminal_enabled = true`, only members with
`permissions->>'terminal' = 'true'` can use it.

## API changes needed

### Replace the current `requireTerminalAccess(workspaceId)` in `api/terminal/route.ts`

```typescript
async function requireTerminalAccess(workspaceId: string, userId: string): Promise<boolean> {
  // 1. Check workspace-level master switch
  const [settings] = await db
    .select({ terminalEnabled: workspaceSettings.terminalEnabled })
    .from(workspaceSettings)
    .where(eq(workspaceSettings.workspaceId, workspaceId))
    .limit(1);

  if (!settings?.terminalEnabled) return false;

  // 2. Check if user is the workspace owner
  const [workspace] = await db
    .select({ ownerId: workspaces.userId })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);

  if (workspace?.ownerId === userId) return true;

  // 3. Check member-level permission
  const [member] = await db
    .select({ permissions: workspaceMembers.permissions })
    .from(workspaceMembers)
    .where(and(
      eq(workspaceMembers.workspaceId, workspaceId),
      eq(workspaceMembers.userId, userId),
    ))
    .limit(1);

  const perms = (member?.permissions ?? {}) as Record<string, unknown>;
  return perms['terminal'] === true;
}
```

## Settings UI changes

In `/settings` (workspace settings page), add a "Terminal" section visible only to workspace
owners:

- Master toggle: "Enable terminal for this workspace" (maps to `workspace_settings.terminal_enabled`)
- Member list: for each member, a toggle "Allow terminal access" (maps to member permissions JSONB)

## Operator vs end-user separation

If Carina adds a concept of "deployed agents" (operators embed Carina in their product for
external end users), the terminal must be blocked at the middleware level for any request
that carries an `x-carina-operator-token` header (the header operators use to authenticate
their end users against the agent, not the full workspace auth).

Add to `src/middleware.ts`:

```typescript
// Block terminal access for operator-token-authenticated requests (end users)
if (request.nextUrl.pathname.startsWith('/api/terminal') && request.headers.get('x-carina-operator-token')) {
  return new NextResponse(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
}
```

## Docker container isolation per workspace member

Currently Tier 2 provisions one workspace directory per `workspaceId`. In a multi-member
workspace, all members with terminal access share the same container volume mount.

Decision required before implementing:
- Shared volume (all members see the same files): simpler, collaborative
- Per-member volume (`/home/malike/workspaces/${workspaceId}/${userId}/`): fully isolated

Recommendation: shared volume scoped to workspace (mirrors how filesystem access works in
a shared server). Members can see each other's files within the workspace, but not other
workspaces.

## Acceptance criteria

- [x] Workspace owner with `terminal_enabled = false`: GET /api/terminal returns 403
- [x] Workspace owner with `terminal_enabled = true`: 200
- [x] Workspace member without terminal permission: 403
- [x] Workspace member with terminal permission granted: 200
- [x] Any request with `x-carina-operator-token`: 403 regardless of settings
- [x] Terminal commands appended to `terminal_audit_log`
- [ ] Per-member terminal permission toggles in settings UI (schema/API ready; UI coverage partial)

## Audit logging

Every terminal command run must be appended to an audit log:

```sql
CREATE TABLE IF NOT EXISTS terminal_audit_log (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id   UUID NOT NULL,
  command      TEXT NOT NULL,
  exit_code    INTEGER,
  executed_at  TIMESTAMP NOT NULL DEFAULT NOW()
);
```

Operators (workspace owners) can view their workspace terminal audit log from the settings
or security page. VERLOX can query across all workspaces for incident response.
