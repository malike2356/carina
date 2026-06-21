export type SidebarPanelId = 'memory' | 'skills' | 'notes';

export type SidebarTool =
  | { kind: 'panel'; id: SidebarPanelId; label: string }
  | { kind: 'route'; href: string; label: string; terminalGated?: boolean };

/** Shown in the main left sidebar (frequent day-to-day tools). */
export const SIDEBAR_TOOLS: SidebarTool[] = [
  { kind: 'panel', id: 'memory', label: 'Memory' },
  { kind: 'panel', id: 'skills', label: 'Skills' },
  { kind: 'panel', id: 'notes', label: 'Notes' },
  { kind: 'route', href: '/documents', label: 'Documents' },
  { kind: 'route', href: '/calendar', label: 'Calendar' },
  { kind: 'route', href: '/research', label: 'Research' },
  { kind: 'route', href: '/tasks', label: 'Tasks' },
  { kind: 'route', href: '/terminal', label: 'Terminal', terminalGated: true },
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
    {
      label: 'Device pairing',
      description: 'Link phones and tablets with a QR code.',
      href: '/settings/pairing',
    },
    {
      label: 'Calendar sync',
      description: 'Connect Google Calendar or other providers.',
      href: '/settings/calendar',
    },
  ],
  chat: [
    {
      label: 'Open notes',
      description: 'Quick notes panel alongside chat.',
      panel: 'notes',
    },
    {
      label: 'Files',
      description: 'Upload and browse workspace files.',
      href: '/files',
    },
    {
      label: 'Email',
      description: 'Inbound email and message triage.',
      href: '/email',
    },
    {
      label: 'Cron jobs',
      description: 'Scheduled automations and recurring tasks.',
      href: '/cron',
    },
  ],
  brain: [
    {
      label: 'Open memory',
      description: 'Review and edit saved memories.',
      panel: 'memory',
    },
    {
      label: 'Open skills',
      description: 'Manage learned skill notes.',
      panel: 'skills',
    },
    {
      label: 'Library',
      description: 'Memory library and knowledge store.',
      href: '/library',
    },
  ],
  account: [
    {
      label: 'Profiles',
      description: 'Workspace personas and provider defaults.',
      href: '/profiles',
    },
    {
      label: 'Billing and plan',
      description: 'View your current plan and invoices.',
      href: '/billing',
    },
  ],
  security: [
    {
      label: 'Security overview',
      description: 'Password, sessions, and workspace trust.',
      href: '/security',
    },
    {
      label: 'Webhooks',
      description: 'Outbound HTTP event subscriptions.',
      href: '/webhooks',
    },
    {
      label: 'MCP servers',
      description: 'Model Context Protocol tool connections.',
      href: '/mcp',
    },
    {
      label: 'Terminal',
      description: 'Sandboxed shell access for this workspace.',
      href: '/terminal',
      terminalGated: true,
    },
    {
      label: 'Analytics',
      description: 'Usage and activity metrics.',
      href: '/analytics',
    },
    {
      label: 'Logs',
      description: 'Application and audit log streams.',
      href: '/logs',
    },
    {
      label: 'Environment',
      description: 'Runtime variables and configuration.',
      href: '/env',
    },
  ],
};
