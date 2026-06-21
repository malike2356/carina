export interface Shortcut {
  id: string;
  label: string;
  category: string;
  keys: string[];
  description: string;
}

export const SHORTCUTS: Shortcut[] = [
  { id: 'search', label: 'Open search / command palette', category: 'Navigation', keys: ['Ctrl', 'K'], description: 'Open the Ctrl+K command palette.' },
  { id: 'new-chat', label: 'New chat', category: 'Navigation', keys: ['Ctrl', 'Alt', 'N'], description: 'Start a new chat session.' },
  { id: 'focus-input', label: 'Focus chat input', category: 'Navigation', keys: ['/'], description: 'Jump focus to the message input.' },
  { id: 'library', label: 'Go to Library', category: 'Navigation', keys: ['G', 'L'], description: 'Navigate to /library.' },
  { id: 'settings', label: 'Go to Settings', category: 'Navigation', keys: ['G', 'S'], description: 'Navigate to /settings.' },
  { id: 'research', label: 'Go to Research', category: 'Navigation', keys: ['G', 'R'], description: 'Navigate to /research.' },
  { id: 'tasks', label: 'Go to Tasks', category: 'Navigation', keys: ['G', 'T'], description: 'Navigate to /tasks.' },
  { id: 'send-message', label: 'Send message', category: 'Chat', keys: ['Enter'], description: 'Send the typed message.' },
  { id: 'newline', label: 'New line in message', category: 'Chat', keys: ['Shift', 'Enter'], description: 'Insert a line break without sending.' },
  { id: 'stop-stream', label: 'Stop generation', category: 'Chat', keys: ['Escape'], description: 'Stop the current AI response.' },
  { id: 'copy-last', label: 'Copy last response', category: 'Chat', keys: ['Ctrl', 'Shift', 'C'], description: 'Copy the most recent assistant message.' },
  { id: 'open-memory', label: 'Toggle Memory panel', category: 'Panels', keys: ['Ctrl', 'M'], description: 'Open or close the Memory panel.' },
  { id: 'open-skills', label: 'Toggle Skills panel', category: 'Panels', keys: ['Ctrl', 'Shift', 'S'], description: 'Open or close the Skills panel.' },
  { id: 'open-notes', label: 'Toggle Notes panel', category: 'Panels', keys: ['Ctrl', 'Shift', 'N'], description: 'Open or close the Notes panel.' },
  { id: 'toggle-sidebar', label: 'Collapse sidebar', category: 'UI', keys: ['['], description: 'Toggle the left sidebar between expanded and icon-only.' },
  { id: 'shortcut-help', label: 'Show keyboard shortcuts', category: 'UI', keys: ['?'], description: 'Open this keyboard shortcuts reference.' },
  { id: 'theme-cycle', label: 'Cycle theme', category: 'UI', keys: ['Ctrl', 'Shift', 'T'], description: 'Cycle through Dark, Light, Midnight, and Forest.' },
  { id: 'save-note', label: 'Save note', category: 'Notes', keys: ['Ctrl', 'S'], description: 'Save the currently open note.' },
];

export function groupShortcuts(): Record<string, Shortcut[]> {
  return SHORTCUTS.reduce<Record<string, Shortcut[]>>((accumulator, shortcut) => {
    if (!accumulator[shortcut.category]) accumulator[shortcut.category] = [];
    accumulator[shortcut.category].push(shortcut);
    return accumulator;
  }, {});
}
