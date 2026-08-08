import type { WindowDefinition, ManagedWindowState, WorkspaceWindowId } from './types';

const SIDE_PANEL_IDS = new Set<WorkspaceWindowId>(['memory', 'skills', 'notes']);

function sidePanel(title: string, id: WorkspaceWindowId): WindowDefinition {
  return { id, title, dockable: false, defaultMode: 'floating', size: 'panel' };
}

function fullTool(title: string, id: WorkspaceWindowId, href: string, accent?: 'scout'): WindowDefinition {
  return { id, title, href, dockable: false, defaultMode: 'floating', accent, size: 'tool' };
}

export const WINDOW_DEFINITIONS: Record<WorkspaceWindowId, WindowDefinition> = {
  memory: sidePanel('Memory', 'memory'),
  skills: sidePanel('Skills', 'skills'),
  notes: sidePanel('Notes', 'notes'),
  terminal: { id: 'terminal', title: 'Terminal', dockable: false, defaultMode: 'floating', size: 'terminal' },
  tasks: fullTool('Tasks', 'tasks', '/tasks'),
  calendar: fullTool('Calendar', 'calendar', '/calendar'),
  documents: fullTool('Documents', 'documents', '/documents'),
  research: fullTool('Research', 'research', '/research'),
  outreach: fullTool('Outreach', 'outreach', '/aiva/outreach/leads'),
  library: fullTool('Library', 'library', '/library'),
  email: fullTool('Email', 'email', '/email'),
  settings: fullTool('Settings', 'settings', '/settings'),
  files: fullTool('Files', 'files', '/files'),
  mcp: fullTool('MCP servers', 'mcp', '/mcp'),
  webhooks: fullTool('Webhooks', 'webhooks', '/webhooks'),
  env: fullTool('Environment', 'env', '/env'),
  analytics: fullTool('Analytics', 'analytics', '/analytics'),
  logs: fullTool('Logs', 'logs', '/logs'),
  profiles: fullTool('Profiles', 'profiles', '/profiles'),
  billing: { ...fullTool('Billing', 'billing', '/billing'), minWidth: 720 },
  security: fullTool('Security', 'security', '/security', 'scout'),
  cron: fullTool('Cron jobs', 'cron', '/cron'),
  scheduled: fullTool('Scheduled', 'scheduled', '/scheduled'),
};

const HREF_TO_WINDOW: Record<string, WorkspaceWindowId> = Object.fromEntries(
  Object.values(WINDOW_DEFINITIONS)
    .filter((def) => def.href)
    .map((def) => [def.href as string, def.id]),
) as Record<string, WorkspaceWindowId>;

export function hrefToWindowId(href: string): WorkspaceWindowId | null {
  return HREF_TO_WINDOW[href] ?? null;
}

export function panelIdToWindowId(panel: string): WorkspaceWindowId | null {
  if (panel === 'memory' || panel === 'skills' || panel === 'notes' || panel === 'terminal') {
    return panel;
  }
  return null;
}

export function preferWindowOverlay(pathname: string): boolean {
  return pathname.startsWith('/chat') || pathname === '/launcher';
}

export function isDockableWindow(id: WorkspaceWindowId): boolean {
  return WINDOW_DEFINITIONS[id]?.dockable === true;
}

export function defaultWindowMode(id: WorkspaceWindowId): 'docked' | 'floating' {
  return WINDOW_DEFINITIONS[id]?.defaultMode ?? 'floating';
}

export function normalizeWindowState(state: ManagedWindowState): ManagedWindowState {
  if (state.mode === 'docked' && !isDockableWindow(state.id)) {
    return { ...state, mode: 'floating', maximized: false };
  }
  return state;
}

export function isSidePanelId(id: WorkspaceWindowId): boolean {
  return SIDE_PANEL_IDS.has(id);
}

export function isWindowRouteActive(id: WorkspaceWindowId, pathname: string): boolean {
  const href = WINDOW_DEFINITIONS[id]?.href;
  if (!href) return false;
  return pathname === href || pathname.startsWith(`${href}/`);
}
