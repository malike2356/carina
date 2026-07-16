import { truncate as truncateText } from './terminal.js';

export const TUI_MIN_COLUMNS = 40;
export const TUI_MIN_ROWS = 12;
export const TUI_COMPACT_MAX_COLUMNS = 71;
export const TUI_WIDE_MIN_COLUMNS = 110;
export const TUI_COMPACT_MAX_ROWS = 17;
export const TUI_WIDE_MIN_ROWS = 20;

export type TuiLayoutMode = 'compact' | 'normal' | 'wide';

export interface ResponsiveFrame {
  mode: TuiLayoutMode;
  columns: number;
  rows: number;
  contentWidth: number;
  bodyHeight: number;
  headerHeight: number;
  footerHeight: number;
  leftWidth: number;
  rightWidth: number;
  twoColumn: boolean;
  showTagline: boolean;
  showSessionMeta: boolean;
  showSystemHealth: boolean;
  showLastActivity: boolean;
  showActiveProjects: boolean;
  showQuickCommands: boolean;
  showRecentSessions: boolean;
  showFooterHints: boolean;
  maxProjectNameLen: number;
  maxStatusValueLen: number;
  statusBarMode: 'full' | 'compact' | 'minimal';
}

export function clampTerminalColumns(columns: number): number {
  return Math.max(TUI_MIN_COLUMNS, Math.floor(columns));
}

export function clampTerminalRows(rows: number): number {
  return Math.max(TUI_MIN_ROWS, Math.floor(rows));
}

export function resolveLayoutMode(columns: number, rows: number): TuiLayoutMode {
  const cols = clampTerminalColumns(columns);
  const height = clampTerminalRows(rows);
  if (cols <= TUI_COMPACT_MAX_COLUMNS || height <= TUI_COMPACT_MAX_ROWS) return 'compact';
  if (cols >= TUI_WIDE_MIN_COLUMNS && height >= TUI_WIDE_MIN_ROWS) return 'wide';
  return 'normal';
}

export function computeResponsiveFrame(columns: number, rows: number): ResponsiveFrame {
  const cols = clampTerminalColumns(columns);
  const height = clampTerminalRows(rows);
  const mode = resolveLayoutMode(cols, height);
  const contentWidth = Math.max(TUI_MIN_COLUMNS, cols - 2);
  const headerHeight = mode === 'compact' ? 3 : mode === 'normal' ? 4 : 5;
  const footerHeight = mode === 'compact' ? 2 : 3;
  const bodyHeight = Math.max(4, height - headerHeight - footerHeight);
  const gutter = mode === 'wide' ? 1 : 0;
  const leftWidth = mode === 'wide'
    ? Math.max(28, Math.floor(contentWidth * 0.58))
    : contentWidth;
  const rightWidth = mode === 'wide'
    ? Math.max(20, contentWidth - leftWidth - gutter)
    : 0;

  return {
    mode,
    columns: cols,
    rows: height,
    contentWidth,
    bodyHeight,
    headerHeight,
    footerHeight,
    leftWidth,
    rightWidth,
    twoColumn: mode === 'wide',
    showTagline: mode === 'wide',
    showSessionMeta: mode !== 'compact',
    showSystemHealth: mode !== 'compact',
    showLastActivity: mode === 'wide',
    showActiveProjects: mode !== 'compact',
    showQuickCommands: mode === 'wide',
    showRecentSessions: mode !== 'compact',
    showFooterHints: mode !== 'compact',
    maxProjectNameLen: mode === 'compact' ? 18 : mode === 'normal' ? 24 : 32,
    maxStatusValueLen: mode === 'compact' ? 14 : mode === 'normal' ? 20 : 28,
    statusBarMode: mode === 'compact' ? 'minimal' : mode === 'normal' ? 'compact' : 'full',
  };
}

export function truncateLabel(text: string, width: number): string {
  return truncateText(text, Math.max(1, width));
}

export function fitLine(parts: string[], width: number, separator = '  '): string {
  const sepLen = separator.length;
  let line = '';
  for (const part of parts) {
    if (!part) continue;
    const next = line ? `${line}${separator}${part}` : part;
    if (next.length <= width) {
      line = next;
      continue;
    }
    if (!line) return truncateLabel(part, width);
    break;
  }
  return line;
}
