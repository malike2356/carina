# Gap 12 - Prompt 03: Sidebar Nav Groups Redesign

**Gap:** 12 Navigation and Wayfinding
**Prompt number:** 03 of 04
**Name:** Sidebar Nav Groups Redesign
**Primary agent:** Claude Code
**Estimated hours:** 4-6 h
**Depends on:** Prompt 01 (NAV_ROUTES, NAV_GROUPS, NAV_PANELS, getActiveGroup, getActiveRoute)

---

## Read First

Before writing a single line, read:

1. `app.carinaai.uk/src/components/shell/AppSidebar.tsx` - THE FULL FILE. Understand every
   component: `AppSidebar`, `CollapsedToolIcon`, `SidebarToolRow`, `SessionList`,
   `SessionGroup`, `SessionItem`. You are redesigning this file.
2. `app.carinaai.uk/src/lib/workspace-nav.ts` - `NAV_ROUTES`, `NAV_GROUPS`, `NAV_PANELS`,
   `getActiveGroup`, `getActiveRoute`, `NavGroupId`
3. `app.carinaai.uk/src/app/globals.css` - CSS variables for theming. Pay attention to:
   `--bg-surface`, `--bg-elevated`, `--bg-overlay`, `--border-subtle`, `--text-primary`,
   `--text-secondary`, `--text-muted`, `--accent`, `--accent-dim`
4. `app.carinaai.uk/src/hooks/useTerminalAccess.ts` - for gating terminal routes
5. `app.carinaai.uk/src/hooks/useAppearance.ts` - for `sidebarCollapsed` preference

All paths are relative to `/opt/lampp/htdocs/verlox/carina/external/client-apps/`.

---

## Context

The current sidebar has:
- A logo/brand link at the top
- New chat + search buttons
- A scrollable session list (the majority of the sidebar)
- A tiny "Tools" footer with 7 links and a "More" link to settings

This is the reason 16 routes are invisible. The "Tools" footer does not have room for all
routes, and the "More" link delegates navigation discovery to the Settings page.

The new sidebar has:
- Same brand link and new-chat + search buttons (unchanged)
- Same scrollable session list (unchanged, slightly shorter to make room)
- Collapsible nav group sections: one for each of the 4 groups (Workspace, Intelligence,
  Tools, Account)
- Each group shows its routes with icons and labels, with active state highlighting
- The active route is always highlighted regardless of which group it is in

The key design constraint: the sidebar is 224px wide (w-56) when expanded. Nav group items
must use the same compact row height as the existing session items (py-1.5, text-xs). Groups
are collapsible so the user can collapse groups they use rarely to free vertical space.

---

## Step 1: Icon Map

At the top of `AppSidebar.tsx`, create a map from `iconName` string (from workspace-nav.ts)
to the actual Lucide icon component. This is the only place in the codebase that imports icon
components for navigation. All other files use the string name.

```tsx
import {
  BarChart3, BookOpen, Brain, CalendarClock, CalendarDays, CheckSquare, ChevronDown,
  ChevronLeft, ChevronRight, Clock, CreditCard, Database, FileText, FolderOpen,
  Key, LayoutDashboard, LayoutGrid, Mail, MessageSquare, MoreHorizontal, Plus,
  ScrollText, Search, SearchIcon, Server, Settings, Shield, Smartphone, Sparkles,
  StickyNote, Terminal, Trash2, Archive, User, UserCircle, Webhook, Wrench,
} from 'lucide-react';

const NAV_ICON_MAP: Record<string, React.ElementType> = {
  BarChart3, BookOpen, Brain, CalendarClock, CalendarDays, CheckSquare, Clock,
  CreditCard, Database, FileText, FolderOpen, Key, LayoutDashboard, LayoutGrid,
  Mail, MessageSquare, ScrollText, Search, Server, Settings, Shield, Smartphone,
  Sparkles, StickyNote, Terminal, UserCircle, Webhook, Wrench, User,
};

function NavIcon({ name, className }: { name: string; className?: string }) {
  const Icon = NAV_ICON_MAP[name];
  if (!Icon) return null;
  return <Icon className={className ?? 'h-3.5 w-3.5'} />;
}
```

---

## Step 2: Nav Group State

Add a state variable that tracks which groups are open or collapsed. Default: all groups open.
Use localStorage to persist the user's preference across reloads.

```tsx
const [openGroups, setOpenGroups] = useState<Record<NavGroupId, boolean>>(() => {
  try {
    const stored = localStorage.getItem('carina.nav-groups');
    if (stored) return JSON.parse(stored) as Record<NavGroupId, boolean>;
  } catch {}
  return { workspace: true, intelligence: true, tools: false, account: false };
});

function toggleGroup(groupId: NavGroupId) {
  setOpenGroups((current) => {
    const next = { ...current, [groupId]: !current[groupId] };
    try { localStorage.setItem('carina.nav-groups', JSON.stringify(next)); } catch {}
    return next;
  });
}
```

Default: Workspace and Intelligence open, Tools and Account collapsed. This keeps the sidebar
short by default while showing the most frequently used sections.

---

## Step 3: NavGroupSection Component

Add a new internal component `NavGroupSection` to `AppSidebar.tsx`:

```tsx
function NavGroupSection({
  group,
  routes,
  panels,
  isOpen,
  onToggle,
  pathname,
  canUseTerminal,
}: {
  group: NavGroup;
  routes: NavRoute[];
  panels: NavPanel[];
  isOpen: boolean;
  onToggle: () => void;
  pathname: string;
  canUseTerminal: boolean;
}) {
  const visibleRoutes = routes.filter(
    (r) => !r.terminalGated || canUseTerminal,
  );

  // Determine if this group contains the active route
  const groupIsActive = visibleRoutes.some(
    (r) => pathname === r.href || pathname.startsWith(r.href + '/'),
  );

  return (
    <div className="mb-1">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-text-muted transition-colors hover:text-text-secondary"
      >
        <span className={groupIsActive ? 'text-accent' : ''}>{group.label}</span>
        <ChevronDown
          className={cn(
            'h-3 w-3 transition-transform',
            isOpen ? '' : '-rotate-90',
          )}
        />
      </button>

      {isOpen && (
        <div>
          {visibleRoutes.map((route) => (
            <NavRouteRow key={route.href} route={route} pathname={pathname} />
          ))}
          {panels.map((panel) => (
            <NavPanelRow key={panel.id} panel={panel} />
          ))}
        </div>
      )}
    </div>
  );
}
```

---

## Step 4: NavRouteRow and NavPanelRow Components

```tsx
function NavRouteRow({ route, pathname }: { route: NavRoute; pathname: string }) {
  const isActive =
    pathname === route.href ||
    (route.href !== '/' && pathname.startsWith(route.href + '/'));

  return (
    <Link
      href={route.href}
      className={cn(
        'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors',
        isActive
          ? 'bg-elevated font-medium text-text-primary'
          : 'text-text-secondary hover:bg-elevated hover:text-text-primary',
      )}
    >
      <span className={isActive ? 'text-accent' : 'text-text-muted'}>
        <NavIcon name={route.iconName} />
      </span>
      {route.label}
    </Link>
  );
}

function NavPanelRow({ panel }: { panel: NavPanel }) {
  return (
    <button
      type="button"
      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-text-secondary transition-colors hover:bg-elevated hover:text-text-primary"
      onClick={() =>
        document.dispatchEvent(new CustomEvent('open-panel', { detail: panel.id }))
      }
    >
      <span className="text-text-muted">
        <NavIcon name={panel.iconName} />
      </span>
      {panel.label}
    </button>
  );
}
```

---

## Step 5: Rewrite the Expanded Sidebar

Replace the expanded sidebar return in `AppSidebar`. Keep the following exactly as they are:
- Brand link (`<Link href="/dashboard">Carina</Link>`)
- Collapse button (`<ChevronLeft>`)
- New chat + search bar
- `SessionList` component (unchanged)
- User footer (initials, email, settings icon)

Replace the existing Tools footer section with the new nav group sections:

```tsx
// Replace this block (the old tools section):
// <div className="border-t border-border px-2 py-2">
//   <div className="mb-1 flex items-center justify-between px-2">
//     <p>Tools</p>
//     <Link href="/settings">More</Link>
//   </div>
//   {sidebarTools.map(...)}
// </div>

// With this:
<div className="border-t border-border overflow-y-auto px-2 py-2" style={{ maxHeight: '45vh' }}>
  {NAV_GROUPS.map((group) => (
    <NavGroupSection
      key={group.id}
      group={group}
      routes={NAV_ROUTES.filter((r) => r.group === group.id && !r.parent)}
      panels={NAV_PANELS.filter((p) => p.group === group.id)}
      isOpen={openGroups[group.id] ?? true}
      onToggle={() => toggleGroup(group.id)}
      pathname={pathname}
      canUseTerminal={canUseTerminal}
    />
  ))}
</div>
```

Note: `!r.parent` in the routes filter excludes settings sub-pages (`/settings/keys` etc.)
from appearing in the sidebar directly. They are reachable via `/settings` or breadcrumbs.
The sidebar shows top-level routes only to avoid visual clutter.

The `maxHeight: '45vh'` limits the nav groups section so the user footer always stays visible
even with all groups expanded. The section scrolls internally if needed.

---

## Step 6: Collapsed Sidebar Redesign

When the sidebar is collapsed (w-12), show icon-only representation of nav groups. Each group
gets one icon button with a tooltip. The active group's icon is highlighted.

Replace the existing collapsed sidebar with:

```tsx
if (collapsed) {
  return (
    <aside className="flex w-12 flex-col items-center gap-1.5 border-r border-border bg-surface py-3">
      <Tooltip text="Expand sidebar" side="right">
        <IconButton label="Expand sidebar" onClick={() => { userToggled.current = true; setCollapsed(false); }}>
          <ChevronRight className="h-4 w-4" />
        </IconButton>
      </Tooltip>

      <Tooltip text="New chat" side="right">
        <IconButton label="New chat" onClick={newChat}>
          <Plus className="h-4 w-4" />
        </IconButton>
      </Tooltip>

      <Tooltip text="Search (Ctrl+K)" side="right">
        <IconButton label="Search" onClick={() => document.dispatchEvent(new CustomEvent('open-search'))}>
          <Search className="h-4 w-4" />
        </IconButton>
      </Tooltip>

      <div className="my-1 w-6 border-t border-border" />

      {/* One icon per nav group, with active highlight */}
      {NAV_GROUPS.map((group) => {
        const groupRoutes = NAV_ROUTES.filter((r) => r.group === group.id);
        const isGroupActive = groupRoutes.some(
          (r) => pathname === r.href || (r.href !== '/' && pathname.startsWith(r.href + '/')),
        );
        return (
          <Tooltip key={group.id} text={group.label} side="right">
            <IconButton
              label={group.label}
              onClick={() => {
                // Expand the sidebar and open this group
                userToggled.current = true;
                setCollapsed(false);
                setOpenGroups((current) => ({ ...current, [group.id]: true }));
              }}
              className={isGroupActive ? 'text-accent' : ''}
            >
              <NavIcon name={group.iconName} className="h-4 w-4" />
            </IconButton>
          </Tooltip>
        );
      })}

      <div className="flex-1" />

      <Tooltip text="Settings" side="right">
        <IconButton label="Settings" onClick={() => router.push('/settings')}>
          <Settings className="h-4 w-4" />
        </IconButton>
      </Tooltip>

      <Tooltip text={userEmail} side="right">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent-dim text-accent text-xs font-medium">
          {initials}
        </div>
      </Tooltip>
    </aside>
  );
}
```

---

## Step 7: Remove Dead Code

Remove the following from `AppSidebar.tsx` since they are replaced:
- `ROUTE_ICONS` constant (replaced by NAV_ICON_MAP)
- `PANEL_ICONS` constant (replaced by NAV_ICON_MAP)
- `toolIcon()` function
- `CollapsedToolIcon` component
- `SidebarToolRow` component
- The `sidebarTools` derived variable and the `SIDEBAR_TOOLS` import

Also remove the import of `SIDEBAR_TOOLS` from `workspace-nav`. Keep the import of the new
exports: `NAV_ROUTES`, `NAV_GROUPS`, `NAV_PANELS`, `getActiveGroup`, `type NavGroupId`.

---

## Verification

```bash
npx tsc --noEmit 2>&1 | grep error | head -10
npm run build 2>&1 | tail -10
```

Manual test:
1. Open the app. The sidebar shows 4 collapsible groups: Workspace, Intelligence, Tools, Account.
2. Navigate to `/analytics`. The Account group header text turns accent-coloured. The
   "Analytics" row inside is highlighted with `bg-elevated text-text-primary`.
3. Navigate to `/cron`. The Workspace group is active. "Cron jobs" is highlighted.
4. Navigate to `/chat/[any-session-id]`. No nav group route is highlighted (chat uses the
   session list, not the nav groups).
5. Collapse the sidebar. Four group icons appear. The active group's icon is in accent colour.
   Clicking a group icon expands the sidebar and opens that group.
6. Collapse and re-expand the sidebar. Group open/closed states are preserved from localStorage.
7. On mobile (< 640px width) the sidebar should collapse by default. Verify the sidebar
   does not overflow the viewport.
