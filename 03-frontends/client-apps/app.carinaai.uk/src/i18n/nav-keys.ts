import type { NavGroupId } from '@/lib/workspace-nav';

export const ROUTE_LABEL_KEYS: Record<string, string> = {
  '/launcher': 'nav.launcher',
  '/documents': 'nav.documents',
  '/calendar': 'nav.calendar',
  '/tasks': 'nav.tasks',
  '/channels': 'nav.channels',
  '/research': 'nav.research',
  '/files': 'nav.files',
  '/email': 'nav.email',
  '/cron': 'nav.cron',
  '/scheduled': 'nav.scheduled',
  '/library': 'nav.library',
  '/support/chat': 'nav.productSupport',
  '/aiva/workers': 'nav.aivaWorkers',
  '/aiva': 'nav.aivaHire',
  '/terminal': 'nav.terminal',
  '/mcp': 'nav.mcp',
  '/webhooks': 'nav.webhooks',
  '/env': 'nav.env',
  '/settings': 'nav.settings',
  '/settings/keys': 'nav.apiKeys',
  '/settings/calendar': 'nav.calendarSync',
  '/settings/channels': 'nav.channelsSync',
  '/settings/pairing': 'nav.devicePairing',
  '/billing': 'nav.billing',
  '/security': 'nav.security',
  '/analytics': 'nav.analytics',
  '/logs': 'nav.logs',
  '/profiles': 'nav.profiles',
};

export const PANEL_LABEL_KEYS: Record<string, string> = {
  memory: 'nav.memory',
  skills: 'nav.skills',
  notes: 'nav.notes',
};

export const GROUP_LABEL_KEYS: Record<NavGroupId, string> = {
  workspace: 'navGroups.workspace',
  intelligence: 'navGroups.intelligence',
  aiva: 'navGroups.aiva',
  tools: 'navGroups.tools',
  account: 'navGroups.account',
};
