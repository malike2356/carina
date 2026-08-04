export interface KeyboardShortcut {
  keys: string;
  action: string;
}

export const INK_CHAT_SHORTCUTS: KeyboardShortcut[] = [
  { keys: 'Ctrl+N', action: 'New session' },
  { keys: 'Ctrl+L', action: 'Clear screen' },
  { keys: 'Ctrl+R', action: 'Retry last message' },
  { keys: 'Ctrl+P', action: 'Model picker' },
  { keys: 'Ctrl+S', action: 'Session switcher' },
  { keys: 'Ctrl+K', action: 'Slash command menu (type /)' },
  { keys: 'Ctrl+Shift+R', action: 'Search input history' },
  { keys: 'Ctrl+J', action: 'Toggle multiline composer' },
  { keys: 'Ctrl+E', action: 'Open external editor' },
  { keys: 'Ctrl+[ / Ctrl+]', action: 'Previous / next session' },
  { keys: 'Ctrl+Shift+S', action: 'Scout status overlay' },
  { keys: 'Ctrl+Shift+E', action: 'Scout security events' },
  { keys: 'Ctrl+Shift+K', action: 'Kill active subagents hint' },
  { keys: 'Ctrl+A', action: 'Agents overlay' },
  { keys: '? (empty input)', action: 'Toggle this help' },
  { keys: 'Esc', action: 'Close overlay' },
  { keys: 'q (empty input)', action: 'Quit (when idle)' },
];

export const OPERATOR_SHORTCUTS: KeyboardShortcut[] = [
  { keys: 'Tab / Shift+Tab', action: 'Cycle views' },
  { keys: '1-6', action: 'Jump to view' },
  { keys: 'j/k or arrows', action: 'Navigate items' },
  { keys: 'Enter', action: 'Select / expand' },
  { keys: '/', action: 'Search / filter' },
  { keys: ':', action: 'Command mode' },
  { keys: 'q', action: 'Quit' },
];
