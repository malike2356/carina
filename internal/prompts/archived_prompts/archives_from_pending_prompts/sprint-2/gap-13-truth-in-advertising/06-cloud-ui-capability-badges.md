# Gap 13 - Prompt 06: Cloud UI Capability Badges

**Status: COMPLETED 2026-06-21**

**What was built:** see gap-13 session work in backends/ and frontends/client-apps/app.carinaai.uk.

> **REUSE RULE:** See `../REUSE-RULES.md`.

**Gap:** 13 Truth in Advertising
**Prompt number:** 06 of 08
**Primary agent:** Cursor (React/TSX)
**Estimated hours:** 4-5 h
**Depends on:** 01-surface-capability-contract.md, 03-cloud-chat-identity.md

---

## Post-build (MANDATORY)

When all "Done When" criteria in this prompt are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file (use today's date).
2. Add a "**What was built:**" bullet list of key files or features shipped.
3. Move this file from `carina/internal/prompts/pending_prompts/` to `carina/internal/prompts/archived_prompts/pending_prompts/`, keeping the same relative path. Use `git mv` when possible.
4. If every prompt in this gap folder is COMPLETED, move the whole gap folder and update its `README.md` the same way.
5. Do not leave completed prompts in `pending_prompts/`; agents treat that folder as active work only.

Full checklist: `carina/internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`


## Read First

1. `app.carinaai.uk/src/components/shell/AppSidebar.tsx` - nav rendering
2. `app.carinaai.uk/src/components/shell/CommandPalette.tsx` - command list
3. `app.carinaai.uk/src/lib/cloud-capabilities.ts` - capability flags
4. `app.carinaai.uk/src/lib/core-api-proxy.ts` - proxy detection
5. `core.carinaai.uk/src/product/shell-config.ts` - nav item ids to gate

---

## The Problem

Carina Cloud sidebar and command palette expose routes (Terminal, MCP, Cron, Files, Webhooks, etc.) that require **core proxy** or operator infrastructure. BYOK-only tenants see links that 404 or show empty states. That is UI-level false advertising.

---

## What To Build

### 1. Extend `getCloudCapabilities()`

Add explicit flags for each major nav feature:

```typescript
export function getCloudCapabilities() {
  const coreProxy = coreProxyEnabled();
  return {
    chatMode: coreProxy ? 'core-proxy' : 'byok-direct',
    webSearch: coreProxy,
    agentTools: coreProxy,
    terminal: coreProxy,
    mcp: coreProxy,
    cron: coreProxy,
    files: coreProxy,
    webhooks: coreProxy,
    logs: coreProxy,
    pairing: coreProxy,
    securityDashboard: coreProxy && process.env.SCOUT_ENABLED === 'true',
    // ...existing fields
  };
}
```

Export type `CloudCapabilityKey` for reuse.

### 2. Nav gating component

Create `app.carinaai.uk/src/components/shell/CapabilityGate.tsx`:

```tsx
type Props = {
  requires: CloudCapabilityKey | CloudCapabilityKey[];
  children: React.ReactNode;
  fallback?: 'hide' | 'badge' | 'link-to-settings';
};

export function CapabilityGate({ requires, children, fallback = 'badge' }: Props);
```

Behaviors:

- **hide**: do not render nav item in BYOK mode
- **badge**: show item with "Core" or "Requires core connection" badge, disabled click -> tooltip
- **link-to-settings**: navigate to settings section explaining how to enable core proxy

Default for operator-heavy routes: `hide` in BYOK, full access in core-proxy.

Recommended mapping:

| Route | BYOK behavior |
|-------|---------------|
| Chat, Memory, Settings, Billing | Always show |
| Terminal, MCP, Cron, Files, Logs, Webhooks, Pairing | hide or badge |
| Security | show with badge if Scout not configured |
| Research, Compare | show if API keys present; badge if needs core |

### 3. Wire AppSidebar and CommandPalette

- Filter `navItems` through capability map before render
- Command palette: skip disabled commands or show with "(requires core)" suffix
- Add settings callout banner when `chatMode === 'byok-direct'`:

```
Advanced tools (terminal, cron, MCP) need a connection to your Carina core instance. Configure core proxy in Settings.
```

### 4. Empty state honesty

For pages that remain reachable via direct URL, add honest empty states:

- `/terminal` in BYOK: explain core proxy requirement, link to settings
- Do not show fake terminal UI

### 5. Tests

- `cloud-capabilities.test.ts`: flags flip with env mocks
- Component test: sidebar omits Terminal when `agentTools: false`

---

## Acceptance Criteria

- [ ] BYOK users do not see clickable nav to non-functional core features (or see clear badge)
- [ ] Direct URL hits show honest empty state, not broken shell
- [ ] Settings documents how to enable core proxy
- [ ] No new routes advertised without capability check

---

## Do Not

- Do not remove pages from codebase; gate visibility only
- Do not promise "coming soon" for features that exist on core but need wiring; say "requires core connection"
