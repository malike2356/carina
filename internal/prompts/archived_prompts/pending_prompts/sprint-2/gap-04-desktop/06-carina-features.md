# Gap 04 - Prompt 06: Carina-Specific Features

**Status: COMPLETED 2026-06-23**

**What was built:**
- `ScoutWidget`, `UsagePanel`, `WorkspaceSwitcher`, `OperatorPanel`
- `store/carina.ts`, `lib/carina-poller.ts`, pages at `/scout` and `/operator`
- Sidebar integration: workspace switcher, collapsible Scout/billing widgets, Ctrl+B sidebar modes

**Agent:** Claude Code (fallback: Cursor)
**Estimated hours:** 4-5 hrs
**Depends on:** 01-05 done

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

```
carina-desktop/src/app/settings/devices/page.tsx   (from 04-pages.md)
carina-desktop/src/lib/gateway-client.ts
core.carinaai.uk/src/pairing/pairing.ts            (pairing backend - COMPLETE)
core.carinaai.uk/src/security/trust-state.ts
core.carinaai.uk/src/security/shield-report.ts
core.carinaai.uk/src/billing/
core.carinaai.uk/src/agents/orchestrator.ts
core.carinaai.uk/src/commitments/
app.carinaai.uk/src/components/billing/BillingClient.tsx  (reference for billing UI)
```

---

## What to Build

Four Carina-specific widgets and panels that integrate with the existing core backend systems.

---

## 1. Scout Security Widget (`src/components/scout/ScoutWidget.tsx`)

A compact widget shown in the sidebar or as a panel (toggle with Ctrl+S):

```tsx
// Trust score ring:
//   Circular gauge (0-100), color coded:
//     90-100: green
//     70-89:  yellow
//     50-69:  orange
//     0-49:   red
//   Score number in center
//   "Trust Score" label below

// Recent security events (last 5):
//   Each event: icon + severity badge + summary + time ago
//   Severity: info (grey), warning (yellow), critical (red)
//   Click event: open detail drawer

// Kill switch status:
//   Green shield icon = active (normal)
//   Red shield icon = triggered (emergency)
//   If triggered: show "KILL SWITCH ACTIVE" banner + timestamp + reason

// Scout connection:
//   "Connected" or "Disconnected" indicator
//   If connected: Scout instance URL

// "View Full Report" button → opens new window at /scout-report
//   or navigates to Scout console if configured

// Data:
//   Poll GET /security/trust-score every 10s
//   Poll GET /security/events?limit=5 every 10s
//   Poll GET /security/kill-switch-status every 5s
```

Full Scout report page (`src/app/scout/page.tsx`):
```tsx
// Full shield report view (from security/shield-report.ts)
// Trust score history chart (recharts, last 24h)
// All security events table with filters
// Tool sequence analysis
// Kill switch controls: current status + manual trigger button (requires confirmation)
// Link to full Scout console (external URL)
```

## 2. Billing/Usage Panel (`src/components/billing/UsagePanel.tsx`)

Compact widget in sidebar (expandable):

```tsx
// Plan badge: Free / Pro / Team / Enterprise
// Credit balance (for pay-per-use plans)
// Usage meter this billing period:
//   Progress bar: tokens used / limit
//   Messages sent this period
//   Active since / renewal date

// Session cost breakdown (last 5 sessions):
//   Session name, model used, token count, estimated cost
//   Total this period

// Actions:
//   "Upgrade Plan" → opens billing page (app.carinaai.uk/billing or /settings/billing)
//   "Add Credits" → direct to billing checkout

// Data:
//   GET /billing/usage → current period usage
//   GET /billing/plan → current plan details
//   GET /billing/sessions → per-session costs
//   These gateway endpoints proxy to the billing system
```

## 3. Workspace Switcher (`src/components/workspace/WorkspaceSwitcher.tsx`)

```tsx
// Shown in top of sidebar header, replaces static "Carina" label
// Current workspace name + dropdown arrow

// Dropdown on click:
//   List of workspaces (icon + name + session count)
//   Active workspace: checkmark
//   "New Workspace" button at bottom

// Create workspace modal:
//   Name input
//   Color/icon picker (for visual differentiation)
//   "Create" → POST /workspaces

// Switch workspace:
//   Confirm if there is an active session (offer to save)
//   PUT /workspaces/active { id }
//   Reload session list, memory, skills for new workspace

// Per-workspace data:
//   Sessions belong to a workspace
//   Memory is scoped to workspace
//   Skills enabled per workspace (can differ)

// Data:
//   GET /workspaces → list
//   POST /workspaces → create
//   PUT /workspaces/active → switch
//   DELETE /workspaces/:id → delete (confirm first, moves sessions to default)
```

## 4. Operator Panel (`src/components/operator/OperatorPanel.tsx`)

Accessible via keyboard shortcut Ctrl+O or "Operator" nav item. Full page view for power users.

```tsx
// Tab 1: Multi-Agent Orchestration
//   Active orchestration graphs (if Carina is running parallel agents)
//   Each agent: node in a flow diagram (use reactflow or a simple custom grid)
//   Agent status, task summary, dependencies
//   Cancel individual agents or entire orchestration

// Tab 2: Commitment Tracker
//   List of commitments made by Carina across sessions
//   Status: pending / in-progress / completed / failed
//   Due date (if any), session source link
//   "Mark done" / "Cancel" actions
//   Data: GET /commitments → from core.carinaai.uk/src/commitments/

// Tab 3: Benchmarks
//   Benchmark run history (from core.carinaai.uk/src/agents/benchmark)
//   Metrics: task success rate, avg response time, tool call efficiency
//   Per-model breakdown
//   "Run benchmark" button → POST /benchmarks/run

// Tab 4: Learning Metrics
//   Skill success rate improvement over time (chart)
//   Memories extracted count (weekly)
//   Preference learner adaptations (list of learned preferences)
//   Skills added via self-improvement loop
//   Data: GET /metrics/learning

// Tab 5: System Health
//   Core agent uptime
//   Gateway connection status
//   Memory usage (Node.js heap)
//   Queue depth (pending tool calls)
//   Recent errors from log
```

## 5. Global State Integration

Wire all 4 widgets to the nanostore session atom so they update when sessions change:

```typescript
// src/store/carina.ts  (new atom file)
import { atom, computed } from 'nanostores';

export const $trustScore = atom<number>(0);
export const $securityEvents = atom<SecurityEvent[]>([]);
export const $killSwitchActive = atom<boolean>(false);
export const $plan = atom<Plan | null>(null);
export const $usageThisPeriod = atom<Usage | null>(null);
export const $workspaces = atom<Workspace[]>([]);
export const $activeWorkspace = atom<Workspace | null>(null);
export const $commitments = atom<Commitment[]>([]);

// Polling: set up intervals in a singleton poller
// src/lib/carina-poller.ts
//   startPolling() → called once in app root
//   setInterval loops for each $atom above
//   On gateway disconnect: clear all atoms to null/[]
```

## 6. Sidebar Integration

Update the sidebar to show widgets:

```tsx
// src/components/layout/Sidebar.tsx
//
// Top section: WorkspaceSwitcher + new session button
// Middle: session list (existing)
// Bottom pinned:
//   ScoutWidget (compact, collapsed by default, expand on click)
//   UsagePanel (compact: plan badge + credits remaining, expand for detail)
//
// Sidebar width modes:
//   Collapsed (icons only): Ctrl+B to toggle
//   Normal (icons + text): default
//   Wide (icons + text + widget panels): Ctrl+Shift+B
```

---

## Files to Create

```
carina-desktop/src/
├── components/
│   ├── scout/
│   │   └── ScoutWidget.tsx
│   ├── billing/
│   │   └── UsagePanel.tsx
│   ├── workspace/
│   │   └── WorkspaceSwitcher.tsx
│   └── operator/
│       └── OperatorPanel.tsx
├── store/
│   └── carina.ts              (trust score, plan, workspaces, commitments atoms)
├── lib/
│   └── carina-poller.ts       (singleton polling manager)
└── app/
    ├── scout/page.tsx         (full scout report page)
    └── operator/page.tsx      (operator panel page)
```

## Files to Modify

```
src/components/layout/Sidebar.tsx
  → add WorkspaceSwitcher at top
  → add ScoutWidget + UsagePanel at bottom
  → add collapse mode toggle
  → add /operator nav item

src/lib/gateway-client.ts
  → add: getTrustScore(), getSecurityEvents(limit), getKillSwitchStatus()
  → add: getBillingUsage(), getBillingPlan(), getBillingSessions()
  → add: getWorkspaces(), createWorkspace(name), switchWorkspace(id)
  → add: getCommitments(), getLearningMetrics(), getSystemHealth()
```

---

## Done When

- [x] Scout widget shows live trust score that updates every 10s
- [x] Kill switch status is visible; if triggered, a red banner shows across the app
- [x] Workspace switcher lists workspaces and switching loads the correct session list
- [x] Creating a new workspace persists and appears in switcher
- [x] Usage panel shows current plan and token usage with a progress bar
- [x] Operator panel > Commitments lists active commitments from gateway
- [x] ScoutWidget + UsagePanel appear in sidebar bottom, collapsible
- [x] Sidebar collapses to icon-only mode with Ctrl+B
