export type SidebarPanelId = 'memory' | 'skills' | 'notes';

export type NavGroupId = 'workspace' | 'intelligence' | 'tools' | 'account';

export interface NavRoute {
  href: string;
  label: string;
  description: string;
  group: NavGroupId;
  parent?: string;
  terminalGated?: boolean;
  iconName: string;
}

export interface NavPanel {
  kind: 'panel';
  id: SidebarPanelId;
  label: string;
  description: string;
  group: NavGroupId;
  iconName: string;
}

export interface NavGroup {
  id: NavGroupId;
  label: string;
  iconName: string;
}

export const NAV_GROUPS: NavGroup[] = [
  { id: 'workspace', label: 'Workspace', iconName: 'LayoutGrid' },
  { id: 'intelligence', label: 'Intelligence', iconName: 'Brain' },
  { id: 'tools', label: 'Tools', iconName: 'Wrench' },
  { id: 'account', label: 'Account', iconName: 'User' },
];

export const NAV_ROUTES: NavRoute[] = [
  {
    href: '/launcher',
    label: 'Launcher',
    description: 'Carina home screen with workspace orbit and quick actions.',
    group: 'workspace',
    iconName: 'Home',
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
  {
    href: '/library',
    label: 'Library',
    description: 'Memory library and knowledge store.',
    group: 'intelligence',
    iconName: 'BookOpen',
  },
  {
    href: '/packs',
    label: 'Skill packs',
    description: 'Vertical templates and branded pack marketplace.',
    group: 'intelligence',
    iconName: 'Package',
  },
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
  {
    href: '/system',
    label: 'System health',
    description: 'Subsystem status and workspace health summary.',
    group: 'tools',
    iconName: 'Activity',
  },
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
    description: 'Workspace identity, operator context, and profile scope.',
    group: 'account',
    iconName: 'UserCircle',
  },
];

export const NAV_PANELS: NavPanel[] = [
  { kind: 'panel', id: 'memory', label: 'Memory', description: 'Review and edit saved memories.', group: 'intelligence', iconName: 'Brain' },
  { kind: 'panel', id: 'skills', label: 'Skills', description: 'Manage learned skill notes.', group: 'intelligence', iconName: 'Sparkles' },
  { kind: 'panel', id: 'notes', label: 'Notes', description: 'Quick notes alongside chat.', group: 'intelligence', iconName: 'StickyNote' },
];

export function getBreadcrumbs(pathname: string): Array<{ href: string; label: string }> {
  const exact = NAV_ROUTES.find((r) => r.href === pathname);
  if (!exact) {
    for (const route of NAV_ROUTES) {
      if (pathname.startsWith(`${route.href}/`) && route.href !== '/') {
        return [
          { href: route.href, label: route.label },
          { href: pathname, label: '' },
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

export function getActiveGroup(pathname: string): NavGroupId | null {
  if (pathname.startsWith('/chat')) return null;

  for (const route of NAV_ROUTES) {
    if (pathname === route.href || pathname.startsWith(`${route.href}/`)) {
      return route.group;
    }
  }
  return null;
}

export function getActiveRoute(pathname: string): NavRoute | null {
  const exact = NAV_ROUTES.find((r) => r.href === pathname);
  if (exact) return exact;

  const prefix = NAV_ROUTES.filter(
    (r) => pathname.startsWith(`${r.href}/`) && r.href !== '/',
  ).sort((a, b) => b.href.length - a.href.length);

  return prefix[0] ?? null;
}

export type SidebarTool =
  | { kind: 'panel'; id: SidebarPanelId; label: string }
  | { kind: 'route'; href: string; label: string; terminalGated?: boolean };

export const SIDEBAR_TOOLS: SidebarTool[] = [
  { kind: 'panel', id: 'memory', label: 'Memory' },
  { kind: 'panel', id: 'skills', label: 'Skills' },
  { kind: 'panel', id: 'notes', label: 'Notes' },
  { kind: 'route', href: '/documents', label: 'Documents' },
  { kind: 'route', href: '/calendar', label: 'Calendar' },
  { kind: 'route', href: '/research', label: 'Research' },
  { kind: 'route', href: '/tasks', label: 'Tasks' },
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
  | 'brand'
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
    { label: 'Device pairing', description: 'Link phones and tablets with a QR code.', href: '/settings/pairing' },
    { label: 'Calendar sync', description: 'Connect Google Calendar or other providers.', href: '/settings/calendar' },
  ],
  brand: [
    { label: 'Workspace brand', description: 'Logo, colors, and white-label identity.', href: '/settings#brand' },
  ],
  chat: [
    { label: 'Open notes', description: 'Quick notes panel alongside chat.', panel: 'notes' },
    { label: 'Files', description: 'Upload and browse workspace files.', href: '/files' },
    { label: 'Email', description: 'Inbound email and message triage.', href: '/email' },
    { label: 'Cron jobs', description: 'Scheduled automations and recurring tasks.', href: '/cron' },
  ],
  brain: [
    { label: 'Open memory', description: 'Review and edit saved memories.', panel: 'memory' },
    { label: 'Open skills', description: 'Manage learned skill notes.', panel: 'skills' },
    { label: 'Skill packs', description: 'Vertical templates and branded pack marketplace.', href: '/packs' },
    { label: 'Library', description: 'Memory library and knowledge store.', href: '/library' },
  ],
  account: [
    { label: 'Profiles', description: 'Workspace personas and provider defaults.', href: '/profiles' },
    { label: 'Billing and plan', description: 'View your current plan and invoices.', href: '/billing' },
  ],
  security: [
    { label: 'Security overview', description: 'Password, sessions, and workspace trust.', href: '/security' },
    { label: 'Webhooks', description: 'Outbound HTTP event subscriptions.', href: '/webhooks' },
    { label: 'MCP servers', description: 'Model Context Protocol tool connections.', href: '/mcp' },
    { label: 'Terminal', description: 'Sandboxed shell access for this workspace.', href: '/terminal', terminalGated: true },
    { label: 'Analytics', description: 'Usage and activity metrics.', href: '/analytics' },
    { label: 'Logs', description: 'Application and audit log streams.', href: '/logs' },
    { label: 'Environment', description: 'Runtime variables and configuration.', href: '/env' },
  ],
};
