import { CYBER_TOOL_COUNT } from '@/lib/cyber-tools-core';
import { isCloudOnlyRoute } from '@/lib/product-surface';

export type SidebarPanelId = 'memory' | 'skills' | 'notes';

export type NavGroupId = 'workspace' | 'intelligence' | 'aiva' | 'tools' | 'account';

export interface NavRoute {
  href: string;
  label: string;
  description: string;
  group: NavGroupId;
  parent?: string;
  terminalGated?: boolean;
  planRequired?: 'team' | 'business';
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
  { id: 'aiva', label: 'Aiva', iconName: 'Bot' },
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
    href: '/dashboard',
    label: 'Dashboard',
    description: 'Workspace overview, quick actions, and surface health.',
    group: 'workspace',
    iconName: 'LayoutDashboard',
  },
  {
    href: '/sessions',
    label: 'Sessions',
    description: 'Browse session history and jump back into active threads.',
    group: 'workspace',
    iconName: 'LayoutList',
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
    href: '/vical',
    label: 'Bookings',
    description: 'viCal event types, availability, and public booking links.',
    group: 'workspace',
    iconName: 'CalendarClock',
  },
  {
    href: '/channels',
    label: 'Channels',
    description: 'Messaging, productivity tools, and device connections.',
    group: 'workspace',
    iconName: 'Waypoints',
  },
  {
    href: '/tasks',
    label: 'Schedules',
    description: 'Workspace housekeeping on a timer. Not Aiva morning digests.',
    group: 'workspace',
    iconName: 'CheckSquare',
  },
  {
    href: '/slack',
    label: 'Slack',
    description: 'Connect Aiva workers to Slack workspaces.',
    group: 'workspace',
    iconName: 'Hash',
    parent: '/channels',
  },
  {
    href: '/research',
    label: 'Research',
    description: 'AI-assisted web research and summaries.',
    group: 'workspace',
    iconName: 'Search',
  },
  {
    href: '/aiva/outreach/companies-house',
    label: 'Companies House',
    description: 'UK public registry search (Outreach + More; not primary sidebar).',
    group: 'workspace',
    iconName: 'Building2',
    parent: '/aiva/outreach',
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
    description: 'Your mailbox: read, send, and triage mail.',
    group: 'workspace',
    iconName: 'Mail',
  },
  {
    href: '/aiva/outreach',
    label: 'Outreach',
    description: 'Lead funnel, Soft Wall sequences, channels, and Companies House.',
    group: 'workspace',
    iconName: 'Send',
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
    href: '/incident-blog',
    label: 'Incident blog',
    description: 'Incident discovery, approval thresholds, and subscriber dispatch.',
    group: 'workspace',
    iconName: 'Newspaper',
  },
  {
    href: '/library',
    label: 'Library',
    description: 'Memory library and knowledge store.',
    group: 'intelligence',
    iconName: 'BookOpen',
  },
  {
    href: '/skills',
    label: 'Skills',
    description: 'Browse built-in and custom workspace skills.',
    group: 'intelligence',
    iconName: 'Sparkles',
  },
  {
    href: '/models',
    label: 'Models',
    description: 'See which model providers and models are available.',
    group: 'intelligence',
    iconName: 'Bot',
  },
  {
    href: '/support/chat',
    label: 'Product support',
    description: 'Chat with the built-in Support profile for Carina and Scout help.',
    group: 'intelligence',
    iconName: 'LifeBuoy',
  },
  {
    href: '/packs',
    label: 'Skill packs',
    description: 'Vertical templates and branded pack marketplace.',
    group: 'intelligence',
    iconName: 'Package',
  },
  {
    href: '/knowledge',
    label: 'Knowledge',
    description: 'Upload documents, paste text, or fetch URLs to grow the RAG knowledge base.',
    group: 'intelligence',
    iconName: 'Database',
  },
  {
    href: '/aiva/workers',
    label: 'AI Employees',
    description: 'Manage your hired AI Employees (Aiva workers).',
    group: 'aiva',
    iconName: 'Bot',
  },
  {
    href: '/aiva/governance',
    label: 'Governance',
    description: 'Scout protection status, audit summary, and kill switch awareness.',
    group: 'aiva',
    iconName: 'Shield',
  },
  {
    href: '/aiva/approvals',
    label: 'Approvals',
    description: 'Approve drafts before your Aivas send email or social posts. Not your mailbox.',
    group: 'aiva',
    iconName: 'Mail',
  },
  {
    href: '/aiva/propreneur',
    label: 'Propreneur',
    description: 'Tenant context, sync health, and Propreneur control links.',
    group: 'aiva',
    iconName: 'Building2',
  },
  {
    href: '/aiva/hire',
    label: 'Hire',
    description: 'Hire a new Aiva for your workspace.',
    group: 'aiva',
    iconName: 'Plus',
  },
  {
    href: '/conversations',
    label: 'Conversations',
    description: 'Inbox across all your Aivas.',
    group: 'aiva',
    iconName: 'MessageSquare',
  },
  {
    href: '/aiva/escalations',
    label: 'VA queue',
    description: 'Open human escalations across your Aivas (Team plan).',
    group: 'aiva',
    iconName: 'LifeBuoy',
    planRequired: 'team',
  },
  {
    href: '/analytics',
    label: 'Analytics',
    description: 'Message volume, channels, and escalations across your Aivas.',
    group: 'aiva',
    iconName: 'BarChart2',
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
    href: '/config',
    label: 'Config',
    description: 'Inspect current workspace config and feature flags.',
    group: 'tools',
    iconName: 'Settings',
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
    href: '/settings/channels',
    label: 'Channels and integrations',
    description: 'Connect messaging, tools, and devices with your credentials.',
    group: 'account',
    parent: '/settings',
    iconName: 'Waypoints',
  },
  {
    href: '/settings/calendar',
    label: 'Calendar sync',
    description: 'Connect Google Calendar or CalDAV providers.',
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
    href: '/developer',
    label: 'Developer',
    description: 'Partner API keys and gateway usage.',
    group: 'account',
    iconName: 'Code2',
  },
  {
    href: '/developer/keys',
    label: 'API keys',
    description: 'Create and revoke partner gateway API keys.',
    group: 'account',
    parent: '/developer',
    iconName: 'KeyRound',
  },
  {
    href: '/developer/usage',
    label: 'Usage',
    description: 'Gateway event volume and estimated fees.',
    group: 'account',
    parent: '/developer',
    iconName: 'BarChart2',
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
    description: 'Threat dashboard, compliance, and workspace trust.',
    group: 'account',
    iconName: 'Shield',
  },
  {
    href: '/security/tools',
    label: 'Security tools',
    description: `Cheatsheet of all ${CYBER_TOOL_COUNT} security tools, trigger phrases, and binary health.`,
    group: 'account',
    iconName: 'Terminal',
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

export function filterNavForSurface(
  surface: 'cloud' | 'aiva',
  routes: NavRoute[],
): NavRoute[] {
  if (surface !== 'aiva') return routes;
  return routes
    .filter((route) => {
      if (route.group !== 'aiva' && route.group !== 'account') return false;
      if (route.group === 'account' && route.href === '/analytics') return false;
      if (isCloudOnlyRoute(route.href)) return false;
      return true;
    })
    .map((route) =>
      route.href === '/billing' ? { ...route, href: '/billing/aiva' } : route,
    );
}

export function filterNavGroupsForSurface(
  surface: 'cloud' | 'aiva',
  groups: NavGroup[],
): NavGroup[] {
  if (surface !== 'aiva') return groups;
  return groups.filter((group) => group.id === 'aiva' || group.id === 'account');
}

export function filterNavPanelsForSurface(
  surface: 'cloud' | 'aiva',
  panels: NavPanel[],
): NavPanel[] {
  // Aiva uses AivaSidebar primary links; Cloud shows intelligence panels in the accordion.
  if (surface === 'aiva') return [];
  return panels;
}

export type SidebarTool =
  | { kind: 'panel'; id: SidebarPanelId; label: string }
  | { kind: 'route'; href: string; label: string; terminalGated?: boolean };

export const SIDEBAR_TOOLS: SidebarTool[] = [
  { kind: 'panel', id: 'memory', label: 'Memory' },
  { kind: 'panel', id: 'skills', label: 'Skills' },
  { kind: 'panel', id: 'notes', label: 'Notes' },
  { kind: 'route', href: '/documents', label: 'Documents' },
  { kind: 'route', href: '/channels', label: 'Channels' },
  { kind: 'route', href: '/calendar', label: 'Calendar' },
  { kind: 'route', href: '/research', label: 'Research' },
  { kind: 'route', href: '/tasks', label: 'Schedules' },
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
  | 'data'
  | 'incident-blog'
  | 'security';

export const SETTINGS_SECTION_LINKS: Record<
  Exclude<SettingsSectionId, 'appearance' | 'shortcuts' | 'notifications' | 'data'>,
  SettingsToolLink[]
> = {
  join: [
    {
      label: 'Channels and integrations',
      description: 'Slack, WhatsApp, Telegram, Trello, calendar, and more.',
      href: '/settings/channels',
    },
    { label: 'Device pairing', description: 'Link phones and tablets with a QR code.', href: '/settings/pairing' },
    { label: 'Calendar sync', description: 'Connect Google Calendar or other providers.', href: '/settings/calendar' },
    { label: 'Slack integration', description: 'Bot token and team ID for Aiva Slack channels.', href: '/channels/slack' },
  ],
  brand: [
    { label: 'Workspace brand', description: 'Logo, colors, and white-label identity.', href: '/settings#brand' },
    { label: 'Widget branding', description: 'Business plan widget logo, colors, and domain.', href: '/settings/branding' },
    { label: 'Scout rules', description: 'Custom Scout governance thresholds.', href: '/settings/governance' },
  ],
  chat: [
    { label: 'Open notes', description: 'Quick notes panel alongside chat.', panel: 'notes' },
    { label: 'Sessions', description: 'Browse session history and reopen threads.', href: '/sessions' },
    { label: 'Files', description: 'Upload and browse workspace files.', href: '/files' },
    { label: 'Email', description: 'Your mailbox: read, send, and triage mail.', href: '/email' },
    { label: 'Channels', description: 'Messaging, tools, and device connections.', href: '/channels' },
    { label: 'Cron jobs', description: 'Scheduled automations and recurring tasks.', href: '/cron' },
  ],
  brain: [
    { label: 'Open memory', description: 'Review and edit saved memories.', panel: 'memory' },
    {
      label: 'GitHub memory',
      description: 'Link agent memory to a private GitHub repo instead of Obsidian.',
      href: '/settings?section=brain#agent-sync',
    },
    { label: 'Open skills', description: 'Manage learned skill notes.', panel: 'skills' },
    { label: 'Skill packs', description: 'Vertical templates and branded pack marketplace.', href: '/packs' },
    { label: 'Library', description: 'Memory library and knowledge store.', href: '/library' },
    { label: 'Skills', description: 'Browse built-in and custom workspace skills.', href: '/skills' },
    { label: 'Models', description: 'Available model providers and model names.', href: '/models' },
    {
      label: 'Channels and integrations',
      description: 'Slack, WhatsApp, Telegram, Trello, and more.',
      href: '/settings/channels',
    },
  ],
  account: [
    { label: 'Profiles', description: 'Workspace personas and provider defaults.', href: '/profiles' },
    { label: 'Billing and plan', description: 'View your current plan and invoices.', href: '/billing' },
    {
      label: 'Features',
      description: 'Enable or disable AI and analytics features for this workspace.',
      href: '/settings/features',
    },
  ],
  'incident-blog': [
    {
      label: 'Incident blog console',
      description: 'Draft queue, research runs, subscribers, and publish controls.',
      href: '/incident-blog',
    },
    {
      label: 'Newsletter history',
      description: 'Review publish-triggered sends and subscriber delivery state.',
      href: '/incident-blog?view=newsletter',
    },
  ],
  security: [
    { label: 'Privacy settings', description: 'Export data, cookies, and account deletion.', href: '/settings/privacy' },
    { label: 'Security overview', description: 'Threat dashboard, RASP, and workspace trust.', href: '/security' },
    { label: 'Webhooks', description: 'Outbound HTTP event subscriptions.', href: '/webhooks' },
    { label: 'MCP servers', description: 'Model Context Protocol tool connections.', href: '/mcp' },
    { label: 'Terminal', description: 'Sandboxed shell access for this workspace.', href: '/terminal', terminalGated: true },
    { label: 'Analytics', description: 'Usage and activity metrics.', href: '/analytics' },
    { label: 'Logs', description: 'Application and audit log streams.', href: '/logs' },
    { label: 'Environment', description: 'Runtime variables and configuration.', href: '/env' },
    { label: 'Config', description: 'Workspace config and feature flags.', href: '/config' },
  ],
};
