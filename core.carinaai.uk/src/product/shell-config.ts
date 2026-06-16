import type { ShellNavLink } from './types.js';

const SHARED_WORKSPACE_NAV: ShellNavLink[] = [
  { id: 'chat', href: '/', label: 'Chat', description: 'Agent conversations' },
  { id: 'notes', href: '/notes', label: 'Notes', description: 'Notes, tasks, and reminders' },
  { id: 'calendar', href: '/calendar', label: 'Calendar', description: 'Reminder schedule' },
  { id: 'documents', href: '/documents', label: 'Documents', description: 'Markdown and CSV editor' },
  { id: 'images', href: '/images', label: 'Images', description: 'Generate and browse images' },
  {
    id: 'research',
    href: '/research',
    label: 'Deep Research',
    description: 'Multi-step research with citations',
  },
  {
    id: 'compare',
    href: '/compare',
    label: 'Model Compare',
    description: 'Query providers side by side',
  },
  { id: 'memory', href: '/memory', label: 'Memory', description: 'Persistent agent memory' },
  { id: 'packs', href: '/packs', label: 'Skill packs', description: 'Domain skill bundles' },
  { id: 'playbook', href: '/playbook', label: 'Playbook', description: 'Local model serving' },
  { id: 'webhooks', href: '/webhooks', label: 'Webhooks', description: 'Subscriptions and delivery log' },
];

const PRIVATE_OPERATOR_NAV: ShellNavLink[] = [
  { id: 'email', href: '/email', label: 'Email', description: 'Inbound triage and archive' },
  { id: 'kanban', href: '/kanban', label: 'Kanban', description: 'Operator work board' },
];

export function hostedShellConfig(): {
  primaryNav: ShellNavLink[];
  accountNav: ShellNavLink[];
  instanceNav: ShellNavLink[];
} {
  return {
    primaryNav: [...SHARED_WORKSPACE_NAV],
    accountNav: [
      { id: 'settings', href: '/settings', label: 'API keys (BYOK)', description: 'Tenant credentials' },
      { id: 'billing', href: '/billing', label: 'Billing', description: 'Plan and usage' },
      { id: 'security', href: '/security', label: 'Scout Security', description: 'Trust and monitoring' },
      { id: 'ops', href: '/ops/', label: 'Carina Ops', description: 'Managed workbench' },
      { id: 'dashboard', href: '/dashboard', label: 'Scout Dashboard', description: 'Security overview' },
    ],
    instanceNav: [],
  };
}

export function privateShellConfig(): {
  primaryNav: ShellNavLink[];
  accountNav: ShellNavLink[];
  instanceNav: ShellNavLink[];
} {
  return {
    primaryNav: [
      ...SHARED_WORKSPACE_NAV,
      { id: 'prompt-packs', href: '/prompt-packs', label: 'Prompt packs', description: 'Internal gap-close prompts' },
      ...PRIVATE_OPERATOR_NAV,
    ],
    accountNav: [],
    instanceNav: [
      { id: 'control', href: '/control', label: 'Control Center', description: 'Host status and recovery' },
      { id: 'login', href: '/login', label: 'Sign in', description: 'Local instance password' },
    ],
  };
}

export function sharedWorkspacePageIds(): Set<string> {
  return new Set(SHARED_WORKSPACE_NAV.map((item) => item.id));
}
