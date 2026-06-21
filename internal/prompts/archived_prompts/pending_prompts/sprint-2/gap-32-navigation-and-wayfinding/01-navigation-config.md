# Gap 12 - Prompt 01: Navigation Config as Single Source of Truth

**Gap:** 12 Navigation and Wayfinding
**Prompt number:** 01 of 04
**Name:** Navigation Config
**Primary agent:** Claude Code
**Estimated hours:** 2-3 h
**Depends on:** Nothing (first prompt)

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

Before writing a single line, read:

1. `app.carinaai.uk/src/lib/workspace-nav.ts` - the entire current file (SIDEBAR_TOOLS,
   SETTINGS_SECTION_LINKS, all types)
2. `app.carinaai.uk/src/app/(workspace)/` - list every directory to confirm the full route
   inventory
3. `app.carinaai.uk/src/components/shell/AppSidebar.tsx` - how SIDEBAR_TOOLS is consumed
4. `app.carinaai.uk/src/components/settings/SettingsToolLinks.tsx` - how SETTINGS_SECTION_LINKS
   is consumed
5. `app.carinaai.uk/src/app/globals.css` - confirm CSS variable names for theming context

All paths are relative to `/opt/lampp/htdocs/verlox/carina/external/client-apps/`.

---

## Context

Every navigation problem in this gap - missing breadcrumbs, invisible routes, broken active
states - stems from the same root cause: the app has no single file that knows about ALL routes,
their display names, their icons, their grouping, and their parent-child relationships. Instead,
routes are scattered across `SIDEBAR_TOOLS`, `SETTINGS_SECTION_LINKS`, and hardcoded strings in
individual components.

This prompt creates that single source of truth by extending `workspace-nav.ts`. All subsequent
prompts in this gap read from this file. No prompt after this one defines its own route list.

---

## Step 1: Define the Full Route Inventory

The complete list of workspace routes, their labels, and their group assignments:

```
Group: workspace
  /chat               Chat
  /chat/[sessionId]   (dynamic, handled specially)
  /dashboard          Dashboard
  /documents          Documents
  /documents/[id]     (dynamic, parent: /documents)
  /calendar           Calendar
  /tasks              Tasks
  /research           Research
  /files              Files
  /email              Email
  /cron               Cron jobs
  /scheduled          Scheduled

Group: intelligence
  /library            Library
  panels: memory, skills, notes   (not routes, open as side panels)

Group: tools
  /terminal           Terminal
  /mcp                MCP servers
  /webhooks           Webhooks
  /env                Environment

Group: account
  /settings           Settings
  /settings/keys      API keys           (parent: /settings)
  /settings/calendar  Calendar sync      (parent: /settings)
  /settings/pairing   Device pairing     (parent: /settings)
  /billing            Billing and plan
  /security           Security
  /analytics          Analytics
  /logs               Logs
  /profiles           Profiles
```

---

## Step 2: Rewrite workspace-nav.ts

Replace the contents of `app.carinaai.uk/src/lib/workspace-nav.ts` entirely with the following.
Keep the exported names that existing consumers depend on (`SIDEBAR_TOOLS`,
`SETTINGS_SECTION_LINKS`, `SidebarPanelId`, `SidebarTool`, `SettingsToolLink`,
`SettingsSectionId`) so no other file breaks.

```typescript
import type { ReactNode } from 'react';

// ---- Panel IDs ----

export type SidebarPanelId = 'memory' | 'skills' | 'notes';

// ---- Nav group IDs ----

export type NavGroupId = 'workspace' | 'intelligence' | 'tools' | 'account';

// ---- Route entry ----

export interface NavRoute {
  href: string;
  label: string;
  description: string;
  group: NavGroupId;
  parent?: string; // href of parent route for breadcrumbs
  terminalGated?: boolean; // hide unless canUseTerminal is true
  iconName: string; // lucide icon name - see NOTE below
}

// NOTE: iconName is a string so this file stays server-safe (no React imports).
// Consumers map iconName to the actual Lucide component. The mapping is defined
// in NAV_ICON_MAP in the sidebar component (Prompt 03).

// ---- Panel entry ----

export interface NavPanel {
  kind: 'panel';
  id: SidebarPanelId;
  label: string;
  description: string;
  group: NavGroupId;
  iconName: string;
}

// ---- Nav group definition ----

export interface NavGroup {
  id: NavGroupId;
  label: string;
  iconName: string;
}

export const NAV_GROUPS: NavGroup[] = [
  { id: 'workspace',    label: 'Workspace',    iconName: 'LayoutGrid' },
  { id: 'intelligence', label: 'Intelligence', iconName: 'Brain' },
  { id: 'tools',        label: 'Tools',        iconName: 'Wrench' },
  { id: 'account',      label: 'Account',      iconName: 'User' },
];

// ---- All routes ----

export const NAV_ROUTES: NavRoute[] = [
  // Workspace
  {
    href: '/dashboard',
    label: 'Dashboard',
    description: 'Overview of your workspace activity.',
    group: 'workspace',
    iconName: 'LayoutDashboard',
  },
  {
    href: '/documents',
    label: 'Documents',
    description: 'Create and manage workspace documents.',
    group: 'workspace',
    iconName: 'FileText',
  },
  {
    href: '/calendar',
    label: 'Calendar',
    description: 'Schedule, events, and connected calendars.',
    group: 'workspace',
    iconName: 'CalendarDays',
  },
  {
    href: '/tasks',
    label: 'Tasks',
    description: 'Your task list and project tracking.',
    group: 'workspace',
    iconName: 'CheckSquare',
  },
  {
    href: '/research',
    label: 'Research',
    description: 'AI-assisted web research and summaries.',
    group: 'workspace',
    iconName: 'Search',
  },
  {
    href: '/files',
    label: 'Files',
    description: 'Upload and browse workspace files.',
    group: 'workspace',
    iconName: 'FolderOpen',
  },
  {
    href: '/email',
    label: 'Email',
    description: 'Inbound email and message triage.',
    group: 'workspace',
    iconName: 'Mail',
  },
  {
    href: '/cron',
    label: 'Cron jobs',
    description: 'Recurring automated tasks on a schedule.',
    group: 'workspace',
    iconName: 'CalendarClock',
  },
  {
    href: '/scheduled',
    label: 'Scheduled',
    description: 'Upcoming and queued scheduled runs.',
    group: 'workspace',
    iconName: 'Clock',
  },

  // Intelligence
  {
    href: '/library',
    label: 'Library',
    description: 'Memory library and knowledge store.',
    group: 'intelligence',
    iconName: 'BookOpen',
  },

  // Tools
  {
    href: '/terminal',
    label: 'Terminal',
    description: 'Sandboxed shell access for this workspace.',
    group: 'tools',
    iconName: 'Terminal',
    terminalGated: true,
  },
  {
    href: '/mcp',
    label: 'MCP servers',
    description: 'Model Context Protocol tool connections.',
    group: 'tools',
    iconName: 'Server',
  },
  {
    href: '/webhooks',
    label: 'Webhooks',
    description: 'Outbound HTTP event subscriptions.',
    group: 'tools',
    iconName: 'Webhook',
  },
  {
    href: '/env',
    label: 'Environment',
    description: 'Runtime variables and configuration.',
    group: 'tools',
    iconName: 'Database',
  },

  // Account
  {
    href: '/settings',
    label: 'Settings',
    description: 'Appearance, chat, brain, and account preferences.',
    group: 'account',
    iconName: 'Settings',
  },
  {
    href: '/settings/keys',
    label: 'API keys',
    description: 'Manage bring-your-own-key API credentials.',
    group: 'account',
    parent: '/settings',
    iconName: 'Key',
  },
  {
    href: '/settings/calendar',
    label: 'Calendar sync',
    description: 'Connect Google Calendar or other providers.',
    group: 'account',
    parent: '/settings',
    iconName: 'CalendarDays',
  },
  {
    href: '/settings/pairing',
    label: 'Device pairing',
    description: 'Link phones and tablets with a QR code.',
    group: 'account',
    parent: '/settings',
    iconName: 'Smartphone',
  },
  {
    href: '/billing',
    label: 'Billing and plan',
    description: 'View your current plan and usage.',
    group: 'account',
    iconName: 'CreditCard',
  },
  {
    href: '/security',
    label: 'Security',
    description: 'Password, sessions, and workspace trust.',
    group: 'account',
    iconName: 'Shield',
  },
  {
    href: '/analytics',
    label: 'Analytics',
    description: 'Usage metrics and activity reports.',
    group: 'account',
    iconName: 'BarChart3',
  },
  {
    href: '/logs',
    label: 'Logs',
    description: 'Application and audit log streams.',
    group: 'account',
    iconName: 'ScrollText',
  },
  {
    href: '/profiles',
    label: 'Profiles',
    description: 'Workspace personas and provider defaults.',
    group: 'account',
    iconName: 'UserCircle',
  },
];

// ---- Nav panels (open as side panels, not full pages) ----

export const NAV_PANELS: NavPanel[] = [
  { kind: 'panel', id: 'memory', label: 'Memory',  description: 'Review and edit saved memories.',       group: 'intelligence', iconName: 'Brain' },
  { kind: 'panel', id: 'skills', label: 'Skills',  description: 'Manage learned skill notes.',           group: 'intelligence', iconName: 'Sparkles' },
  { kind: 'panel', id: 'notes',  label: 'Notes',   description: 'Quick notes alongside chat.',           group: 'intelligence', iconName: 'StickyNote' },
];

// ---- Breadcrumb helpers ----

// Returns the breadcrumb trail for a given pathname.
// e.g. '/settings/keys' -> [{ href: '/settings', label: 'Settings' }, { href: '/settings/keys', label: 'API keys' }]
// e.g. '/analytics'     -> [{ href: '/analytics', label: 'Analytics' }]
export function getBreadcrumbs(pathname: string): Array<{ href: string; label: string }> {
  // Exact match
  const exact = NAV_ROUTES.find((r) => r.href === pathname);
  if (!exact) {
    // Dynamic child (e.g. /documents/abc123 - parent is /documents)
    for (const route of NAV_ROUTES) {
      if (pathname.startsWith(route.href + '/') && route.href !== '/') {
        return [
          { href: route.href, label: route.label },
          { href: pathname, label: '' }, // label resolved at render time from page context
        ];
      }
    }
    return [];
  }

  if (exact.parent) {
    const parent = NAV_ROUTES.find((r) => r.href === exact.parent);
    if (parent) {
      return [
        { href: parent.href, label: parent.label },
        { href: exact.href, label: exact.label },
      ];
    }
  }

  return [{ href: exact.href, label: exact.label }];
}

// Returns the NavGroup for a given pathname (for sidebar group highlight).
export function getActiveGroup(pathname: string): NavGroupId | null {
  // Chat is a special case
  if (pathname.startsWith('/chat')) return null; // chat uses session list, not groups

  for (const route of NAV_ROUTES) {
    if (pathname === route.href || pathname.startsWith(route.href + '/')) {
      return route.group;
    }
  }
  return null;
}

// Returns the exact NavRoute for a given pathname, or the closest parent.
export function getActiveRoute(pathname: string): NavRoute | null {
  const exact = NAV_ROUTES.find((r) => r.href === pathname);
  if (exact) return exact;

  // Match by prefix (for dynamic routes like /documents/[id])
  const prefix = NAV_ROUTES.filter(
    (r) => pathname.startsWith(r.href + '/') && r.href !== '/',
  ).sort((a, b) => b.href.length - a.href.length);

  return prefix[0] ?? null;
}

// ---- Legacy exports (keep these so existing consumers do not break) ----

export type SidebarTool =
  | { kind: 'panel'; id: SidebarPanelId; label: string }
  | { kind: 'route'; href: string; label: string; terminalGated?: boolean };

// SIDEBAR_TOOLS now derives from NAV_ROUTES.
// The old 7 items (Memory, Skills, Notes, Documents, Calendar, Research, Tasks)
// are kept here purely for backwards compatibility with CollapsedToolIcon / SidebarToolRow.
// These will be REMOVED in Prompt 03 when AppSidebar is redesigned.
export const SIDEBAR_TOOLS: SidebarTool[] = [
  { kind: 'panel', id: 'memory', label: 'Memory' },
  { kind: 'panel', id: 'skills', label: 'Skills' },
  { kind: 'panel', id: 'notes',  label: 'Notes' },
  { kind: 'route', href: '/documents', label: 'Documents' },
  { kind: 'route', href: '/calendar',  label: 'Calendar' },
  { kind: 'route', href: '/research',  label: 'Research' },
  { kind: 'route', href: '/tasks',     label: 'Tasks' },
];

export type SettingsToolLink = {
  label: string;
  description: string;
  href?: string;
  panel?: SidebarPanelId;
  terminalGated?: boolean;
};

export type SettingsSectionId =
  | 'join'
  | 'appearance'
  | 'chat'
  | 'brain'
  | 'shortcuts'
  | 'account'
  | 'notifications'
  | 'security';

export const SETTINGS_SECTION_LINKS: Record<
  Exclude<SettingsSectionId, 'appearance' | 'shortcuts' | 'notifications'>,
  SettingsToolLink[]
> = {
  join: [
    { label: 'Device pairing',  description: 'Link phones and tablets with a QR code.', href: '/settings/pairing' },
    { label: 'Calendar sync',   description: 'Connect Google Calendar or other providers.', href: '/settings/calendar' },
  ],
  chat: [
    { label: 'Open notes',  description: 'Quick notes panel alongside chat.', panel: 'notes' },
    { label: 'Files',       description: 'Upload and browse workspace files.', href: '/files' },
    { label: 'Email',       description: 'Inbound email and message triage.', href: '/email' },
    { label: 'Cron jobs',   description: 'Scheduled automations and recurring tasks.', href: '/cron' },
  ],
  brain: [
    { label: 'Open memory', description: 'Review and edit saved memories.', panel: 'memory' },
    { label: 'Open skills', description: 'Manage learned skill notes.', panel: 'skills' },
    { label: 'Library',     description: 'Memory library and knowledge store.', href: '/library' },
  ],
  account: [
    { label: 'Profiles',       description: 'Workspace personas and provider defaults.', href: '/profiles' },
    { label: 'Billing and plan', description: 'View your current plan and invoices.', href: '/billing' },
  ],
  security: [
    { label: 'Security overview', description: 'Password, sessions, and workspace trust.', href: '/security' },
    { label: 'Webhooks',          description: 'Outbound HTTP event subscriptions.', href: '/webhooks' },
    { label: 'MCP servers',       description: 'Model Context Protocol tool connections.', href: '/mcp' },
    { label: 'Terminal',          description: 'Sandboxed shell access for this workspace.', href: '/terminal', terminalGated: true },
    { label: 'Analytics',         description: 'Usage and activity metrics.', href: '/analytics' },
    { label: 'Logs',              description: 'Application and audit log streams.', href: '/logs' },
    { label: 'Environment',       description: 'Runtime variables and configuration.', href: '/env' },
  ],
};
```

---

## Step 3: Verify No Existing Consumers Break

After rewriting the file, run TypeScript type-check:

```bash
cd app.carinaai.uk
npx tsc --noEmit 2>&1 | grep -v node_modules
```

If any file imports `SidebarTool`, `SIDEBAR_TOOLS`, `SETTINGS_SECTION_LINKS`, or
`SettingsSectionId` and now has a type error, fix it by ensuring the legacy exports above
still match the expected shape. Do NOT change the consuming files at this stage - only fix
the workspace-nav.ts exports if needed to maintain compatibility.

---

## Verification

```bash
# Types compile cleanly
cd app.carinaai.uk && npx tsc --noEmit 2>&1 | grep error | head -10
# Should output nothing

# All expected exports are present
grep -E "^export (const|type|interface)" src/lib/workspace-nav.ts
# Should include: NAV_ROUTES, NAV_PANELS, NAV_GROUPS, SIDEBAR_TOOLS, SETTINGS_SECTION_LINKS,
# getBreadcrumbs, getActiveGroup, getActiveRoute, NavGroupId, NavRoute, NavGroup, NavPanel
```
