import type { TerminalSize } from './terminal.js';
import { resolveLayoutMode } from './responsive-frame.js';

export type TuiView = 'sessions' | 'tasks' | 'processes' | 'tools' | 'logs' | 'chat';

export const TUI_VIEWS: TuiView[] = ['sessions', 'tasks', 'processes', 'tools', 'logs', 'chat'];

export const VIEW_LABELS: Record<TuiView, string> = {
  sessions: 'Sessions',
  tasks: 'Tasks',
  processes: 'Processes',
  tools: 'Tools',
  logs: 'Logs',
  chat: 'Chat',
};

export interface LayoutFrame {
  narrow: boolean;
  tabRow: number;
  contentY: number;
  contentHeight: number;
  inputY: number;
  statusY: number;
  width: number;
}

export function computeLayout(size: TerminalSize): LayoutFrame {
  const width = size.cols;
  const narrow = resolveLayoutMode(width, size.rows) === 'compact';
  const tabRow = 1;
  const statusY = size.rows;
  const inputY = size.rows - 1;
  const contentY = narrow ? 3 : 2;
  const contentHeight = Math.max(4, size.rows - contentY - 2);
  return { narrow, tabRow, contentY, contentHeight, inputY, statusY, width };
}

export function tabBar(active: TuiView, width: number): string {
  const parts = TUI_VIEWS.map((view, idx) => {
    const label = `${idx + 1}:${VIEW_LABELS[view]}`;
    return view === active ? `[${label}]` : ` ${label} `;
  });
  let line = parts.join('');
  if (line.length > width) {
    const short = TUI_VIEWS.map((view, idx) => (view === active ? `>${idx + 1}` : ` ${idx + 1}`)).join('');
    line = short;
  }
  return line.slice(0, width);
}
