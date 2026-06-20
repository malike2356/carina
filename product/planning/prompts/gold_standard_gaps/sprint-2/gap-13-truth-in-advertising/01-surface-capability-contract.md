# Gap 13 - Prompt 01: Surface Capability Contract

> **REUSE RULE:** See `../REUSE-RULES.md`. Implement in Carina's own voice. No competitor product names in shipped code.

**Gap:** 13 Truth in Advertising
**Prompt number:** 01 of 08
**Name:** Surface Capability Contract
**Primary agent:** Claude Code
**Estimated hours:** 4-6 h
**Depends on:** Nothing (foundation for gap-13)

---

## Read First

Before writing a single line, read:

1. `core.carinaai.uk/src/product/shell-config.ts` - web nav labels (not channel truth)
2. `core.carinaai.uk/src/product/feature-guide.ts` - `buildCapabilitySummaryLine()` bug source
3. `core.carinaai.uk/src/gateway/channels/channel-capabilities.ts` - per-channel limits
4. `app.carinaai.uk/src/lib/cloud-capabilities.ts` - cloud honesty partial helper
5. `docs.carinaai.uk/docs/user/capability-inventory.md` - public inventory
6. `core.carinaai.uk/src/agents/system-prompt.ts` - canonical agent identity lines

---

## The Problem

Carina has no module that answers: **"What can this install honestly claim on this surface right now?"**

`buildCapabilitySummaryLine()` reads web sidebar nav from `shell-config.ts` and returns it on every platform, including Telegram. That is false advertising on non-web channels.

---

## What To Build

### 1. New module: `core.carinaai.uk/src/product/surface-capabilities.ts`

Define types:

```typescript
export type CarinaSurface =
  | 'cli'
  | 'tui'
  | 'web-private'
  | 'web-hosted'
  | 'cloud-byok'
  | 'cloud-core-proxy'
  | 'telegram'
  | 'mobile'
  | 'desktop';

export interface SurfaceCapabilityItem {
  id: string;
  label: string; // User-facing name
  available: boolean; // Runtime truth
  reason?: string; // Why unavailable (plain language)
}

export interface SurfaceCapabilityContract {
  surface: CarinaSurface;
  identityLine: string; // One sentence "who are you" for this surface
  capabilities: SurfaceCapabilityItem[];
  summaryLine: string; // Plain sentence list for quick replies
}
```

Export functions:

```typescript
export function resolveSurface(input: {
  platform?: string;
  hostedMode?: boolean;
  coreProxy?: boolean;
}): CarinaSurface;

export function buildSurfaceContract(
  surface: CarinaSurface,
  runtime?: SurfaceRuntimeSnapshot,
): SurfaceCapabilityContract;

export function buildCapabilitySummaryForSurface(
  surface: CarinaSurface,
  runtime?: SurfaceRuntimeSnapshot,
): string;
```

### 2. Runtime snapshot: `SurfaceRuntimeSnapshot`

Collect live flags so claims are not static fiction:

```typescript
export interface SurfaceRuntimeSnapshot {
  memoryEnabled: boolean;
  memoryBackend: 'postgres' | 'sqlite' | 'none';
  webSearchEnabled: boolean;
  agentToolsEnabled: boolean;
  voiceRepliesEnabled: boolean;
  scoutEnabled: boolean;
  activeSkillPacks: string[];
  configuredChannels: string[];
  ttsAvailable: boolean;
}
```

Implement `collectSurfaceRuntimeSnapshot()` in the same file (or `surface-runtime.ts`) using existing helpers:

- Memory: check memory store init / `CARINA_HOME` persistence
- Tools: session tool registry count > 0 or gateway tool surface
- Web search: Tavily key or configured search backend
- Voice: `resolveEdgeTtsBin()` or OpenAI TTS key
- Scout: `LABYRINTH_ENABLED === 'true'`
- Channels: `channel-status.ts` configured list

Do not import heavy modules at top level if it causes circular deps; use lazy imports inside collector.

### 3. Per-surface capability matrices (minimum)

**telegram** (example truth, adjust to runtime):

| id | label | default available |
|----|-------|-------------------|
| chat | Chat | true |
| web-search | Web search | if Tavily/search configured |
| memory | Persistent memory | if memory backend up |
| voice | Voice replies | if TTS available |
| tools | Agent tools | if tool registry non-empty for session |
| scheduled | Scheduled jobs | false on Telegram (direct user to web/CLI) |
| documents | Documents editor | false on Telegram |

**cloud-byok**:

| id | label | default available |
|----|-------|-------------------|
| chat | Chat with your API keys | true |
| memory | Workspace memory panel | true (DB-backed) |
| web-search | Web search | false unless core proxy |
| agent-tools | Tool execution | false unless core proxy |
| skills | Custom skill hints | true (prompt hints only) |

**web-private / cli / tui**: broader list from actual tool surface; include Email, Trello, Cron only when env/config shows them configured.

**Identity lines** (one sentence each, no property-only default):

- Default: "I am Carina, an autonomous agent built by VERLOX. I remember context, search the web, and use tools when this surface allows."
- If `property-uk` pack active: append "Property-uk skills are enabled for this install."
- cloud-byok: "I am Carina Cloud. This workspace runs chat on your API keys; advanced tools need core proxy."

### 4. Wire `feature-guide.ts` to delegate

Replace body of `buildCapabilitySummaryLine()`:

```typescript
export function buildCapabilitySummaryLine(platform?: string): string {
  const surface = resolveSurface({ platform, hostedMode: ..., coreProxy: ... });
  return buildCapabilitySummaryForSurface(surface, collectSurfaceRuntimeSnapshot());
}
```

Keep old behavior behind `CARINA_LEGACY_CAPABILITY_SUMMARY=1` for one release if needed; default to new path.

### 5. Tests: `surface-capabilities.test.ts`

Minimum cases:

- `resolveSurface({ platform: 'telegram' })` => `'telegram'`
- Telegram summary does NOT contain "Trello" or "Calendar" when those are web-only
- cloud-byok summary mentions BYOK and does not claim shell-exec
- property-uk pack adds property note without replacing horizontal identity
- unavailable items excluded from summaryLine

---

## Files To Create/Modify

| Action | Path |
|--------|------|
| Create | `core.carinaai.uk/src/product/surface-capabilities.ts` |
| Create | `core.carinaai.uk/src/product/surface-capabilities.test.ts` |
| Modify | `core.carinaai.uk/src/product/feature-guide.ts` |
| Export | `core.carinaai.uk/src/product/index.ts` (if exists) |

---

## Acceptance Criteria

- [ ] Single module is the only source for capability summary text per surface
- [ ] Telegram contract excludes web-only nav items
- [ ] Runtime snapshot gates `available` flags
- [ ] Tests pass: `cd core.carinaai.uk && pnpm test surface-capabilities`
- [ ] No em dashes or emojis in user-facing strings

---

## Do Not

- Do not hardcode competitor names
- Do not list raw internal tool names in summary lines (system-prompt rule)
- Do not make Telegram claim web UI screens the user cannot open from Telegram
