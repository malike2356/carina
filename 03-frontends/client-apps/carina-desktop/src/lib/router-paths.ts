export const ROUTES = {
  launcher: '/launcher',
  chat: '/',
  workspace: '/workspace',
  agents: '/agents',
  artifacts: '/artifacts',
  sessions: '/sessions',
  skills: '/skills',
  settings: '/settings',
  settingsModels: '/settings/models',
  settingsChannels: '/settings/channels',
  settingsAppearance: '/settings/appearance',
  settingsDevices: '/settings/devices',
  settingsAbout: '/settings/about',
  canvas: '/canvas',
  events: '/events',
  scout: '/scout',
  operator: '/operator',
} as const;

export type AppRoute = (typeof ROUTES)[keyof typeof ROUTES];

export const NAV_ITEMS = [
  { route: ROUTES.chat, label: 'Chat', shortcut: '1' },
  { route: ROUTES.workspace, label: 'Workspace', shortcut: '2' },
  { route: ROUTES.settings, label: 'Settings', shortcut: '3' },
] as const;
