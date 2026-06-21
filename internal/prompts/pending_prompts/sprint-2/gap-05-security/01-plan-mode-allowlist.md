# Security 01; Plan Mode with Fail-Safe Allowlist

> **REUSE RULE:** See `REUSE-RULES.md` (one level up). Competitor names appear here for context only. All implementation must use Carina's own voice, naming, and presentation. No competitor brand names in shipped code.


**Source:** Odysseus (`src/tool_security.py`; `NON_ADMIN_BLOCKED_TOOLS`, plan mode allowlist)
**Status:** Missing in Carina
**Effort:** 1 week

---

## Post-build (MANDATORY)

When all "Done When" criteria in this prompt are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file (use today's date).
2. Add a "**What was built:**" bullet list of key files or features shipped.
3. Move this file from `carina/internal/prompts/pending_prompts/` to `carina/internal/prompts/archived_prompts/pending_prompts/`, keeping the same relative path. Use `git mv` when possible.
4. If every prompt in this gap folder is COMPLETED, move the whole gap folder and update its `README.md` the same way.
5. Do not leave completed prompts in `pending_prompts/`; agents treat that folder as active work only.

Full checklist: `carina/internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`


## SPECIFICATION

### What This Is

When an agent explores or plans (not executing), ALL tools default to BLOCKED. Only explicitly safe, read-only tools are in the allowlist. This is fail-safe: any new tool added to Carina is automatically blocked in plan mode until explicitly allowed.

Odysseus does this. Hermes and OpenClaw do not. Carina should.

### Why This Matters

Current Carina: Tool policy uses RBAC with blocklists. A new tool is available by default. An attacker who finds a way to register a new tool gets instant access.

With plan mode: A new tool is BLOCKED by default. Even if an attacker registers a malicious tool, plan mode won't execute it. Defense in depth.

### Odysseus Implementation (reference)

```python
# From odysseus/src/tool_security.py
NON_ADMIN_BLOCKED_TOOLS = {
    "bash", "python", "read_file", "write_file", "edit_file",
    "grep", "glob", "ls", "get_workspace", "search_chats",
    "manage_memory", "manage_skills", "manage_tasks",
    "manage_endpoints", "manage_mcp", "manage_webhooks",
    "manage_tokens", "manage_documents", "manage_settings",
    "api_call", "app_api", "send_email", "reply_to_email",
    "list_emails", "read_email", "resolve_contact",
    "manage_contact", "manage_calendar", "vault_search",
    "vault_get", "vault_unlock", "download_model",
    "serve_model", "serve_preset", "stop_served_model",
    "cancel_download", "adopt_served_model",
}

# Plan mode: ALLOWLIST; any new tool defaults to BLOCKED
PLAN_MODE_ALLOWED_TOOLS = {
    "web_search", "web_fetch", "list_sessions", "list_models",
    "list_skills", "list_documents", "list_emails", "list_notes",
    "list_tasks", "list_contacts", "list_calendar_events",
    "list_endpoints", "list_mcp_servers", "list_webhooks",
    "read_file", "grep", "glob", "ls", "get_workspace",
    "search_chats", "manage_session", "create_session",
}
```

### Carina Implementation

```typescript
// security/plan-mode-allowlist.ts

/**
 * Plan mode: the agent is EXPLORING, not executing.
 * Only safe, read-only, non-mutating tools are allowed.
 * Any tool NOT in this list defaults to BLOCKED; fail-safe.
 * 
 * Pattern adopted from Odysseus tool_security.py.
 */
export const PLAN_MODE_ALLOWED_TOOLS: ReadonlySet<string> = new Set([
  // Information gathering
  'web_search',
  'web_fetch',
  'read_file',
  'search_files',
  'session_search',
  
  // List operations (read-only)
  'list_sessions',
  'list_skills',
  'list_documents',
  'list_notes', 
  'list_tasks',
  'list_contacts',
  'list_calendars',
  'list_models',
  'list_endpoints',
  'list_mcp_servers',
  'list_webhooks',
  'list_memories',
  
  // Session management (read/create only)
  'show_session',
  'create_session',
  
  // Agent self-management
  'skill_view',
  'skills_list',
  
  // Safe analysis
  'get_workspace_info',
  'get_system_info',
  'get_token_count',
  
  // Scout (read-only)
  'scout_status',
  'scout_trust',
]);

/**
 * Check if a tool is allowed in plan mode.
 * Default: DENY. Only explicit allowlist entries pass.
 */
export function isPlanModeAllowed(toolName: string): boolean {
  return PLAN_MODE_ALLOWED_TOOLS.has(toolName);
}

/**
 * Filter a tool list for plan mode.
 * Preserves order, removes blocked tools, warns about removals.
 */
export function filterToolsForPlanMode(tools: ToolDefinition[]): {
  allowed: ToolDefinition[];
  blocked: string[];
} {
  const allowed: ToolDefinition[] = [];
  const blocked: string[] = [];
  
  for (const tool of tools) {
    if (PLAN_MODE_ALLOWED_TOOLS.has(tool.name)) {
      allowed.push(tool);
    } else {
      blocked.push(tool.name);
    }
  }
  
  return { allowed, blocked };
}
```

### Integration Points

**1. Agent loop; apply plan mode filter:**
```typescript
// In agents/carina.ts or agents/tool-runner.ts
if (session.planMode) {
  const { allowed, blocked } = filterToolsForPlanMode(availableTools);
  tools = allowed;
  // Log blocked tools for transparency
  logger.info(`Plan mode: blocked ${blocked.length} tools: ${blocked.join(', ')}`);
}
```

**2. System prompt; inject plan mode awareness:**
```
You are in PLAN MODE. You may only use read-only tools to investigate.
You may NOT execute any tool that modifies files, sends messages,
creates/deletes resources, or runs shell commands.
If you need to take action, present your plan and ask the user to
exit plan mode (/plan off).
Available tools: [list from allowlist]
```

**3. CLI command:**
```
carina plan on; enter plan mode (fail-safe allowlist)
carina plan off; exit plan mode (normal tool access)
carina plan status; show current mode and allowed tools
```

**4. Gateway; detect `/plan` directives:**
```typescript
// In gateway/commands.ts
if (message.startsWith('/plan on')) {
  session.planMode = true;
  return 'Plan mode ON. Only read-only tools available. /plan off to exit.';
}
```

**5. Web UI; plan mode indicator:**
```tsx
// In chat header
{planMode && (
  <PlanModeBanner 
    allowedTools={allowedCount}
    blockedTools={blockedCount}
    onExit={() => exitPlanMode()}
  />
)}
```

### Testing

```typescript
// security/plan-mode-allowlist.test.ts

describe('Plan Mode Allowlist', () => {
  it('blocks all mutating tools by default', () => {
    expect(isPlanModeAllowed('terminal')).toBe(false);
    expect(isPlanModeAllowed('write_file')).toBe(false);
    expect(isPlanModeAllowed('send_message')).toBe(false);
    expect(isPlanModeAllowed('delegate_task')).toBe(false);
  });

  it('allows explicitly listed read-only tools', () => {
    expect(isPlanModeAllowed('web_search')).toBe(true);
    expect(isPlanModeAllowed('read_file')).toBe(true);
    expect(isPlanModeAllowed('list_sessions')).toBe(true);
  });

  it('defaults to BLOCKED for unknown tools (fail-safe)', () => {
    expect(isPlanModeAllowed('some_new_tool')).toBe(false);
    expect(isPlanModeAllowed('')).toBe(false);
  });

  it('filters tool list correctly', () => {
    const tools = [
      { name: 'web_search' },
      { name: 'terminal' },
      { name: 'write_file' },
      { name: 'read_file' },
    ];
    const { allowed, blocked } = filterToolsForPlanMode(tools as any);
    expect(allowed.map(t => t.name)).toEqual(['web_search', 'read_file']);
    expect(blocked).toEqual(['terminal', 'write_file']);
  });
});
```

---

## REFERENCE FILES

```
Odysseus:
  odysseus/src/tool_security.py; PLAN_MODE_ALLOWED_TOOLS, NON_ADMIN_BLOCKED_TOOLS

Carina (extend):
  security/tool-policy.ts; add plan mode awareness
  security/tool-rbac.ts; add plan mode role
  agents/tool-runner.ts; apply plan mode filter
  gateway/commands.ts; add /plan commands
  agents/system-prompt.ts; inject plan mode guidance
```