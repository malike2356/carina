export type WorkspaceWindowId =
  | 'memory'
  | 'skills'
  | 'notes'
  | 'terminal'
  | 'tasks'
  | 'calendar'
  | 'documents'
  | 'research'
  | 'library'
  | 'email'
  | 'settings'
  | 'files'
  | 'mcp'
  | 'webhooks'
  | 'env'
  | 'analytics'
  | 'logs'
  | 'profiles'
  | 'billing'
  | 'security'
  | 'cron'
  | 'scheduled';

export type WindowDockSide = 'left' | 'right';

export type WindowSize = 'panel' | 'tool' | 'terminal';

export interface WindowDefinition {
  id: WorkspaceWindowId;
  title: string;
  href?: string;
  accent?: 'scout';
  minWidth?: number;
  minHeight?: number;
  /** Controls default floating window dimensions. */
  size?: WindowSize;
  /** Side panels that sit beside chat; full tools open as floating windows. */
  dockable?: boolean;
  defaultMode?: 'docked' | 'floating';
}

export interface ManagedWindowState {
  id: WorkspaceWindowId;
  minimized: boolean;
  maximized: boolean;
  mode: 'docked' | 'floating';
  zIndex: number;
  dock: WindowDockSide | null;
}

export interface WindowRect {
  left: number;
  top: number;
  width: number;
  height: number;
}
