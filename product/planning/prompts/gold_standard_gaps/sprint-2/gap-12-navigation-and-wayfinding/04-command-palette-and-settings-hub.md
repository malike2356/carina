# Gap 12 - Prompt 04: Command Palette Full Nav and Settings Sub-page Links

**Gap:** 12 Navigation and Wayfinding
**Prompt number:** 04 of 04
**Name:** Command Palette Full Nav and Settings Sub-page Links
**Primary agent:** Claude Code
**Estimated hours:** 2-3 h
**Depends on:** Prompt 01 (NAV_ROUTES, NAV_GROUPS)

---

## Read First

Before writing a single line, read:

1. `app.carinaai.uk/src/components/shell/CommandPalette.tsx` - THE FULL FILE. Understand the
   `staticActions` list, the `ActionItem` type, result grouping, and the keyboard navigation.
2. `app.carinaai.uk/src/lib/workspace-nav.ts` - `NAV_ROUTES`, `NAV_GROUPS`
3. `app.carinaai.uk/src/hooks/useTerminalAccess.ts` - `canUseTerminal`
4. `app.carinaai.uk/src/app/(workspace)/settings/page.tsx` - the settings page structure,
   specifically how navItems and SETTINGS_SECTION_LINKS are rendered (to know what links to
   settings sub-sections already exist)
5. `app.carinaai.uk/src/components/settings/SettingsToolLinks.tsx` - how tool links render

All paths are relative to `/opt/lampp/htdocs/verlox/carina/external/client-apps/`.

---

## Context

Two problems remain after Prompts 01-03:

**Problem A: Command palette is incomplete.**
The current `staticActions` list has ~10 hardcoded items. It misses: `/library`, `/profiles`,
`/security`, `/scheduled`, `/webhooks`, `/email`, `/logs`, `/env`, `/research`,
`/tasks`, `/calendar`, `/files`, and the settings sub-pages. A user who does not know a
feature exists cannot find it unless it appears in the palette.

After this prompt, every route in `NAV_ROUTES` is findable via the command palette. The
palette becomes a complete navigation tool, not a shortcut to 10 popular destinations.

**Problem B: Settings sub-pages lack context.**
`/settings/keys`, `/settings/calendar`, and `/settings/pairing` are reached from the Settings
page but have no way back except the browser back button. Prompt 02 adds a PageHeader with
`backHref="/settings"` to each. This prompt adds deep links FROM the settings page sections
TO those sub-pages so they are easier to discover in the first place.

---

## Step 1: Derive staticActions from NAV_ROUTES

In `CommandPalette.tsx`, replace the entire `staticActions` array with a version derived from
`NAV_ROUTES`. This ensures the palette always reflects the current route inventory without
manual maintenance.

```tsx
// Add imports at the top of CommandPalette.tsx:
import { NAV_ROUTES, NAV_GROUPS } from '@/lib/workspace-nav';
```

Replace the hardcoded `staticActions` useMemo:

```tsx
const staticActions: ActionItem[] = useMemo(() => {
  // Start with non-navigation actions that have no equivalent route
  const nonNavActions: ActionItem[] = [
    {
      type: 'action',
      id: 'new-chat',
      label: 'New chat',
      group: 'Chat',
      shortcut: 'Ctrl+Alt+N',
      icon: <Plus className="h-4 w-4" />,
      action: async () => {
        close();
        const response = await fetch('/api/sessions', { method: 'POST' });
        const data = await response.json();
        if (data.data?.id) router.push(`/chat/${data.data.id}`);
      },
    },
    {
      type: 'action',
      id: 'memory-panel',
      label: 'Open memory panel',
      group: 'Intelligence',
      icon: <Brain className="h-4 w-4" />,
      action: () => {
        close();
        document.dispatchEvent(new CustomEvent('open-panel', { detail: 'memory' }));
      },
    },
    {
      type: 'action',
      id: 'skills-panel',
      label: 'Open skills panel',
      group: 'Intelligence',
      icon: <Sparkles className="h-4 w-4" />,
      action: () => {
        close();
        document.dispatchEvent(new CustomEvent('open-panel', { detail: 'skills' }));
      },
    },
    {
      type: 'action',
      id: 'notes-panel',
      label: 'Open notes panel',
      group: 'Intelligence',
      icon: <StickyNote className="h-4 w-4" />,
      action: () => {
        close();
        document.dispatchEvent(new CustomEvent('open-panel', { detail: 'notes' }));
      },
    },
  ];

  // Build nav actions from NAV_ROUTES.
  // Exclude settings sub-pages from the top-level list to reduce clutter - they appear
  // as separate items labeled "Settings / API Keys" etc.
  const navActions: ActionItem[] = NAV_ROUTES
    .filter((route) => {
      if (route.terminalGated && !canUseTerminal) return false;
      return true;
    })
    .map((route): ActionItem => {
      // Determine display label: sub-pages get "Parent / Page" format
      const label = route.parent
        ? `${NAV_ROUTES.find((r) => r.href === route.parent)?.label ?? 'Settings'} / ${route.label}`
        : route.label;

      // Determine group label from NAV_GROUPS
      const groupDef = NAV_GROUPS.find((g) => g.id === route.group);
      const group = groupDef?.label ?? route.group;

      return {
        type: 'action',
        id: `nav-${route.href}`,
        label,
        group,
        icon: <NavIcon name={route.iconName} />,
        action: () => {
          close();
          router.push(route.href);
        },
      };
    });

  return [...nonNavActions, ...navActions];
}, [canUseTerminal, close, router]);
```

Note: `ActionItem` needs a `group` field added. Add it to the type:

```tsx
type ActionItem = {
  type: 'action';
  id: string;
  label: string;
  group?: string;          // NEW: for grouped display
  shortcut?: string;
  icon: React.ReactNode;
  action: () => void;
};
```

Add `NavIcon` component inline in CommandPalette.tsx (the same pattern as the sidebar):

```tsx
// Import map for palette icons (a subset of the full map - add more as needed)
import {
  BarChart3, BookOpen, Brain, CalendarClock, CalendarDays, CheckSquare,
  Clock, CreditCard, Database, FileText, FolderOpen, Key, LayoutDashboard,
  Mail, Plus, ScrollText, Search, Server, Settings, Shield, Smartphone,
  Sparkles, StickyNote, Terminal, UserCircle, Webhook, Wrench,
} from 'lucide-react';

const PALETTE_ICON_MAP: Record<string, React.ElementType> = {
  BarChart3, BookOpen, Brain, CalendarClock, CalendarDays, CheckSquare, Clock,
  CreditCard, Database, FileText, FolderOpen, Key, LayoutDashboard, Mail,
  ScrollText, Server, Settings, Shield, Smartphone, Sparkles, StickyNote,
  Terminal, UserCircle, Webhook, Wrench,
};

function NavIcon({ name }: { name: string }) {
  const Icon = PALETTE_ICON_MAP[name];
  if (!Icon) return <Search className="h-4 w-4" />;
  return <Icon className="h-4 w-4" />;
}
```

---

## Step 2: Render Actions in Groups

Currently the palette renders all static actions under a single "Actions" heading. After this
change there are 20+ static actions across 4 groups. Group them by the `group` field.

In the `{query.length < 2 && staticActions.length > 0 && ...}` render block, replace the flat
list with a grouped render:

```tsx
{query.length < 2 && staticActions.length > 0 && (
  <div>
    {(() => {
      // Build groups in order: Chat, Workspace, Intelligence, Tools, Account
      const groupOrder = ['Chat', 'Workspace', 'Intelligence', 'Tools', 'Account'];
      const grouped: Record<string, ActionItem[]> = {};
      let flatIndex = 0;
      const indexMap: Record<string, number> = {};

      for (const item of staticActions) {
        const g = item.group ?? 'Other';
        if (!grouped[g]) grouped[g] = [];
        grouped[g].push(item);
        indexMap[item.id] = flatIndex++;
      }

      return groupOrder
        .filter((g) => grouped[g]?.length)
        .map((groupLabel) => (
          <div key={groupLabel}>
            <p className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
              {groupLabel}
            </p>
            {(grouped[groupLabel] ?? []).map((item) => {
              const itemIndex = indexMap[item.id] ?? 0;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => navigate(item)}
                  className={cn(
                    'flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors',
                    cursor === itemIndex
                      ? 'bg-elevated text-text-primary'
                      : 'text-text-secondary hover:bg-elevated',
                  )}
                >
                  <span className="text-text-muted">{item.icon}</span>
                  {item.label}
                  {item.shortcut && (
                    <span className="ml-auto text-[10px] text-text-muted">{item.shortcut}</span>
                  )}
                </button>
              );
            })}
          </div>
        ));
    })()}
  </div>
)}
```

When the user has typed a query (query.length >= 2), the palette shows session and message
results. For query searches, also search the static actions by label and show matching actions
at the top of results. Add action search to the existing search flow:

```tsx
// After the current fetch results are set, also filter staticActions:
const matchingActions = staticActions.filter((a) =>
  a.label.toLowerCase().includes(query.toLowerCase()),
);

// In allItems construction:
const allItems: ResultItem[] = [
  ...(query.length >= 2 ? matchingActions : staticActions),
  ...results.sessions.map(...),
  ...results.messages.map(...),
];
```

---

## Step 3: Settings Page - Add Sub-page Navigation Links

The Settings page has sections: Join, Appearance, Chat, Brain, Shortcuts, Account, Notifications,
Security. Within some of these sections, sub-pages exist (`/settings/keys`, `/settings/pairing`,
`/settings/calendar`).

These sub-pages are currently reachable only via:
1. The "Manage" link in the Chat section for API keys
2. `SettingsToolLinks` in the Join section for pairing and calendar

The problem: a user on the "Chat" tab sees a small "Manage" link for API keys. On the "Join"
tab they see links for pairing and calendar. These are not prominent and require knowing which
tab to look in.

Add a dedicated "Connected and extended" summary section at the top of the Settings page
(above the tabs) that shows quick links to all settings sub-pages:

In `settings/page.tsx`, above the `<aside>` / `<main>` split, add (before `return`):

Actually, the settings page already has the tab nav `<aside>` on the left. Do not add a new
section there. Instead:

1. On the "Join" tab section, the existing `SettingsToolLinks` already renders device pairing
   and calendar sync links. Verify these render correctly and are easy to find. If the links
   are not prominent, increase the visual weight of the `SettingsToolLinks` items.

2. On the "Chat" tab section, the "API keys" card already has a "Manage" link. Keep this.

3. Add a `ChevronRight` icon + description to the existing settings sub-page cards so they
   read like navigation links, not just labels. This is a cosmetic tweak to `SettingsToolLinks.tsx`.

Read `src/components/settings/SettingsToolLinks.tsx` in full. If the component already renders
items as clear clickable links with arrows, no change is needed. If it renders them as plain text,
make each item clearly look like a navigation link (an arrow or a right chevron).

---

## Step 4: Add Navigation Keyboard Shortcuts (Optional but Recommended)

Add two useful navigation shortcuts to `GlobalShortcuts.tsx` (or wherever keyboard shortcuts
are registered - check `src/lib/shortcuts.ts`):

- `Ctrl+,` (comma) - open settings
- `Ctrl+Shift+B` - toggle sidebar

Read `src/components/shell/GlobalShortcuts.tsx` and `src/lib/shortcuts.ts` to understand how
shortcuts are registered. Add these shortcuts using the same pattern. Only add shortcuts that
are not already taken.

If `Ctrl+,` conflicts with any existing shortcut, use `Ctrl+Shift+,` instead.

---

## Verification

```bash
npx tsc --noEmit 2>&1 | grep error | head -10
npm run build 2>&1 | tail -10
```

Manual test:
1. Open the command palette (Ctrl+K). The actions are grouped under Chat, Workspace,
   Intelligence, Tools, Account headings.
2. Count the Workspace group items: should include Dashboard, Documents, Calendar, Tasks,
   Research, Files, Email, Cron jobs, Scheduled.
3. Type "cron" in the palette. "Cron jobs" appears immediately in the results.
4. Type "mcp" in the palette. "MCP servers" appears.
5. Type "key" in the palette. "Settings / API keys" appears.
6. Type "analytics" in the palette. "Analytics" appears and pressing Enter navigates there.
7. On the Settings page, the Join tab shows device pairing and calendar sync as clear links.
8. Navigate to Settings > Join > Device pairing. The page has a "Back to Settings" link
   (added by Prompt 02). The breadcrumb reads "Settings / Device pairing".
9. Press Ctrl+, (if implemented). The Settings page opens.
10. Every route in NAV_ROUTES is reachable from the command palette in 2-3 keystrokes.
