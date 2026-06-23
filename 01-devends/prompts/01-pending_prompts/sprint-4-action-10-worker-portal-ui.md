# Sprint 4 - Prompt 10: Aiva Portal UI (app.carinaai.uk/aiva)

**Sprint:** 4
**Prompt number:** 10
**Primary agent:** Cursor
**Estimated hours:** 10-12 h
**Depends on:** 08-worker-brain.md must be merged first so API routes exist to call

---

## Post-build (MANDATORY)

When all "Done When" criteria are satisfied:
1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file.
2. Move to `internal/prompts/archived_prompts/archives_from_pending_prompts/sprint-4/action/`.

---

## Read First

Read every file listed before writing a single line of code:

1. `frontends/client-apps/app.carinaai.uk/src/components/shell/AppSidebar.tsx` - full sidebar; you will add a nav group here
2. `frontends/client-apps/app.carinaai.uk/src/lib/workspace-nav.ts` - where NAV_GROUPS and NAV_ROUTES are defined; you will add entries here
3. `frontends/client-apps/app.carinaai.uk/src/app/(workspace)/layout.tsx` - the workspace layout wrapper; do not change it
4. `frontends/client-apps/app.carinaai.uk/src/app/(workspace)/billing/page.tsx` - workspace page scaffold pattern to copy
5. `frontends/client-apps/app.carinaai.uk/src/components/billing/BillingClient.tsx` - how multi-section pages and tab bars are structured
6. `frontends/client-apps/app.carinaai.uk/src/components/billing/PlanCard.tsx` - card component pattern
7. `frontends/client-apps/app.carinaai.uk/src/lib/core-proxy.ts` - how to call the core backend; use `resolveCoreUrl()`
8. `frontends/client-apps/app.carinaai.uk/src/lib/session.ts` - `requireSession` and `requireWorkspace` helpers

---

## Context

The Aiva portal lives inside the existing `app.carinaai.uk` Next.js application as a route group:
`(workspace)/aiva/`. It is not a separate app. Sessions and auth are inherited from the existing
workspace session system. The existing middleware handles unauthenticated redirects.

Three pages:
- `/aiva` - hire form (describe a role, pick channels, meet your Aiva)
- `/aiva/workers` - roster of all Aivas for this workspace
- `/aiva/workers/[id]` - detail page with tabbed sections

Two later prompts extend the detail page:
- Prompt 20 adds the Conversations tab and Analytics tab
- Prompt 28 adds the Training tab

This prompt builds: Overview, Channels, Automations, Settings tabs plus the tab registration
pattern that prompts 20 and 28 will use.

**Design constraint:** Use only existing Tailwind token classes from the workspace. Do not
invent new classes. Do not add new dependencies. Check `src/components/ui/` before importing
anything. Use lucide-react icons (already installed). The token names in use are:
`bg-base`, `bg-surface`, `bg-elevated`, `bg-overlay`, `text-text-primary`, `text-text-secondary`,
`text-text-muted`, `text-accent`, `bg-accent-dim`, `border-border`, `text-danger`.

---

## Step 1: Route structure

Create these files:

```
src/app/(workspace)/aiva/
  page.tsx                      Hire entry form
  workers/
    page.tsx                    Roster of all Aivas
    [id]/
      page.tsx                  Detail page (tabs)
      AivaDetailClient.tsx      Client component for tabs and interactions
```

All pages use the existing workspace layout wrapper. Do not build a new layout.
Use the same outer div pattern from `billing/page.tsx`:
```tsx
<div className="flex-1 overflow-y-auto">
  <div className="mx-auto max-w-5xl space-y-8 px-6 py-8">
    ...
  </div>
</div>
```

---

## Step 2: Sidebar - add Aiva nav group

**File:** `src/lib/workspace-nav.ts`

Add `'aiva'` to the `NavGroupId` union type. Add a new group entry to `NAV_GROUPS`:

```typescript
{
  id: 'aiva',
  label: 'Aiva',
  iconName: 'Bot',
}
```

Position it between the `intelligence` group and the `account` group.

Add two routes to `NAV_ROUTES`:

```typescript
{ href: '/aiva/workers', label: 'Your Aivas', group: 'aiva', iconName: 'Bot' },
{ href: '/aiva',        label: 'Hire',        group: 'aiva', iconName: 'Plus' },
```

**File:** `src/components/shell/AppSidebar.tsx`

Add `Bot` to the lucide-react import list. Add `Bot` to `NAV_ICON_MAP`:

```typescript
Bot,
```

No other changes to `AppSidebar.tsx`. The existing `NavGroupSection` and `NavRouteRow` components
handle everything else automatically.

In the collapsed sidebar, the Bot icon will represent the Aiva group, consistent with all other groups.

---

## Step 3: Entry page - `/aiva`

**File:** `src/app/(workspace)/aiva/page.tsx`

Server component. Fetch the workspace from session at the top. Pass workspace id to the client
component.

**Layout:** Two-column grid on desktop (`grid grid-cols-[1fr_320px] gap-8`), single column stacked
on mobile.

### Left column: the brief form

```
h1: Hire an Aiva
    className="text-2xl font-semibold"

p:  Describe the role in plain English. Your Aiva will be ready in under three minutes.
    className="mt-1 text-sm text-text-secondary"
```

Form fields (all in a `<form>` with `onSubmit` handler):

**Aiva name:**
```tsx
<label className="text-sm font-medium text-text-primary">
  What should I call this Aiva?
</label>
<input
  name="roleName"
  required
  placeholder="e.g. Aria, Property Manager, Friday"
  className="..."  // match existing input styles in the workspace
/>
```

**Role description:**
```tsx
<label className="text-sm font-medium text-text-primary">
  What does this Aiva do?
</label>
<textarea
  name="roleDescription"
  rows={5}
  required
  placeholder="Describe the tasks, tone, and who it talks to.
Example: Handles tenant WhatsApp messages about maintenance and rent.
Tone is professional and reassuring. Escalates anything legal or urgent."
  className="..."
/>
```

**Channel selection** (checkbox group, 2-column grid):

```tsx
const CHANNELS = [
  { id: 'whatsapp',  label: 'WhatsApp',  icon: MessageCircle },
  { id: 'email',     label: 'Email',     icon: Mail          },
  { id: 'slack',     label: 'Slack',     icon: Hash          },
  { id: 'telegram',  label: 'Telegram',  icon: Send          },
  { id: 'web',       label: 'Web chat',  icon: Globe         },
];
```

Each checkbox item: icon + label, with a visible checkbox. At least one must be checked
(validate client-side before submit).

**Submit button:**

```tsx
// Default state
<button type="submit" className="btn-primary w-full sm:w-auto">
  Meet your Aiva
</button>

// Loading state (isSubmitting = true)
<button disabled className="btn-primary w-full sm:w-auto opacity-70">
  Configuring {roleNameValue || 'your Aiva'}...
</button>
```

Interpolate the live value of the `roleName` field into the loading text. Use a controlled
input for `roleName` so the value is available during submission.

On success: redirect to `/aiva/workers/[id]` using `router.push`, where id comes from the
POST response body `{ worker: { id } }`.

On error: show an inline `<p className="text-sm text-danger mt-2">` below the button with the
error message. Do not use a toast for form submission errors.

### Right column: role templates

Section label:
```tsx
<p className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-3">
  Or start from a template
</p>
```

Six cards in a `flex flex-col gap-2`. Each card is a `<button type="button">` that calls
`fillFromTemplate(role)` to populate the form state.

Card anatomy:
```tsx
<button
  type="button"
  onClick={() => fillFromTemplate(role)}
  className={cn(
    'w-full rounded-lg border p-3 text-left transition-colors hover:border-accent',
    selected === role.id ? 'border-accent bg-accent-dim' : 'border-border bg-elevated',
  )}
>
  <div className="flex items-center gap-2 mb-1">
    <role.Icon className="h-3.5 w-3.5 text-text-muted" />
    <span className="text-xs font-medium text-text-primary">{role.label}</span>
  </div>
  <p className="text-[11px] text-text-muted italic truncate">{role.exampleQ}</p>
  <p className="text-[11px] text-accent-dim truncate">{role.exampleA}</p>
</button>
```

`fillFromTemplate(role)` sets `roleName` and `roleDescription` state and sets `selected` to
the role id. Clear `selected` in the `onChange` of either field (user edited after selecting).

Role data (add as a constant in the file or a separate `role-templates.ts` file):

```typescript
export const ROLE_TEMPLATES = [
  {
    id: 'customer_service',
    label: 'Customer service',
    icon: Headphones,
    exampleQ: '"Do you offer next-day delivery?"',
    exampleA: 'Aria: "Yes, orders placed before 2pm ship same day..."',
    roleName: 'Customer Service',
    roleDescription: `Triages inbound queries, answers FAQs from the knowledge base, and routes complex issues to the right team member. Tone: helpful and calm. Escalates immediately on billing disputes, legal questions, or angry tone.`,
  },
  {
    id: 'booking',
    label: 'Booking assistant',
    icon: CalendarDays,
    exampleQ: '"Can I book a table for Saturday?"',
    exampleA: 'Aria: "Saturday evening works. How many guests?"',
    roleName: 'Booking Assistant',
    roleDescription: `Manages booking requests via WhatsApp and web chat. Confirms availability, collects guest details, and sends confirmation messages. Does not take payment. Escalates complaints or special-needs requests.`,
  },
  {
    id: 'sales',
    label: 'Sales qualifier',
    icon: Target,
    exampleQ: '"What does your service include?"',
    exampleA: 'Aria: "Happy to walk you through it. What size is your team?"',
    roleName: 'Sales Qualifier',
    roleDescription: `Responds to inbound enquiries, qualifies leads by asking the right questions, and books discovery calls. Does not make pricing commitments. Escalates when a prospect asks to speak to a human.`,
  },
  {
    id: 'property',
    label: 'Property enquiry',
    icon: Building2,
    exampleQ: '"Is the flat on Park Road still available?"',
    exampleA: 'Aria: "It is. Want to book a viewing this week?"',
    roleName: 'Property Enquiry',
    roleDescription: `Handles tenant and buyer enquiries about available properties. Books viewings, answers questions about terms and fees, and logs maintenance requests. Escalates anything involving legal notices, complaints, or eviction queries.`,
  },
  {
    id: 'tech_support',
    label: 'Tech support',
    icon: Wrench,
    exampleQ: '"My login is not working, can you help?"',
    exampleA: 'Aria: "I can sort that. What email do you use to log in?"',
    roleName: 'Tech Support',
    roleDescription: `First-line technical support for SaaS or software products. Resolves common login, billing, and configuration issues using the knowledge base. Escalates bugs, outages, and complaints immediately.`,
  },
  {
    id: 'custom',
    label: 'Custom role',
    icon: Plus,
    exampleQ: null,
    exampleA: 'Describe your business in your own words.',
    roleName: '',
    roleDescription: '',
  },
];
```

The "Custom role" card has `border-dashed` border treatment and clears both fields on click
so the user starts fresh.

---

## Step 4: Roster page - `/aiva/workers`

**File:** `src/app/(workspace)/aiva/workers/page.tsx`

Server component. Fetch workers list via the core proxy at render time.

**Page header:**
```tsx
<div className="flex items-center justify-between">
  <div>
    <h1 className="text-2xl font-semibold">Your Aivas</h1>
    <p className="mt-1 text-sm text-text-secondary">
      {workers.length} Aiva{workers.length !== 1 ? 's' : ''} configured
    </p>
  </div>
  <Link href="/aiva" className="btn-primary flex items-center gap-2">
    <Plus className="h-4 w-4" /> Hire an Aiva
  </Link>
</div>
```

**Empty state (when `workers.length === 0`):**
```tsx
<div className="flex flex-col items-center justify-center py-24 text-center">
  <Bot className="h-12 w-12 text-text-muted mb-4" />
  <h2 className="text-lg font-medium text-text-primary">No Aivas yet</h2>
  <p className="mt-1 text-sm text-text-secondary max-w-xs">
    Hire your first Aiva and it will appear here.
  </p>
  <Link href="/aiva" className="btn-primary mt-6">
    Hire an Aiva
  </Link>
</div>
```

**Aiva cards grid:**
```tsx
<div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
  {workers.map((worker) => <AivaCard key={worker.id} worker={worker} />)}
</div>
```

**`AivaCard` component** (client component for the pause/resume toggle):

```
┌──────────────────────────────────────────────────────┐
│  [Avatar]  [Name]                   [Status chip]    │
│            [Role description, 1 line truncated]      │
│  ───────────────────────────────────────────────     │
│  [Channel icons]       [N msgs today]  ·  [time ago] │
│                              [Manage]  [Pause icon]  │
└──────────────────────────────────────────────────────┘
```

CSS structure:
```tsx
<div className="rounded-lg border border-border bg-elevated p-4 flex flex-col gap-3">
  {/* Header row */}
  <div className="flex items-start justify-between gap-2">
    <div className="flex items-center gap-3">
      <AivaAvatar name={worker.name} />
      <div className="min-w-0">
        <p className="font-medium text-text-primary truncate">{worker.name}</p>
        <p className="text-xs text-text-muted truncate">{worker.roleDescription.slice(0,60)}...</p>
      </div>
    </div>
    <StatusChip status={worker.status} trialDaysLeft={worker.trialDaysLeft} />
  </div>

  {/* Divider */}
  <div className="border-t border-border" />

  {/* Footer row */}
  <div className="flex items-center justify-between">
    <div className="flex items-center gap-2">
      <ChannelIcons channels={worker.channels} />
      <span className="text-xs text-text-muted">
        {worker.messagesToday} msgs today · {timeAgo(worker.lastActiveAt)}
      </span>
    </div>
    <div className="flex items-center gap-1">
      <Link href={`/aiva/workers/${worker.id}`}
            className="text-xs text-text-secondary hover:text-accent px-2 py-1">
        Manage
      </Link>
      <PauseButton workerId={worker.id} status={worker.status} />
    </div>
  </div>
</div>
```

**`AivaAvatar` component:**
```tsx
// Derive a stable background from the first character of the name.
// Use a fixed palette of 4 options keyed by char code mod 4:
// 0: bg-accent-dim text-accent
// 1: bg-purple-500/10 text-purple-400
// 2: bg-emerald-500/10 text-emerald-400
// 3: bg-orange-500/10 text-orange-400

function AivaAvatar({ name }: { name: string }) {
  const idx = (name.charCodeAt(0) || 0) % 4;
  const palettes = [
    'bg-accent-dim text-accent',
    'bg-purple-500/10 text-purple-400',
    'bg-emerald-500/10 text-emerald-400',
    'bg-orange-500/10 text-orange-400',
  ];
  return (
    <div className={`h-9 w-9 rounded-full flex items-center justify-center text-sm font-medium shrink-0 ${palettes[idx]}`}>
      {name.charAt(0).toUpperCase()}
    </div>
  );
}
```

**`StatusChip` component:**
```tsx
function StatusChip({ status, trialDaysLeft }: { status: string; trialDaysLeft?: number }) {
  const configs: Record<string, { dot: string; label: string }> = {
    active:      { dot: 'bg-green-400',  label: 'Active'           },
    trial:       { dot: 'bg-amber-400',  label: `Trial · ${trialDaysLeft}d left` },
    paused:      { dot: 'bg-gray-400',   label: 'Paused'           },
    suspended:   { dot: 'bg-red-400',    label: 'Suspended'        },
    setting_up:  { dot: 'bg-blue-400 animate-pulse', label: 'Setting up' },
  };
  const config = configs[status] ?? configs.paused;
  return (
    <span className="flex items-center gap-1.5 shrink-0">
      <span className={`h-2 w-2 rounded-full ${config.dot}`} />
      <span className="text-xs text-text-muted whitespace-nowrap">{config.label}</span>
    </span>
  );
}
```

**`PauseButton` component:**
```tsx
// Optimistic update: flip status locally, then call PATCH.
// On error: revert local state and show an inline error.
// No navigation on pause/resume.
function PauseButton({ workerId, status }: { workerId: string; status: string }) {
  const isPaused = status === 'paused';
  async function toggle() {
    // optimistic update + PATCH /api/aiva/workers/[workerId]
    // body: { status: isPaused ? 'active' : 'paused' }
  }
  return (
    <button
      type="button"
      onClick={toggle}
      title={isPaused ? 'Resume' : 'Pause'}
      className="rounded p-1 text-text-muted hover:text-text-primary hover:bg-overlay transition-colors"
    >
      {isPaused
        ? <Play className="h-3.5 w-3.5" />
        : <Pause className="h-3.5 w-3.5" />
      }
    </button>
  );
}
```

---

## Step 5: Detail page header

**File:** `src/app/(workspace)/aiva/workers/[id]/page.tsx`

Server component. Fetch worker detail at render time. Pass to `AivaDetailClient`.

**Header:**
```tsx
<div className="flex items-start justify-between gap-4 mb-6">
  <div className="flex items-center gap-3">
    <AivaAvatar name={worker.name} />  {/* reuse from above - extract to shared component */}
    <div>
      <h1 className="text-2xl font-semibold">{worker.name}</h1>
      <div className="flex items-center gap-3 mt-0.5">
        <StatusChip status={worker.status} trialDaysLeft={worker.trialDaysLeft} />
        <span className="text-xs text-text-muted">
          {worker.channels.length} channel{worker.channels.length !== 1 ? 's' : ''}
        </span>
      </div>
    </div>
  </div>
  <div className="flex items-center gap-2 shrink-0">
    <PauseResumeButton workerId={worker.id} status={worker.status} />
    <a
      href={`${process.env.NEXT_PUBLIC_SCOUT_FLEET_URL ?? 'https://console.labyrinthscout.com/dashboard'}/agents/${worker.id}`}
      target="_blank"
      rel="noopener noreferrer"
      className="btn-ghost flex items-center gap-1.5 text-xs"
    >
      Scout <ExternalLink className="h-3 w-3" />
    </a>
  </div>
</div>
```

`PauseResumeButton` here is a client component (needs onClick). It shows a confirm dialog before
pausing (use `window.confirm` for simplicity; no confirm before resuming). Calls
`PATCH /api/aiva/workers/[id]` with `{ status: 'paused' | 'active' }` and refreshes the page
via `router.refresh()` on success.

---

## Step 6: Tab bar and tab registration pattern

**File:** `src/app/(workspace)/aiva/workers/[id]/AivaDetailClient.tsx`

This is a client component that owns the tab bar and renders the active tab's content.

Define the tabs as a typed array so prompts 20 and 28 can add to it cleanly:

```typescript
// src/app/(workspace)/aiva/workers/[id]/aiva-detail-tabs.ts
export type AivaTab = {
  id: string;
  label: string;
};

export const AIVA_CORE_TABS: AivaTab[] = [
  { id: 'overview',     label: 'Overview'     },
  { id: 'channels',     label: 'Channels'     },
  { id: 'automations',  label: 'Automations'  },
  { id: 'settings',     label: 'Settings'     },
  // Prompt 20 appends: { id: 'conversations', label: 'Conversations' }
  // Prompt 20 appends: { id: 'analytics',     label: 'Analytics'     }
  // Prompt 28 appends: { id: 'training',      label: 'Training'      }
];
```

Tab bar HTML pattern (match the exact pattern in `BillingClient.tsx` - copy the border-bottom
underline style, do not invent a new one):

```tsx
<div className="border-b border-border mb-6">
  <nav className="flex gap-1 -mb-px" role="tablist">
    {tabs.map((tab) => (
      <button
        key={tab.id}
        role="tab"
        aria-selected={activeTab === tab.id}
        onClick={() => setActiveTab(tab.id)}
        className={cn(
          'px-3 py-2 text-sm transition-colors border-b-2',
          activeTab === tab.id
            ? 'border-accent text-text-primary font-medium'
            : 'border-transparent text-text-secondary hover:text-text-primary',
        )}
      >
        {tab.label}
      </button>
    ))}
  </nav>
</div>
```

**How prompts 20 and 28 extend the tab bar:**
They import `AIVA_CORE_TABS` and their own tab definition, then pass the merged array to
`AivaDetailClient`. The `AivaDetailClient` accepts a `tabs` prop and a `renderTab(id)` prop
(render function that switches on tab id). This keeps the tab bar driven by a single source
of truth. Document this pattern in a comment in `aiva-detail-tabs.ts`.

---

## Step 7: Overview tab

Data to fetch for this tab (server-side, passed as props to the client):
- `worker.messagesToday` and `worker.totalMessages` and `worker.escalationRate` and `worker.automationsRan`
  - Source: `GET /api/aiva/workers/[id]` response (core backend returns these in the detail object)
- `usageBar`: `{ count, limit, resetsAt }` from `GET /api/aiva/billing/status`
  - Only render usage bar if `subscription` exists on the worker response
- `recentConversations`: first 5 from `GET /api/aiva/workers/[id]/conversations?limit=5`
- `recentActivity`: first 10 from `GET /api/aiva/workers/[id]/activity?limit=10`

**Quick stats row (4 cards):**

```tsx
const stats = [
  { label: 'Today',        value: worker.messagesToday },
  { label: 'Total',        value: worker.totalMessages },
  { label: 'Escalation',   value: `${(worker.escalationRate * 100).toFixed(1)}%` },
  { label: 'Automations',  value: worker.automationsRan },
];

<div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
  {stats.map((s) => (
    <div key={s.label} className="rounded-lg border border-border bg-elevated p-4">
      <p className="text-2xl font-semibold text-text-primary">{s.value}</p>
      <p className="text-xs text-text-muted mt-0.5">{s.label}</p>
    </div>
  ))}
</div>
```

**Usage bar** (only render if `usageBar` prop is present):

```tsx
<div className="rounded-lg border border-border bg-elevated p-4">
  <div className="flex justify-between text-xs text-text-muted mb-2">
    <span>Messages this month</span>
    <span>{usageBar.count.toLocaleString()} / {usageBar.limit.toLocaleString()}</span>
  </div>
  <div className="h-1.5 rounded-full bg-overlay overflow-hidden">
    <div
      className={cn(
        'h-full rounded-full transition-all',
        pct < 60  ? 'bg-green-400' :
        pct < 85  ? 'bg-amber-400' : 'bg-red-400',
      )}
      style={{ width: `${Math.min(pct, 100)}%` }}
    />
  </div>
  <p className="text-[11px] text-text-muted mt-1.5">
    Resets {formatDate(usageBar.resetsAt)}
  </p>
</div>
```

where `pct = Math.round((usageBar.count / usageBar.limit) * 100)`.

**Last 5 conversations:**

```tsx
<div>
  <h3 className="text-sm font-medium text-text-primary mb-3">Last 5 conversations</h3>
  {recentConversations.length === 0
    ? <p className="text-xs text-text-muted">No conversations yet.</p>
    : (
      <div className="divide-y divide-border rounded-lg border border-border overflow-hidden">
        {recentConversations.map((conv) => (
          <Link
            key={conv.contactId}
            href={`/aiva/conversations?worker=${worker.id}&contact=${conv.contactId}`}
            className="flex items-center gap-3 px-4 py-2.5 hover:bg-elevated transition-colors"
          >
            <ChannelIcon channel={conv.channel} className="h-3.5 w-3.5 text-text-muted shrink-0" />
            <span className="text-xs text-text-secondary truncate flex-1">
              {maskIdentifier(conv.contactId, conv.channel)}
            </span>
            <span className="text-[11px] text-text-muted truncate max-w-[160px] hidden sm:block">
              {conv.lastMessagePreview.slice(0, 40)}...
            </span>
            <span className="text-[11px] text-text-muted shrink-0">
              {timeAgo(conv.lastMessageAt)}
            </span>
          </Link>
        ))}
      </div>
    )
  }
  <Link
    href={`/aiva/conversations?worker=${worker.id}`}
    className="mt-2 text-xs text-accent hover:underline block"
  >
    View all conversations
  </Link>
</div>
```

`maskIdentifier(id, channel)`:
- phone: keep first 3 and last 3 digits, mask middle with `*`: `+44 7** *** 456`
- email: keep first 2 chars before `@`, mask rest: `jo***@example.com`
- slack/telegram: show as-is (team name or username, not personally identifying)

**Recent activity (last 10):**

```tsx
<div>
  <h3 className="text-sm font-medium text-text-primary mb-3">Recent activity</h3>
  <div className="space-y-1">
    {recentActivity.map((item) => (
      <div key={item.id} className="flex items-center gap-3 py-1">
        <span className="text-[11px] text-text-muted w-20 shrink-0">
          {timeAgo(item.createdAt)}
        </span>
        <ActionBadge type={item.actionType} />
        <span className="text-xs text-text-secondary truncate">
          {item.summary}
        </span>
      </div>
    ))}
  </div>
</div>
```

`ActionBadge` maps `actionType` to a colored pill:
```typescript
const ACTION_BADGE_STYLES: Record<string, string> = {
  message_sent:   'bg-blue-500/10 text-blue-400',
  message_received: 'bg-gray-500/10 text-gray-400',
  escalated:      'bg-amber-500/10 text-amber-400',
  automation_ran: 'bg-purple-500/10 text-purple-400',
  tool_called:    'bg-emerald-500/10 text-emerald-400',
};
```

---

## Step 8: Channels tab

Fetch from `GET /api/aiva/workers/[id]/channels` (returns connected and available channels).

**Grid of channel cards** (`grid grid-cols-1 sm:grid-cols-2 gap-3`):

**Connected channel card:**
```tsx
<div className="rounded-lg border border-accent/30 bg-elevated p-4">
  <div className="flex items-center justify-between mb-3">
    <div className="flex items-center gap-2">
      <ChannelIcon channel={ch.type} className="h-5 w-5" />
      <span className="text-sm font-medium text-text-primary">{ch.label}</span>
    </div>
    <ChannelToggle channelId={ch.id} active={ch.active} workerId={worker.id} />
  </div>
  <p className="text-xs text-text-muted mb-1">{maskIdentifier(ch.identifier, ch.type)}</p>
  <p className="text-xs text-text-muted mb-3">{ch.messageCount.toLocaleString()} messages</p>
  <button
    type="button"
    onClick={() => disconnect(ch.id)}
    className="text-xs text-danger hover:underline"
  >
    Disconnect
  </button>
</div>
```

**Not-connected channel card:**
```tsx
<div className="rounded-lg border border-dashed border-border p-4 opacity-60 hover:opacity-100 transition-opacity">
  <div className="flex items-center gap-2 mb-3">
    <ChannelIcon channel={ch.type} className="h-5 w-5 text-text-muted" />
    <span className="text-sm font-medium text-text-secondary">{ch.label}</span>
  </div>
  <p className="text-xs text-text-muted mb-3">Not connected</p>
  <Link
    href={`/settings/channels/${ch.type}?worker=${worker.id}`}
    className="text-xs text-accent hover:underline"
  >
    Connect
  </Link>
</div>
```

`ChannelToggle` pauses message processing on that channel without disconnecting.
Calls `PATCH /api/aiva/workers/[id]/channels/[channelId]` with `{ active: boolean }`.
Uses optimistic update.

`disconnect(channelId)` calls `DELETE /api/aiva/workers/[id]/channels/[channelId]`.
Requires a `window.confirm` before calling.

---

## Step 9: Automations tab

**List view:**

```tsx
<div className="flex items-center justify-between mb-4">
  <h3 className="text-sm font-medium text-text-primary">Automations</h3>
  <button type="button" onClick={() => setModalOpen(true)}
          className="btn-ghost text-xs flex items-center gap-1.5">
    <Plus className="h-3.5 w-3.5" /> New automation
  </button>
</div>
```

**Empty state:**
```tsx
<div className="text-center py-12">
  <Clock className="h-8 w-8 text-text-muted mx-auto mb-3" />
  <p className="text-sm font-medium text-text-primary">No automations yet</p>
  <p className="text-xs text-text-muted mt-1 max-w-xs mx-auto">
    Add one to have your Aiva run recurring tasks on a schedule, without you lifting a finger.
  </p>
</div>
```

**Automation row:**
```tsx
<div className="flex items-center gap-4 rounded-lg border border-border px-4 py-3">
  <div className="flex-1 min-w-0">
    <p className="text-sm font-medium text-text-primary">{auto.name}</p>
    <span className="inline-flex mt-1 text-[11px] px-1.5 py-0.5 rounded
                     bg-accent-dim text-accent">
      {auto.scheduleLabel}
    </span>
  </div>
  <div className="text-xs text-text-muted whitespace-nowrap">
    {auto.lastRanAt ? `Last ran ${timeAgo(auto.lastRanAt)}` : 'Never ran'}
  </div>
  <EnabledToggle automationId={auto.id} workerId={worker.id} enabled={auto.enabled} />
  <button type="button" onClick={() => deleteAutomation(auto.id)}
          className="text-text-muted hover:text-danger transition-colors">
    <Trash2 className="h-3.5 w-3.5" />
  </button>
</div>
```

**New automation modal:**

`<dialog>` element or a fixed overlay div. Two required fields and one required field:

```
[Label] Name
[Input] placeholder: "e.g. Morning inbox briefing, Weekly invoice sweep"

[Label] What should it do?
[Textarea, 4 rows]
placeholder: "Describe the recurring process in plain English. Include what to do,
in what order, and what the output should be. Example: Every Friday at 5pm, check
all completed jobs from this week, issue invoices to each client, and flag any
invoices that are still unpaid from last week."

[Label] When should it run?
[Input] placeholder: "e.g. Every Monday at 9am, Daily at 8am, Every Friday at 5pm"
[p, muted, 11px] Your Aiva converts this into a schedule automatically.

[Cancel] [Create automation]
```

On submit: `POST /api/aiva/workers/[id]/automations`. On success: close modal, show a
brief success state on the button ("Automation created"), refetch the automation list.

`EnabledToggle` calls `PATCH /api/aiva/workers/[id]/automations/[automationId]`
with `{ enabled: boolean }`.

`deleteAutomation(id)` calls `DELETE /api/aiva/workers/[id]/automations/[automationId]`.
Requires `window.confirm` first.

---

## Step 10: Settings tab

Two sections separated by a `<div className="border-t border-border my-8" />`.

**Section 1: Edit**

```tsx
<h3 className="text-sm font-medium text-text-primary mb-4">Edit</h3>
<form onSubmit={handleSave} className="space-y-4 max-w-lg">
  <Field label="Aiva name">
    <input name="roleName" defaultValue={worker.name} required />
  </Field>
  <Field label="Role description">
    <textarea name="roleDescription" rows={5} defaultValue={worker.roleDescription} required />
  </Field>
  <Field label="Language">
    <select name="language" defaultValue={worker.language ?? 'en-GB'}>
      <option value="en-GB">English (UK)</option>
      <option value="en-US">English (US)</option>
      <option value="fr">French</option>
      <option value="es">Spanish</option>
      <option value="ar">Arabic</option>
    </select>
  </Field>
  <button type="submit" className="btn-primary">
    {saving ? 'Saving...' : 'Save changes'}
  </button>
</form>
```

Calls `PATCH /api/aiva/workers/[id]` with the form body. Show a success message inline below
the button on save: `"Changes saved"` in `text-xs text-green-400`, fades after 3 seconds.

**Section 2: Audit**

```tsx
<div>
  <h3 className="text-sm font-medium text-text-primary mb-1">Activity audit</h3>
  <p className="text-xs text-text-muted mb-4">
    Every action is hashed and attested on-chain. The hash covers the action type, timestamp,
    and a content fingerprint. No raw message content is stored on-chain.
  </p>
  <div className="overflow-x-auto">
    <table className="w-full text-xs">
      <thead>
        <tr className="border-b border-border text-text-muted">
          <th className="text-left py-2 pr-4 font-medium">Time</th>
          <th className="text-left py-2 pr-4 font-medium">Action</th>
          <th className="text-left py-2 pr-4 font-medium hidden md:table-cell">Input</th>
          <th className="text-left py-2 pr-4 font-medium hidden md:table-cell">Output</th>
          <th className="text-left py-2 font-medium">Verified</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        {auditRows.map((row) => (
          <tr key={row.id}>
            <td className="py-2 pr-4 text-text-muted whitespace-nowrap">
              {formatTimestamp(row.createdAt)}
            </td>
            <td className="py-2 pr-4">
              <ActionBadge type={row.actionType} />
            </td>
            <td className="py-2 pr-4 text-text-muted max-w-[180px] truncate hidden md:table-cell">
              {row.inputSummary?.slice(0, 80) ?? '-'}
            </td>
            <td className="py-2 pr-4 text-text-muted max-w-[180px] truncate hidden md:table-cell">
              {row.outputSummary?.slice(0, 80) ?? '-'}
            </td>
            <td className="py-2">
              {row.attestationTx
                ? (
                  <a
                    href={`${process.env.NEXT_PUBLIC_CHAIN_EXPLORER_URL ?? 'https://etherscan.io/tx'}/${row.attestationTx}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-green-400 hover:underline"
                  >
                    On-chain
                  </a>
                )
                : <span className="text-text-muted">Pending</span>
              }
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
</div>
```

Paginate at 50 rows. Add a "Load more" button below the table if `auditRows.length === 50`.

**Section 3: Danger zone**

```tsx
<div>
  <h3 className="text-sm font-medium text-danger mb-3">Danger zone</h3>
  <div className="rounded-lg border border-danger/20 p-4">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-text-primary">Dismiss this Aiva</p>
        <p className="text-xs text-text-muted mt-0.5">
          Permanently deactivates this Aiva. Cannot be undone.
        </p>
      </div>
      <button
        type="button"
        onClick={() => setDismissModalOpen(true)}
        className="text-xs border border-danger/40 text-danger rounded-md px-3 py-1.5
                   hover:bg-danger/10 transition-colors"
      >
        Dismiss Aiva
      </button>
    </div>
  </div>
</div>
```

**Dismiss modal:**
```
[heading] Dismiss {worker.name}?

[p] This permanently deactivates the Aiva and stops all message processing.
    Any pending automations will be cancelled.
    This cannot be undone.

[Label] Type the Aiva's name to confirm:
[Input] value must match worker.name exactly (case-insensitive)

[Cancel]  [Dismiss Aiva] (danger style, disabled until name matches)
```

On confirm: `DELETE /api/aiva/workers/[id]`. On success: `router.push('/aiva/workers')`.

---

## Step 11: Next.js API proxy routes

All routes require `requireWorkspace` from `@/lib/session`. All proxy to `resolveCoreUrl()`.
Use `Authorization: Bearer ${process.env.CARINA_OPS_TOKEN}` header when `CARINA_OPS_TOKEN` is set.
Return `{ error: string }` with the appropriate HTTP status on failure.

Create these files:

```
src/app/api/aiva/workers/route.ts
  GET   list Aivas for current workspace
  POST  create a new Aiva (hire flow)

src/app/api/aiva/workers/[id]/route.ts
  GET    fetch Aiva detail (includes messagesToday, totalMessages, escalationRate, automationsRan)
  PATCH  update name, roleDescription, language, or status
  DELETE deactivate Aiva

src/app/api/aiva/workers/[id]/activity/route.ts
  GET  paginated activity feed (limit, offset params)

src/app/api/aiva/workers/[id]/audit/route.ts
  GET  audit log rows with attestation_tx (limit, offset params)

src/app/api/aiva/workers/[id]/conversations/route.ts
  GET  first N conversations grouped by (channel, contactId) for the overview tab

src/app/api/aiva/workers/[id]/channels/route.ts
  GET  all channels (connected and available) for this worker

src/app/api/aiva/workers/[id]/channels/[channelId]/route.ts
  PATCH  toggle active
  DELETE disconnect

src/app/api/aiva/workers/[id]/automations/route.ts
  GET   list automations
  POST  create automation (plain-English schedule; core backend parses to cron)

src/app/api/aiva/workers/[id]/automations/[automationId]/route.ts
  PATCH  toggle enabled
  DELETE remove automation

src/app/api/aiva/billing/status/route.ts
  GET  usage bar data: { count, limit, resetsAt }
       proxy to CARINA_CORE_URL/api/aiva/billing/status
```

The `analytics` proxy route is created by prompt 20.

---

## Done When

**Sidebar:**
- [ ] `workspace-nav.ts` has `aiva` group with two routes (`/aiva/workers`, `/aiva`)
- [ ] `Bot` icon added to `NAV_ICON_MAP` in `AppSidebar.tsx`
- [ ] "AIVA" section appears in sidebar between intelligence and account groups
- [ ] Active Aiva route highlights correctly in the sidebar

**Entry page `/aiva`:**
- [ ] Two-column layout on desktop, stacked on mobile
- [ ] "Meet your Aiva" button text; loading state interpolates the typed name
- [ ] Inline error below button on submit failure (no toast)
- [ ] At least one channel required; client-side validation prevents submit if none checked
- [ ] Six role template cards render with example Q and A
- [ ] Clicking a template fills both form fields; editing either field clears selected state
- [ ] Custom role card clears fields
- [ ] On success, redirects to `/aiva/workers/[id]`

**Roster page `/aiva/workers`:**
- [ ] Empty state with Bot icon and "Hire an Aiva" button
- [ ] Responsive grid: 1 / 2 / 3 columns
- [ ] Avatar initial color derived deterministically from Aiva name
- [ ] Status chip shows correct dot color and text for all 5 states
- [ ] Channel icons row renders for connected channels
- [ ] Pause/Resume button does optimistic update; no navigation
- [ ] "Manage" link goes to `/aiva/workers/[id]`

**Detail page header:**
- [ ] Avatar, name, role, status chip, channel count all render
- [ ] Pause/Resume shows confirm before pausing; no confirm before resuming
- [ ] "Scout ->" opens in new tab; uses `NEXT_PUBLIC_SCOUT_FLEET_URL` with fallback

**Tab bar:**
- [ ] Four tabs render: Overview, Channels, Automations, Settings
- [ ] Active tab shows accent border-bottom; matches `BillingClient.tsx` pattern exactly
- [ ] `aiva-detail-tabs.ts` exported with comment explaining extension pattern for prompts 20 and 28

**Overview tab:**
- [ ] Four stat cards render with correct values
- [ ] Usage bar only renders when subscription data is present
- [ ] Usage bar color changes at 60% (amber) and 85% (red)
- [ ] Last 5 conversations list renders; contact identifiers are masked
- [ ] "View all conversations" link present
- [ ] Recent activity list renders with action badges

**Channels tab:**
- [ ] Connected channels have accent border; not-connected have dashed border and reduced opacity
- [ ] Toggle switch pauses/resumes a channel; optimistic update
- [ ] Disconnect requires `window.confirm`
- [ ] Identifiers are masked

**Automations tab:**
- [ ] Empty state renders
- [ ] Automation rows show name, schedule badge, last ran, enabled toggle, delete
- [ ] "New automation" modal opens with 3 fields
- [ ] On create success, modal closes, list refreshes
- [ ] Enable toggle calls PATCH; delete calls DELETE with confirm

**Settings tab:**
- [ ] Edit form pre-fills current values; save calls PATCH
- [ ] "Changes saved" inline success message fades after 3 seconds
- [ ] Audit table renders with truncated input/output columns; "On-chain" link or "Pending"
- [ ] Audit table hidden columns appear on md breakpoint
- [ ] "Load more" appears when 50 rows returned
- [ ] Dismiss Aiva button opens modal; confirm input must match name; calls DELETE; redirects on success

**API routes:**
- [ ] All 10 proxy routes exist and validate workspace session
- [ ] All return `{ error: string }` on failure with correct HTTP status

**General:**
- [ ] `npx tsc --noEmit --skipLibCheck` passes for all new files
- [ ] All pages are usable on a 375px viewport
- [ ] No em dashes in any copy or JSX strings
- [ ] No emojis
