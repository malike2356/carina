# Sprint 4 - Prompt f/01: Conversation View and Workspace Analytics

**Sprint:** 4 - Foundation
**Prompt number:** f/01
**Name:** Full conversation transcripts for workspace owners, analytics dashboard with charts
**Primary agent:** Cursor
**Estimated hours:** 8-10 h
**Depends on:** sprint-4/ai-employee/02-worker-portal-ui.md (workspace portal must exist)

---

## Post-build (MANDATORY)

When all "Done When" criteria are satisfied:
1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file.
2. Move to `internal/prompts/archived_prompts/pending_prompts/sprint-4/f/`.

---

## Read First

1. `frontends/client-apps/app.carinaai.uk/src/app/(workspace)/aiva/workers/[id]/page.tsx` - the Aiva detail page; new tabs go here
2. `frontends/client-apps/app.carinaai.uk/src/app/(workspace)/aiva/page.tsx` - the hire page; global analytics link from sidebar
3. `backends/servers/core.carinaai.uk/src/aiva/aiva-api.ts` - existing activity logging; new analytics endpoints extend this
4. `frontends/client-apps/app.carinaai.uk/package.json` - check if a charting library exists; if not, install recharts

---

## Step 1: Core backend - conversation and analytics routes

Add to `aiva-api.ts` (all routes workspace-session authenticated):

```
GET /api/aiva/conversations                    All conversations across all Aivas for the workspace
GET /api/aiva/workers/:id/conversations        Conversations for one Aiva
GET /api/aiva/conversations/:contactId         Full thread with a specific contact (grouped by channel + contactId)
GET /api/aiva/analytics/workspace              Aggregate analytics for the workspace
GET /api/aiva/analytics/workers/:id            Analytics for a single Aiva
```

**`GET /api/aiva/conversations`:**

```typescript
// Query: workerId (filter), channel (filter), search (content search), page, limit (default 20)
// Aggregate by (channel, contact_id) to get unique conversations
// Returns: {
//   conversations: Array<{
//     contactId: string,
//     contactName: string | null,
//     channel: string,
//     workerId: string,
//     workerName: string,
//     messageCount: number,
//     lastMessageAt: string,
//     lastMessagePreview: string,   // first 100 chars of last message
//     hasEscalation: boolean,       // any escalation activity in this thread
//   }>,
//   total, page, limit
// }
// SQL:
// SELECT
//   ct.contact_id, ct.channel, ct.worker_id, ct.last_message_at,
//   ct.message_count,
//   w.name AS worker_name,
//   (SELECT summary FROM ai_worker_activity
//    WHERE worker_id=ct.worker_id AND action_type IN ('message_received','message_sent')
//    ORDER BY created_at DESC LIMIT 1) AS last_message_preview,
//   EXISTS(SELECT 1 FROM ai_worker_activity
//          WHERE worker_id=ct.worker_id AND action_type='escalated'
//          AND created_at > ct.created_at - INTERVAL '24h') AS has_escalation
// FROM channel_threads ct
// JOIN ai_workers w ON w.id = ct.worker_id
// WHERE ct.workspace_id = $workspaceId
// ORDER BY ct.last_message_at DESC
```

**`GET /api/aiva/conversations/:contactId?channel=&workerId=`:**

```typescript
// Returns full thread for a specific contact on a specific channel with a specific Aiva
// Returns: {
//   messages: Array<{
//     id: string,
//     role: 'user' | 'aiva' | 'va',
//     content: string,          // from summary field (or inputSummary/outputSummary if available)
//     timestamp: string,
//     actionType: string,
//     attestation_tx: string | null,
//   }>,
//   contact: { id: string, name: string | null, channel: string },
//   worker: { id: string, name: string, role: string },
// }
// SQL: SELECT * FROM ai_worker_activity
//      WHERE worker_id=$1 AND workspace_id=$2
//        AND (summary ILIKE '%'||$contactId||'%' OR ...)
//      ORDER BY created_at ASC
// Better: store contact_id in ai_worker_activity directly (see Step 2)
```

**`GET /api/aiva/analytics/workspace`:**

```typescript
// Query: period ('7d' | '30d' | '90d', default '30d')
// Returns: {
//   summary: {
//     totalMessages: number,
//     messagesThisPeriod: number,
//     messagesVsPreviousPeriod: number,    // percentage change
//     escalationsThisPeriod: number,
//     escalationRate: number,              // 0.0 to 1.0
//     automationsRan: number,
//     automationSuccessRate: number,
//     activeAivas: number,
//   },
//   messagesByDay: Array<{ date: string; count: number }>,   // for line chart
//   messagesByChannel: Array<{ channel: string; count: number }>,  // for bar or donut
//   messagesByAiva: Array<{ workerId: string; workerName: string; count: number }>,
//   escalationsByDay: Array<{ date: string; count: number }>,
//   busiestHours: Array<{ hour: number; dayOfWeek: number; count: number }>,  // for heatmap
// }
```

**`GET /api/aiva/analytics/workers/:id`:**

```typescript
// Same shape as workspace analytics but scoped to one Aiva
```

---

## Step 2: Store contact_id in ai_worker_activity

Currently `ai_worker_activity` has no `contact_id` column. Conversation threading requires it.

Add to migration:
```sql
ALTER TABLE ai_worker_activity ADD COLUMN IF NOT EXISTS contact_id TEXT;
ALTER TABLE ai_worker_activity ADD COLUMN IF NOT EXISTS channel TEXT;
CREATE INDEX ON ai_worker_activity(worker_id, channel, contact_id, created_at DESC);
```

Update `logActivity()` in `aiva-api.ts` to accept and store `contact_id` and `channel`:
```typescript
interface LogActivityParams {
  workerId: string;
  workspaceId: string;
  actionType: string;
  summary: string;
  inputSummary?: string;
  outputSummary?: string;
  contact_id?: string;   // add these
  channel?: string;      // add these
}
```

Update all `logActivity()` call sites in the channel router to pass `contact_id` and `channel`.

---

## Step 3: Conversations page in workspace

Add to `app.carinaai.uk` sidebar: "Conversations" link under the Aiva section.

Create `src/app/(workspace)/conversations/page.tsx`:

**Layout:**

Two-panel: left list (conversations), right detail (selected thread).
On mobile: list only, tap to open thread.

**Left panel - conversation list:**

```
[Search input - debounced]
[Filter row: All Aivas | [Aiva name dropdown]] [All channels | WhatsApp | Email | ...]

[Conversation cards, sorted by last message time]
[Card:]
  [Channel icon] [Aiva name]
  [Contact name or masked ID] - [time ago]
  [Last message preview - 1 line truncated]
  [Escalated badge if has_escalation]
```

**Right panel - thread view:**

```
[Thread header]
  [Channel icon] [Contact name/ID]
  Via [Aiva name] on [channel]
  [Export PDF button]

[Message list - scrollable, newest at bottom]
  user message: right-aligned, grey bubble
  aiva message: left-aligned, branded bubble
  va message: left-aligned, amber bubble with "VA" label
  escalation event: centered dashed line "Escalated to VA team - [date]"
  automation event: centered dashed line "Automation '[name]' ran - [date]"

  Each message:
    [content]
    [timestamp]
    [attestation badge: "Verified" (link) or muted "Pending" if attestation_tx present]
```

**PDF export:**

On click "Export PDF", call `GET /api/aiva/conversations/:contactId/export?format=pdf`.
Core backend generates a simple PDF using a library like `pdfkit`:

```typescript
// npm install pdfkit @types/pdfkit
// Generates a formatted conversation transcript with:
//   Header: Aiva name, contact, channel, date range
//   Each message: role, timestamp, content
//   Footer: "Generated by VERLOX. Conversation attested via Scout."
```

Return as `Content-Type: application/pdf; Content-Disposition: attachment`.

---

## Step 4: Analytics page in workspace

Create `src/app/(workspace)/analytics/page.tsx`:

**Period selector:** 7 days / 30 days / 90 days (default 30d)

**Summary stat cards row:**
| Messages | Escalation rate | Automations ran | Active Aivas |
Each card: current period value + trend vs previous period (up/down arrow + % change)

**Charts** (use recharts):

- **Message volume**: LineChart, one line per Aiva, x=date, y=count
- **Channel breakdown**: PieChart or BarChart by channel
- **Escalation trend**: AreaChart, x=date, y=escalation count
- **Busiest hours heatmap**: 7x24 grid (day of week x hour), color intensity = message count
  - Use a simple CSS grid with background-color opacity; no chart library needed

**Aiva comparison table:**

| Aiva | Messages (period) | Escalation rate | Automations | Last active |

Sortable columns.

---

## Step 5: Analytics tab on Aiva detail page

On the Aiva detail page (`/aiva/workers/[id]`), add an "Analytics" tab.

Tab content: same as workspace analytics page but scoped to this Aiva only. No Aiva comparison
table. Add a "Conversations" section showing the last 5 conversations with this Aiva (link to
the full conversations page filtered to this Aiva).

---

## Step 6: Sidebar navigation updates

Add to the workspace sidebar:
```tsx
// Under "Aivas" section:
<SidebarLink href="/conversations">Conversations</SidebarLink>
<SidebarLink href="/analytics">Analytics</SidebarLink>
```

---

## Done When

- [ ] `contact_id` and `channel` columns added to `ai_worker_activity`; all logActivity call sites updated
- [ ] `GET /api/aiva/conversations` returns paginated conversation list with search and filter
- [ ] `GET /api/aiva/conversations/:contactId` returns full thread with messages sorted ascending
- [ ] `GET /api/aiva/analytics/workspace` returns all analytics fields for the period
- [ ] `GET /api/aiva/analytics/workers/:id` returns Aiva-scoped analytics
- [ ] Conversations page renders two-panel layout; left panel searchable; right panel shows thread
- [ ] User, Aiva, and VA messages styled distinctly in the thread view
- [ ] Escalation and automation events shown as inline dividers in the thread
- [ ] Attestation badge shown on each message with a link if confirmed
- [ ] PDF export downloads a formatted conversation transcript
- [ ] Analytics page renders with period selector and all four chart types
- [ ] Message volume line chart shows one line per Aiva
- [ ] Busiest hours heatmap renders as 7x24 color grid
- [ ] Aiva comparison table is sortable
- [ ] Analytics tab on Aiva detail page shows scoped analytics
- [ ] "Conversations" and "Analytics" links added to sidebar
- [ ] recharts installed if not already present
- [ ] No em dashes in any UI copy
- [ ] No emojis
