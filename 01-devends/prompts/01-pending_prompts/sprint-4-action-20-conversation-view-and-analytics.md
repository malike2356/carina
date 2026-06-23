# Sprint 4 - Prompt 20: Conversation View and Analytics

**Sprint:** 4
**Prompt number:** 20
**Primary agent:** Cursor
**Estimated hours:** 7-9 h
**Depends on:** 10-worker-portal-ui.md (Aiva detail tabs registered); 12-channel-infrastructure.md (conversations stored); 15-aiva-brain.md (messages stored)

---

## Post-build (MANDATORY)

When all "Done When" criteria are satisfied:
1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file.
2. Move to `internal/prompts/archived_prompts/archives_from_pending_prompts/sprint-4/action/`.

---

## Read First

1. `frontends/client-apps/app.carinaai.uk/src/lib/workspace-nav.ts` - `NAV_GROUPS` and `NAV_ROUTES`; you will add two new routes here
2. `frontends/client-apps/app.carinaai.uk/src/lib/aiva-detail-tabs.ts` - `AIVA_CORE_TABS`; you will NOT modify this file (analytics tab is per-Aiva, via the extension pattern documented there)
3. `frontends/client-apps/app.carinaai.uk/src/lib/utils.ts` or equivalent - look for `maskIdentifier` helper; reuse it; if missing, check `src/lib/format.ts`
4. `backends/servers/core.carinaai.uk/src/db/schema.sql` or the most recent migration - find `activity_logs` or `conversations` table structure to know exact column names
5. `backends/servers/core.carinaai.uk/src/server.ts` - where to mount the new routers

---

## Context

This prompt adds two cross-Aiva pages accessible from the workspace sidebar:

1. **Conversations** - searchable list of all conversations across all Aivas in this workspace,
   with a right-panel thread view. This is the customer-facing support inbox equivalent.

2. **Analytics** - aggregated statistics across all Aivas: message volumes, channel breakdown,
   escalation rate, satisfaction signals, and a 7x24 activity heatmap.

Both pages are workspace-level (not per-Aiva), so they live under `/conversations` and `/analytics`,
not inside the Aiva detail route.

---

## Step 1: Sidebar nav additions

In `workspace-nav.ts`, add two routes to the existing `aiva` nav group (the one added in prompt 10):

```typescript
// Add after the last existing Aiva nav route
{ path: '/conversations', label: 'Conversations', iconName: 'MessageSquare', group: 'aiva' },
{ path: '/analytics',     label: 'Analytics',     iconName: 'BarChart2',     group: 'aiva' },
```

Add to `NAV_ICON_MAP`:
```typescript
MessageSquare: MessageSquare,  // from lucide-react
BarChart2: BarChart2,
TrendingUp: TrendingUp,
TrendingDown: TrendingDown,
```

---

## Step 2: Core backend - conversations routes

Create `src/conversations/conversations-router.ts`. Mount at `/api/conversations` in `server.ts`.
All routes require workspace JWT auth (same middleware as existing workspace routes).

```
GET /api/conversations?page&limit&search&workerId&channel&status
GET /api/conversations/:id/thread
GET /api/conversations/:id/export-pdf
```

**`GET /api/conversations`:**

```typescript
// Query params:
//   page      int, default 1
//   limit     int, default 30, max 100
//   search    string, optional - matches against masked contact ID (exact) or message preview (ILIKE)
//   workerId  UUID, optional - filter by specific Aiva
//   channel   string, optional - 'web' | 'email' | 'whatsapp' | 'instagram'
//   status    string, optional - 'open' | 'escalated' | 'resolved' | 'automated'
//
// Returns paginated list of conversations, newest first.
// Each row: {
//   id: string,
//   contactId: string,              -- masked by the API before returning
//   channel: string,
//   worker: { id, name },
//   lastMessageAt: string,
//   lastMessagePreview: string,     -- first 120 chars of the last message; strip line breaks
//   messageCount: number,
//   hasEscalation: boolean,
//   status: 'open' | 'escalated' | 'resolved' | 'automated'
// }
//
// Masking logic in the API layer (not in SQL):
//   email:     keep first 3 chars of local part + '***@' + domain, e.g. "joh***@gmail.com"
//   phone:     keep last 4 digits, e.g. "****-****-1234"
//   web:       show "Visitor-" + last 6 chars of contactId, e.g. "Visitor-a3f91c"
//   instagram: show "@user-" + last 4 chars
// This is the same maskIdentifier pattern from prompt 10; centralise in a shared util.
//
// JOIN:
//   conversations (or activity_logs grouped by contactId+workerId)
//   LEFT JOIN aiva_escalations ON escalation.conversation_id = conversations.id
//   WHERE workspace_id = $1
//
// OFFSET pagination is fine at these volumes.
```

**`GET /api/conversations/:id/thread`:**

```typescript
// Returns all messages in a conversation, oldest first.
// Each message: {
//   id: string,
//   role: 'user' | 'aiva' | 'va' | 'system',
//   content: string,
//   timestamp: string,
//   actionType?: string,    -- for role='system': 'escalated' | 'automation_ran' | 'resolved'
//   summary?: string,       -- for system events: human-readable label, e.g. "Automation 'Follow-up' ran"
//   attestationTx?: string, -- present on aiva messages that have been attested; null if pending
// }
// Contacts are NOT masked in the thread; individual message content is returned as-is.
// IMPORTANT: Apply a workspace_id check to prevent cross-tenant access.
```

**`GET /api/conversations/:id/export-pdf`:**

```typescript
// Minimal implementation: return a JSON export with Content-Type: application/json and
// Content-Disposition: attachment; filename="conversation-[id].json"
// Full PDF generation can come later; this route exists so the UI button always works.
// Include: thread messages, contactId (masked), workerName, channel, dateRange.
```

---

## Step 3: Core backend - analytics routes

Create `src/analytics/analytics-router.ts`. Mount at `/api/analytics` in `server.ts`.

```
GET /api/analytics/summary?period=7d|30d|90d
GET /api/analytics/volume?period=
GET /api/analytics/channels?period=
GET /api/analytics/escalations?period=
GET /api/analytics/heatmap?period=
GET /api/analytics/aiva-breakdown?period=
```

**`GET /api/analytics/summary`:**
```typescript
// Returns: {
//   totalConversations: number,  prevPeriodCount: number,
//   messagesFromAiva: number,    prevPeriodAivaCount: number,
//   escalationRate: number,      prevPeriodEscalationRate: number,  // 0-1 float
//   avgResponseSec: number,      prevPeriodAvgResponseSec: number,
// }
// All "prev" values cover the same length window before the current window.
// Trend = (current - prev) / prev * 100 (percentage change); sent as a number, UI formats the sign.
```

**`GET /api/analytics/volume`:**
```typescript
// Returns: Array<{ date: string; count: number }>
// date format: 'YYYY-MM-DD'
// One row per day in the requested period.
// Include days with zero messages (fill gaps in the application layer or SQL with generate_series).
```

**`GET /api/analytics/channels`:**
```typescript
// Returns: Array<{ channel: string; count: number; pct: number }>
// pct is 0-100; sum = 100.
```

**`GET /api/analytics/escalations`:**
```typescript
// Returns: Array<{ date: string; total: number; escalated: number; rate: number }>
// rate = escalated / total (0-1 float); 0 if total = 0
```

**`GET /api/analytics/heatmap`:**
```typescript
// Returns: Array<{ dayOfWeek: number; hour: number; count: number }>
// dayOfWeek: 0 = Monday, 6 = Sunday  (ISO week ordering)
// hour: 0-23
// Only rows where count > 0; the UI fills in zeros for missing cells.
// Query: GROUP BY EXTRACT(DOW FROM created_at AT TIME ZONE 'UTC'), EXTRACT(HOUR FROM created_at AT TIME ZONE 'UTC')
// Note: EXTRACT DOW returns 0=Sunday in PostgreSQL; convert to ISO (Mon=0) in the application layer.
```

**`GET /api/analytics/aiva-breakdown`:**
```typescript
// Returns: Array<{ workerId: string; workerName: string; messageCount: number; escalationCount: number; avgResponseSec: number }>
// Sorted by messageCount DESC.
```

---

## Step 4: Next.js API proxy routes

Create in `frontends/client-apps/app.carinaai.uk/src/app/api/`:

```
conversations/route.ts                   -- GET proxy
conversations/[id]/thread/route.ts       -- GET proxy
conversations/[id]/export-pdf/route.ts   -- GET proxy
analytics/summary/route.ts               -- GET proxy
analytics/volume/route.ts                -- GET proxy
analytics/channels/route.ts              -- GET proxy
analytics/escalations/route.ts           -- GET proxy
analytics/heatmap/route.ts               -- GET proxy
analytics/aiva-breakdown/route.ts        -- GET proxy
```

Each follows the same proxy pattern used in other routes: forward the `Authorization` header,
pass the query string verbatim, return the upstream JSON. If upstream returns non-2xx, return that
status code with the upstream body.

---

## Step 5: Conversations page - layout

Create `src/app/(workspace)/conversations/page.tsx`.

The page is a two-panel split. No top-level padding wrapper; the panels themselves control their
own padding. The full viewport height minus the topbar height (56px) is used.

```tsx
export default function ConversationsPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <div className="grid grid-cols-[320px_1fr] h-[calc(100vh-56px)] overflow-hidden">
      <ConversationList selectedId={selectedId} onSelect={setSelectedId} />
      <ConversationThread conversationId={selectedId} />
    </div>
  );
}
```

If no selectedId: the right panel shows an empty state (see Step 7).
If selected: the right panel shows the thread.

---

## Step 6: `ConversationList` component

```tsx
// Left panel (w-320 fixed, full height, flex column, border-r border-border)

// Layout:
// +---------------------------------+
// | px-4 py-3 border-b              |
// | [Search input]                  |
// | [Aiva filter v] [Channel v]    |
// +---------------------------------+
// | Scrollable list of cards        |
// | ...                             |
// +---------------------------------+

function ConversationList({ selectedId, onSelect }) {
  const [search, setSearch] = useState('');
  const [workerFilter, setWorkerFilter] = useState('');
  const [channelFilter, setChannelFilter] = useState('');

  return (
    <aside className="flex flex-col h-full border-r border-border bg-base overflow-hidden">
      {/* Filter bar */}
      <div className="px-4 py-3 border-b border-border shrink-0 space-y-2">
        <input
          type="search"
          placeholder="Search conversations..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full text-sm bg-elevated rounded-lg border border-border px-3 py-2
                     text-text-primary placeholder:text-text-muted outline-none
                     focus:border-accent transition-colors"
        />
        <div className="flex gap-2">
          <WorkerSelect value={workerFilter} onChange={setWorkerFilter} />
          <ChannelSelect value={channelFilter} onChange={setChannelFilter} />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {conversations.map(conv => (
          <ConversationCard
            key={conv.id}
            conv={conv}
            selected={conv.id === selectedId}
            onClick={() => onSelect(conv.id)}
          />
        ))}
        {/* Load more sentinel */}
        <div ref={loadMoreRef} className="py-2" />
      </div>
    </aside>
  );
}
```

**`ConversationCard` anatomy:**

```tsx
// Entire card is a clickable div with hover:bg-elevated transition-colors cursor-pointer
// When selected: bg-elevated border-l-2 border-accent (shift padding to compensate: pl-[14px])
// When not selected: border-l-2 border-transparent pl-4

<div
  className={cn(
    'flex gap-3 px-0 py-3 border-b border-border transition-colors cursor-pointer',
    selected
      ? 'bg-elevated border-l-2 border-accent pl-[14px] pr-4'
      : 'hover:bg-elevated border-l-2 border-transparent pl-4 pr-4',
  )}
  onClick={onClick}
>
  {/* Channel icon */}
  <div className="mt-0.5 shrink-0">
    <ChannelIcon channel={conv.channel} className="h-4 w-4 text-text-muted" />
  </div>

  <div className="flex-1 min-w-0">
    {/* Row 1: contact ID + time */}
    <div className="flex items-center justify-between mb-0.5">
      <p className="text-xs font-medium text-text-primary truncate">
        {conv.contactId}  {/* already masked by API */}
      </p>
      <p className="text-[10px] text-text-muted shrink-0 ml-2">{timeAgo(conv.lastMessageAt)}</p>
    </div>

    {/* Row 2: message preview */}
    <p className="text-[11px] text-text-muted truncate mb-1.5">{conv.lastMessagePreview}</p>

    {/* Row 3: badges */}
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] bg-accent-dim text-accent px-1.5 py-0.5 rounded">
        {conv.worker.name}
      </span>
      {conv.hasEscalation && (
        <span className="text-[10px] bg-amber-500/15 text-amber-400 px-1.5 py-0.5 rounded">
          Escalated
        </span>
      )}
      {conv.status === 'automated' && (
        <span className="text-[10px] bg-accent-dim/60 text-text-muted px-1.5 py-0.5 rounded">
          Auto
        </span>
      )}
    </div>
  </div>
</div>
```

**`ChannelIcon` helper:**
```tsx
const CHANNEL_ICONS: Record<string, LucideIcon> = {
  web: Globe, email: Mail, whatsapp: Smartphone, instagram: Instagram,
};
function ChannelIcon({ channel, className }: { channel: string; className: string }) {
  const Icon = CHANNEL_ICONS[channel] ?? MessageSquare;
  return <Icon className={className} />;
}
```

---

## Step 7: `ConversationThread` component

**Empty state (no conversation selected):**
```tsx
<div className="flex-1 flex items-center justify-center bg-base">
  <div className="text-center">
    <MessageSquare className="h-10 w-10 text-text-muted mx-auto mb-3 opacity-40" />
    <p className="text-sm font-medium text-text-primary">Select a conversation</p>
    <p className="text-xs text-text-muted mt-1 max-w-[200px] mx-auto">
      Choose a conversation from the list to view the full thread.
    </p>
  </div>
</div>
```

**Thread layout:**
```tsx
<div className="flex flex-col h-full bg-base overflow-hidden">
  {/* Thread header */}
  <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
    <div className="flex items-center gap-3">
      <ChannelIcon channel={thread.contact.channel} className="h-5 w-5 text-text-muted" />
      <div>
        <p className="text-sm font-medium text-text-primary">
          {thread.contact.maskedId}
        </p>
        <p className="text-xs text-text-muted">
          via {thread.worker.name} on {capitalize(thread.contact.channel)}
          {' '}&middot;{' '}
          {format(thread.startedAt, 'd MMM yyyy')}
        </p>
      </div>
    </div>
    <button
      onClick={handleExport}
      className="text-xs text-text-muted hover:text-text-primary flex items-center gap-1.5
                 border border-border rounded-lg px-3 py-1.5 hover:bg-elevated transition-colors"
    >
      <Download className="h-3.5 w-3.5" />
      Export
    </button>
  </div>

  {/* Message list */}
  <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-4 space-y-1">
    {thread.messages.map((msg, i) => (
      <MessageRow key={msg.id} msg={msg} prevMsg={thread.messages[i - 1]} workerName={thread.worker.name} />
    ))}
  </div>
</div>
```

**`MessageRow` component - all four roles:**

User message:
```tsx
if (msg.role === 'user') return (
  <div className="flex flex-col items-end mb-1">
    <div className="max-w-[70%] rounded-2xl rounded-br-sm bg-accent-dim px-4 py-2.5">
      <p className="text-sm text-text-primary">{msg.content}</p>
    </div>
    {showTimestamp && (
      <p className="text-[10px] text-text-muted mt-0.5 pr-1">{formatMsgTime(msg.timestamp)}</p>
    )}
  </div>
);
```

Aiva message (with attestation state):
```tsx
if (msg.role === 'aiva') return (
  <div className="flex items-start gap-2 mb-1">
    <div className="h-6 w-6 rounded-full bg-accent-dim text-accent text-[10px] font-semibold
                    flex items-center justify-center shrink-0 mt-1">
      {workerName.charAt(0)}
    </div>
    <div className="flex-col">
      <div className="max-w-[70%] rounded-2xl rounded-tl-sm bg-elevated border border-border px-4 py-2.5">
        <p className="text-sm text-text-secondary">{msg.content}</p>
      </div>
      <div className="flex items-center gap-2 mt-0.5 pl-1">
        {msg.attestationTx ? (
          <a
            href={`${process.env.NEXT_PUBLIC_EXPLORER_URL}/${msg.attestationTx}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] text-green-400 hover:underline"
          >
            Verified on-chain
          </a>
        ) : (
          <p className="text-[10px] text-text-muted">Attestation pending</p>
        )}
        {showTimestamp && <p className="text-[10px] text-text-muted">{formatMsgTime(msg.timestamp)}</p>}
      </div>
    </div>
  </div>
);
```

VA message (amber tint - human agent who took over from escalation):
```tsx
if (msg.role === 'va') return (
  <div className="flex items-start gap-2 mb-1">
    <div className="h-6 w-6 rounded-full bg-amber-500/15 text-amber-400 text-[10px] font-semibold
                    flex items-center justify-center shrink-0 mt-1">
      VA
    </div>
    <div>
      <div className="max-w-[70%] rounded-2xl rounded-tl-sm bg-amber-500/10 border border-amber-500/25 px-4 py-2.5">
        <p className="text-[10px] font-medium text-amber-400 mb-0.5">VERLOX Team</p>
        <p className="text-sm text-text-secondary">{msg.content}</p>
      </div>
      {showTimestamp && (
        <p className="text-[10px] text-text-muted mt-0.5 pl-1">{formatMsgTime(msg.timestamp)}</p>
      )}
    </div>
  </div>
);
```

System event (escalation divider, automation event):
```tsx
if (msg.role === 'system') {
  const isEscalation = msg.actionType === 'escalated';
  return (
    <div className={cn(
      'flex items-center gap-3 my-4',
      isEscalation ? 'text-amber-400' : 'text-text-muted',
    )}>
      <div className={cn('flex-1 border-t border-dashed', isEscalation ? 'border-amber-500/30' : 'border-border')} />
      <p className="text-[10px] shrink-0 whitespace-nowrap">
        {msg.summary} &middot; {formatMsgTime(msg.timestamp)}
      </p>
      <div className={cn('flex-1 border-t border-dashed', isEscalation ? 'border-amber-500/30' : 'border-border')} />
    </div>
  );
}
```

**`showTimestamp` rule:**
Show the timestamp row below a message if:
- It is the last message in the conversation, OR
- The next message is more than 5 minutes later (`nextMsg.timestamp - msg.timestamp > 5 * 60 * 1000`), OR
- The next message is from a different role.

This keeps timestamps sparse and readable.

---

## Step 8: Analytics page - layout

Create `src/app/(workspace)/analytics/page.tsx`.

```tsx
export default function AnalyticsPage() {
  const [period, setPeriod] = useState<'7d' | '30d' | '90d'>('30d');

  return (
    <div className="p-6 space-y-6 overflow-y-auto">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-text-primary">Analytics</h1>
        <PeriodSelector value={period} onChange={setPeriod} />
      </div>

      {/* Stat cards */}
      <SummaryCards period={period} />

      {/* Volume chart - full width */}
      <VolumeChart period={period} />

      {/* Two-column: channel breakdown + escalation trend */}
      <div className="grid grid-cols-2 gap-4">
        <ChannelBreakdownChart period={period} />
        <EscalationTrendChart period={period} />
      </div>

      {/* Heatmap - full width */}
      <ActivityHeatmap period={period} />

      {/* Aiva breakdown table */}
      <AivaBreakdownTable period={period} />
    </div>
  );
}
```

---

## Step 9: Period selector

```tsx
function PeriodSelector({ value, onChange }: { value: string; onChange: (v: '7d'|'30d'|'90d') => void }) {
  return (
    <div className="flex items-center gap-0.5 rounded-lg border border-border p-0.5 bg-elevated">
      {(['7d', '30d', '90d'] as const).map((p) => (
        <button
          key={p}
          onClick={() => onChange(p)}
          className={cn(
            'px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
            value === p
              ? 'bg-accent-dim text-accent'
              : 'text-text-muted hover:text-text-primary',
          )}
        >
          {p === '7d' ? '7 days' : p === '30d' ? '30 days' : '90 days'}
        </button>
      ))}
    </div>
  );
}
```

---

## Step 10: `SummaryCards` component

Four cards in `grid grid-cols-2 lg:grid-cols-4 gap-3`.

```tsx
function StatCard({ label, value, trendPct }: { label: string; value: string | number; trendPct: number }) {
  const positive = trendPct >= 0;
  return (
    <div className="rounded-lg border border-border bg-elevated p-4">
      <p className="text-2xl font-semibold text-text-primary">{value}</p>
      <p className="text-xs text-text-muted mt-0.5">{label}</p>
      {trendPct !== 0 && (
        <div className="flex items-center gap-1 mt-2">
          {positive
            ? <TrendingUp className="h-3 w-3 text-green-400" />
            : <TrendingDown className="h-3 w-3 text-red-400" />
          }
          <span className={cn('text-[11px]', positive ? 'text-green-400' : 'text-red-400')}>
            {positive ? '+' : ''}{trendPct.toFixed(0)}% vs prev period
          </span>
        </div>
      )}
    </div>
  );
}
```

Cards:
1. "Total conversations" - `summary.totalConversations`
2. "Aiva replies" - `summary.messagesFromAiva`
3. "Escalation rate" - `(summary.escalationRate * 100).toFixed(1) + '%'`
4. "Avg first response" - format as "Xm Ys" or "> 1h" if avg > 3600s

---

## Step 11: `VolumeChart` component

```tsx
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

function VolumeChart({ period }) {
  const { data } = useSWR(`/api/analytics/volume?period=${period}`);

  return (
    <div className="rounded-lg border border-border bg-elevated p-4">
      <p className="text-sm font-medium text-text-primary mb-4">Message volume</p>
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={data?.volume ?? []} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
          <XAxis
            dataKey="date"
            tickFormatter={(v) => format(parseISO(v), period === '7d' ? 'EEE' : 'MMM d')}
            tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
            axisLine={false} tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
            axisLine={false} tickLine={false}
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={{ background: 'var(--bg-overlay)', border: '1px solid var(--border-border)',
                            borderRadius: '8px', fontSize: '11px', color: 'var(--text-primary)' }}
            cursor={{ stroke: 'var(--border-border)' }}
          />
          <Line
            type="monotone" dataKey="count" name="Messages"
            stroke="var(--text-accent)" strokeWidth={2}
            dot={false} activeDot={{ r: 4, fill: 'var(--text-accent)' }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
```

Note: `var(--text-accent)` and `var(--bg-overlay)` etc. are CSS custom properties set in
`globals.css` from the design token system established in prompt 10.

---

## Step 12: `ChannelBreakdownChart` component

```tsx
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const CHANNEL_COLORS: Record<string, string> = {
  web: 'var(--text-accent)',
  email: '#60a5fa',
  whatsapp: '#4ade80',
  instagram: '#f472b6',
};

function ChannelBreakdownChart({ period }) {
  const { data } = useSWR(`/api/analytics/channels?period=${period}`);

  return (
    <div className="rounded-lg border border-border bg-elevated p-4">
      <p className="text-sm font-medium text-text-primary mb-4">By channel</p>
      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={data?.channels ?? []} layout="vertical" margin={{ top: 0, right: 8, left: 8, bottom: 0 }}>
          <XAxis type="number" hide />
          <YAxis
            type="category" dataKey="channel"
            tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
            axisLine={false} tickLine={false} width={70}
          />
          <Tooltip
            contentStyle={{ background: 'var(--bg-overlay)', border: '1px solid var(--border-border)',
                            borderRadius: '8px', fontSize: '11px' }}
            formatter={(value: number, name: string, props) => [`${value} (${props.payload.pct}%)`, 'Messages']}
          />
          <Bar dataKey="count" radius={[0, 4, 4, 0]} isAnimationActive={false}>
            {(data?.channels ?? []).map((entry) => (
              <Cell key={entry.channel} fill={CHANNEL_COLORS[entry.channel] ?? '#6b7280'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
```

---

## Step 13: `EscalationTrendChart` component

```tsx
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

function EscalationTrendChart({ period }) {
  const { data } = useSWR(`/api/analytics/escalations?period=${period}`);

  return (
    <div className="rounded-lg border border-border bg-elevated p-4">
      <p className="text-sm font-medium text-text-primary mb-4">Escalation rate</p>
      <ResponsiveContainer width="100%" height={160}>
        <AreaChart data={data?.escalations ?? []} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
          <defs>
            <linearGradient id="escGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#f59e0b" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="date"
            tickFormatter={(v) => format(parseISO(v), 'MMM d')}
            tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
            axisLine={false} tickLine={false}
          />
          <YAxis
            tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
            tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
            axisLine={false} tickLine={false}
            domain={[0, 'auto']}
          />
          <Tooltip
            contentStyle={{ background: 'var(--bg-overlay)', border: '1px solid var(--border-border)',
                            borderRadius: '8px', fontSize: '11px' }}
            formatter={(v: number) => [`${(v * 100).toFixed(1)}%`, 'Escalation rate']}
          />
          <Area
            type="monotone" dataKey="rate" stroke="#f59e0b" strokeWidth={2}
            fill="url(#escGrad)" isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
```

---

## Step 14: `ActivityHeatmap` component

7 rows (Mon-Sun) x 24 columns (0-23). Color intensity is proportional to message count.
The color uses the accent color at varying opacity (low count = very low opacity, high = full).
No external charting library; pure CSS grid.

```tsx
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function ActivityHeatmap({ period }) {
  const { data } = useSWR(`/api/analytics/heatmap?period=${period}`);
  const cells: Array<{ dayOfWeek: number; hour: number; count: number }> = data?.heatmap ?? [];

  const maxCount = Math.max(...cells.map(c => c.count), 1);
  const getCount = (day: number, hour: number) =>
    cells.find(c => c.dayOfWeek === day && c.hour === hour)?.count ?? 0;

  return (
    <div className="rounded-lg border border-border bg-elevated p-4">
      <p className="text-sm font-medium text-text-primary mb-4">Activity by time of day</p>

      {/* Hour labels */}
      <div className="grid mb-1" style={{ gridTemplateColumns: '32px repeat(24, 1fr)' }}>
        <div />
        {Array.from({ length: 24 }, (_, h) => (
          <div key={h} className="text-[9px] text-text-muted text-center">
            {h === 0 ? '0' : h === 6 ? '6' : h === 12 ? '12' : h === 18 ? '18' : ''}
          </div>
        ))}
      </div>

      {/* Rows: one per day */}
      {DAYS.map((day, dayIdx) => (
        <div key={day} className="grid mb-0.5" style={{ gridTemplateColumns: '32px repeat(24, 1fr)', gap: '2px' }}>
          <div className="text-[10px] text-text-muted flex items-center justify-end pr-1.5 h-5">
            {day}
          </div>
          {Array.from({ length: 24 }, (_, hour) => {
            const count = getCount(dayIdx, hour);
            const intensity = count === 0 ? 0 : 0.08 + (count / maxCount) * 0.88;
            return (
              <div
                key={hour}
                title={`${day} ${hour}:00 - ${count} messages`}
                className="h-5 rounded-sm"
                style={{ backgroundColor: `rgba(26, 95, 122, ${intensity})` }}
              />
            );
          })}
        </div>
      ))}

      {/* Legend */}
      <div className="flex items-center gap-2 mt-3 justify-end">
        <span className="text-[9px] text-text-muted">Less</span>
        {[0.08, 0.30, 0.55, 0.80, 0.96].map((op) => (
          <div key={op} className="h-3 w-3 rounded-sm"
               style={{ backgroundColor: `rgba(26, 95, 122, ${op})` }} />
        ))}
        <span className="text-[9px] text-text-muted">More</span>
      </div>
    </div>
  );
}
```

The RGB values `26, 95, 122` match the teal accent color. If the design token system exposes the
accent RGB as a CSS variable, use that. Otherwise hardcode here (heatmap intensity math requires
raw RGB, not a hex string).

---

## Step 15: `AivaBreakdownTable` component

```tsx
function AivaBreakdownTable({ period }) {
  const { data } = useSWR(`/api/analytics/aiva-breakdown?period=${period}`);

  return (
    <div className="rounded-lg border border-border bg-elevated overflow-hidden">
      <div className="px-4 py-3 border-b border-border">
        <p className="text-sm font-medium text-text-primary">Per Aiva</p>
      </div>
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left px-4 py-2 text-text-muted font-medium">Aiva</th>
            <th className="text-right px-4 py-2 text-text-muted font-medium">Messages</th>
            <th className="text-right px-4 py-2 text-text-muted font-medium">Escalations</th>
            <th className="text-right px-4 py-2 text-text-muted font-medium">Avg response</th>
          </tr>
        </thead>
        <tbody>
          {(data?.aivas ?? []).map((row) => (
            <tr key={row.workerId} className="border-b border-border last:border-0 hover:bg-overlay transition-colors">
              <td className="px-4 py-2.5 font-medium text-text-primary">{row.workerName}</td>
              <td className="px-4 py-2.5 text-right text-text-secondary">{row.messageCount.toLocaleString()}</td>
              <td className="px-4 py-2.5 text-right text-text-secondary">{row.escalationCount}</td>
              <td className="px-4 py-2.5 text-right text-text-muted">{formatDuration(row.avgResponseSec)}</td>
            </tr>
          ))}
          {(data?.aivas ?? []).length === 0 && (
            <tr>
              <td colSpan={4} className="px-4 py-6 text-center text-text-muted">No data for this period.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
```

`formatDuration(sec)`: if < 60 return `${sec}s`; if < 3600 return `${Math.floor(sec/60)}m ${sec%60}s`; else return `> 1h`.

---

## Done When

**Backend:**
- [ ] `GET /api/conversations` returns paginated list with correct masking logic for all four channel types
- [ ] `GET /api/conversations/:id/thread` returns messages with correct role enum values including 'va' and 'system'
- [ ] System events have `actionType` and `summary` fields; summaries are human-readable strings
- [ ] `attestationTx` is present on aiva messages where attestation exists; null otherwise
- [ ] `GET /api/conversations/:id/export-pdf` returns JSON download with correct Content-Disposition header
- [ ] All six analytics routes return correct structure with prev-period values
- [ ] Heatmap route converts PostgreSQL `EXTRACT DOW` (0=Sunday) to ISO ordering (0=Monday) in app layer
- [ ] All routes enforce workspace_id scope; cross-tenant access returns 403
- [ ] All nine Next.js proxy routes forward auth header and query string correctly

**Conversations page:**
- [ ] Sidebar shows "Conversations" and "Analytics" entries under the Aiva nav group
- [ ] Page splits into 320px left panel + flex-1 right panel; full viewport height (minus topbar)
- [ ] Left panel: search input, Aiva filter dropdown, channel filter dropdown
- [ ] ConversationCard: channel icon, masked contact ID, time-ago, message preview, worker badge, escalation badge
- [ ] Selected card has left accent border and bg-elevated; cursor-pointer on all cards
- [ ] Empty state shown in right panel when nothing is selected
- [ ] Thread header: channel icon, masked contact ID, worker + channel label, date, Export button
- [ ] User messages: right-aligned, bg-accent-dim
- [ ] Aiva messages: left-aligned, bg-elevated, avatar initial, attestation state below bubble
- [ ] VA messages: left-aligned, amber tint, "VERLOX Team" label above content
- [ ] System events: centered dashed divider with label and timestamp; escalation events use amber color
- [ ] Timestamps appear only at message cluster boundaries (> 5 min gap or role change)

**Analytics page:**
- [ ] Period selector (7d/30d/90d) renders as pill tabs; changes all charts simultaneously
- [ ] Four stat cards: correct labels, formatted values, trend arrows with green/red color
- [ ] Volume: recharts LineChart, accent-color line, correct X-axis date formatting per period
- [ ] Channel breakdown: horizontal recharts BarChart with per-channel colors
- [ ] Escalation trend: recharts AreaChart with amber color and gradient fill
- [ ] Activity heatmap: 7x24 CSS grid, day labels left, hour labels top, intensity from low to full opacity
- [ ] Heatmap cell tooltips show correct day, hour, and count
- [ ] Heatmap legend shown below grid
- [ ] Per-Aiva table: sorted by message count descending; human-readable avg response
- [ ] `isAnimationActive={false}` on all recharts chart components

**General:**
- [ ] No em dashes in any copy, labels, comments, or error messages
- [ ] No emojis anywhere; use lucide-react icons only
