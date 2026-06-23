# Prompt 16 - Keyboard Shortcuts Registry

## Objective

Build a centralised keyboard shortcut registry that:
1. Defines all app shortcuts in one place
2. Provides a `useShortcut` hook for registering handlers
3. Renders a Shortcuts panel accessible via `?` key or from Settings
4. Shows the shortcut list in the Settings page under a Shortcuts section

Odysseus has rich keyboard support throughout. This prompt makes Carina at least as keyboard-driven and adds a discoverability layer that Odysseus lacks.

---

## Context

Working directory: `/opt/lampp/htdocs/verlox/carina/app.carinaai.uk`

Prerequisites: Prompts 00-15 complete. `Kbd` component exists (Prompt 02). The `CommandPalette` already handles Ctrl+K and Ctrl+/. This prompt adds the remaining shortcuts and a user-facing shortcut reference.

---

## Step 1 - Shortcut Registry

Create `src/lib/shortcuts.ts`:

```ts
export interface Shortcut {
  id:          string;
  label:       string;
  category:    string;
  keys:        string[]; // e.g. ['Ctrl', 'K']
  description: string;
}

// The canonical list of all Carina keyboard shortcuts.
// Components register handlers via the useShortcut hook; this list is the source of truth for display.
export const SHORTCUTS: Shortcut[] = [
  // Navigation
  { id: 'search',          label: 'Open search / command palette', category: 'Navigation', keys: ['Ctrl', 'K'],       description: 'Open the Ctrl+K command palette' },
  { id: 'new-chat',        label: 'New chat',                      category: 'Navigation', keys: ['Ctrl', 'Alt', 'N'], description: 'Start a new chat session' },
  { id: 'focus-input',     label: 'Focus chat input',              category: 'Navigation', keys: ['/'],               description: 'Jump focus to the message input' },
  { id: 'library',         label: 'Go to Library',                 category: 'Navigation', keys: ['G', 'L'],           description: 'Navigate to /library' },
  { id: 'settings',        label: 'Go to Settings',                category: 'Navigation', keys: ['G', 'S'],           description: 'Navigate to /settings' },
  { id: 'research',        label: 'Go to Research',                category: 'Navigation', keys: ['G', 'R'],           description: 'Navigate to /research' },
  { id: 'tasks',           label: 'Go to Tasks',                   category: 'Navigation', keys: ['G', 'T'],           description: 'Navigate to /tasks' },

  // Chat
  { id: 'send-message',    label: 'Send message',                  category: 'Chat',       keys: ['Enter'],            description: 'Send the typed message' },
  { id: 'newline',         label: 'New line in message',           category: 'Chat',       keys: ['Shift', 'Enter'],   description: 'Insert a line break without sending' },
  { id: 'stop-stream',     label: 'Stop generation',              category: 'Chat',       keys: ['Escape'],           description: 'Stop the current AI response' },
  { id: 'copy-last',       label: 'Copy last response',            category: 'Chat',       keys: ['Ctrl', 'Shift', 'C'], description: 'Copy the most recent assistant message' },

  // Panels
  { id: 'open-memory',     label: 'Toggle Memory panel',           category: 'Panels',     keys: ['Ctrl', 'M'],        description: 'Open or close the Memory panel' },
  { id: 'open-skills',     label: 'Toggle Skills panel',           category: 'Panels',     keys: ['Ctrl', 'Shift', 'S'], description: 'Open or close the Skills panel' },
  { id: 'open-notes',      label: 'Toggle Notes panel',            category: 'Panels',     keys: ['Ctrl', 'Shift', 'N'], description: 'Open or close the Notes panel' },

  // UI
  { id: 'toggle-sidebar',  label: 'Collapse sidebar',              category: 'UI',         keys: ['['],               description: 'Toggle the left sidebar between expanded and icon-only' },
  { id: 'shortcut-help',   label: 'Show keyboard shortcuts',       category: 'UI',         keys: ['?'],               description: 'Open this keyboard shortcuts reference' },
  { id: 'theme-cycle',     label: 'Cycle theme',                   category: 'UI',         keys: ['Ctrl', 'Shift', 'T'], description: 'Cycle through Dark / Light / Midnight / Forest' },

  // Notes (active when Notes panel is open)
  { id: 'save-note',       label: 'Save note',                     category: 'Notes',      keys: ['Ctrl', 'S'],        description: 'Save the currently open note' },
];

// Group shortcuts by category for display
export function groupShortcuts(): Record<string, Shortcut[]> {
  return SHORTCUTS.reduce<Record<string, Shortcut[]>>((acc, s) => {
    if (!acc[s.category]) acc[s.category] = [];
    acc[s.category].push(s);
    return acc;
  }, {});
}
```

---

## Step 2 - useShortcut Hook

Create `src/hooks/useShortcut.ts`:

```ts
'use client';
import { useEffect } from 'react';

type Modifier = 'ctrlKey' | 'metaKey' | 'shiftKey' | 'altKey';

interface ShortcutOptions {
  keys:        string[];
  handler:     (e: KeyboardEvent) => void;
  enabled?:    boolean;
  // If true, also fires when an input/textarea is focused.
  // Default: false (won't fire inside inputs)
  allowInInput?: boolean;
}

function matches(e: KeyboardEvent, keys: string[]): boolean {
  const modifiers: Record<string, Modifier> = {
    Ctrl: 'ctrlKey', Meta: 'metaKey', Shift: 'shiftKey', Alt: 'altKey',
  };
  const requiredMods = keys.filter((k) => modifiers[k]);
  const mainKey = keys.find((k) => !modifiers[k]);
  if (!mainKey) return false;
  if (e.key.toLowerCase() !== mainKey.toLowerCase()) return false;
  for (const mod of requiredMods) {
    if (!(e as unknown as Record<string, boolean>)[modifiers[mod]]) return false;
  }
  return true;
}

export function useShortcut({ keys, handler, enabled = true, allowInInput = false }: ShortcutOptions) {
  useEffect(() => {
    if (!enabled) return;
    function onKey(e: KeyboardEvent) {
      if (!allowInInput) {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.contentEditable === 'true') return;
      }
      if (matches(e, keys)) {
        e.preventDefault();
        handler(e);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [keys.join('+'), enabled, handler]);
}
```

---

## Step 3 - Global Shortcut Provider

Create `src/components/shell/GlobalShortcuts.tsx` - a client component that wires all app-wide shortcuts. Mount this inside the workspace layout once, below `ThemeProvider`.

```tsx
'use client';
import { useRouter } from 'next/navigation';
import { useCallback } from 'react';
import { useShortcut } from '@/hooks/useShortcut';
import { THEMES } from '@/lib/themes';

const THEME_ORDER = ['dark', 'light', 'midnight', 'forest'] as const;

export function GlobalShortcuts() {
  const router = useRouter();

  // Go to Library: G then L (two-key sequence)
  // Implement as a simple sequence: first keydown sets a pending flag with a 1s timeout
  // For simplicity, implement as global keydown listener with sequence tracking
  // See Step 4 for the SequenceShortcuts sub-component

  useShortcut({
    keys: ['Ctrl', 'M'],
    handler: useCallback(() => {
      document.dispatchEvent(new CustomEvent('open-panel', { detail: 'memory' }));
    }, []),
  });

  useShortcut({
    keys: ['Ctrl', 'Shift', 'S'],
    handler: useCallback(() => {
      document.dispatchEvent(new CustomEvent('open-panel', { detail: 'skills' }));
    }, []),
  });

  useShortcut({
    keys: ['Ctrl', 'Shift', 'N'],
    handler: useCallback(() => {
      document.dispatchEvent(new CustomEvent('open-panel', { detail: 'notes' }));
    }, []),
  });

  useShortcut({
    keys: ['Ctrl', 'Shift', 'T'],
    handler: useCallback(() => {
      const current = document.documentElement.getAttribute('data-theme') ?? 'dark';
      const idx = THEME_ORDER.indexOf(current as typeof THEME_ORDER[number]);
      const next = THEME_ORDER[(idx + 1) % THEME_ORDER.length];
      document.dispatchEvent(new CustomEvent('set-theme', { detail: next }));
      // Persist the theme change
      fetch('/api/workspace/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme: next }),
      }).catch(() => {});
    }, []),
  });

  useShortcut({
    keys: ['?'],
    handler: useCallback(() => {
      document.dispatchEvent(new CustomEvent('open-shortcuts-panel'));
    }, []),
  });

  useShortcut({
    keys: ['['],
    handler: useCallback(() => {
      document.dispatchEvent(new CustomEvent('toggle-sidebar'));
    }, []),
  });

  useShortcut({
    keys: ['Ctrl', 'Alt', 'N'],
    handler: useCallback(async () => {
      const res = await fetch('/api/sessions', { method: 'POST' });
      const d = await res.json();
      if (d.data?.id) router.push(`/chat/${d.data.id}`);
    }, [router]),
  });

  // Sequence shortcuts (G+L, G+S, G+R, G+T) handled by SequenceShortcuts below
  return <SequenceShortcuts />;
}

// Two-key Go shortcuts: G then <key>
function SequenceShortcuts() {
  const router = useRouter();

  useEffect(() => {
    let pendingG = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      if (pendingG) {
        if (timer) clearTimeout(timer);
        pendingG = false;
        switch (e.key.toLowerCase()) {
          case 'l': router.push('/library'); break;
          case 's': router.push('/settings'); break;
          case 'r': router.push('/research'); break;
          case 't': router.push('/tasks'); break;
        }
        return;
      }

      if (e.key === 'g' && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey) {
        pendingG = true;
        timer = setTimeout(() => { pendingG = false; }, 1000);
      }
    }

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [router]);

  return null;
}

// Fix missing import
import { useEffect } from 'react';
```

---

## Step 4 - Shortcuts Panel (? key)

Create `src/components/shell/ShortcutsPanel.tsx`:

```tsx
'use client';
import { useState, useEffect } from 'react';
import { X, Keyboard } from 'lucide-react';
import { groupShortcuts, SHORTCUTS } from '@/lib/shortcuts';
import { Kbd } from '@/components/ui/Kbd';
import { cn } from '@/lib/utils';

export function ShortcutsPanel() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function handler() { setOpen((v) => !v); }
    document.addEventListener('open-shortcuts-panel', handler);
    return () => document.removeEventListener('open-shortcuts-panel', handler);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (!open) return null;

  const grouped = groupShortcuts();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="relative w-full max-w-2xl max-h-[80vh] overflow-hidden rounded-xl border border-border bg-surface shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4 shrink-0">
          <div className="flex items-center gap-2">
            <Keyboard className="h-4 w-4 text-text-muted" />
            <span className="text-sm font-semibold text-text-primary">Keyboard shortcuts</span>
          </div>
          <button onClick={() => setOpen(false)} className="text-text-muted hover:text-text-secondary">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Grid of categories */}
        <div className="overflow-y-auto p-5 grid grid-cols-1 gap-6 sm:grid-cols-2">
          {Object.entries(grouped).map(([cat, shortcuts]) => (
            <div key={cat}>
              <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-wider text-text-muted">{cat}</p>
              <div className="space-y-1.5">
                {shortcuts.map((s) => (
                  <div key={s.id} className="flex items-center justify-between gap-4">
                    <span className="text-xs text-text-secondary">{s.label}</span>
                    <div className="flex items-center gap-0.5 shrink-0">
                      {s.keys.map((k, i) => (
                        <span key={i} className="flex items-center gap-0.5">
                          {i > 0 && <span className="text-[10px] text-text-muted">+</span>}
                          <Kbd>{k}</Kbd>
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="border-t border-border px-5 py-2.5 shrink-0">
          <p className="text-[10px] text-text-muted">Press <Kbd>?</Kbd> or <Kbd>Esc</Kbd> to close</p>
        </div>
      </div>

      {/* Backdrop */}
      <div className="absolute inset-0 -z-10" onClick={() => setOpen(false)} />
    </div>
  );
}
```

---

## Step 5 - Wire Into Workspace Layout

Update `src/app/(workspace)/layout.tsx` to include both `GlobalShortcuts` and `ShortcutsPanel`:

```tsx
import { GlobalShortcuts } from '@/components/shell/GlobalShortcuts';
import { ShortcutsPanel } from '@/components/shell/ShortcutsPanel';

// In the return, alongside CommandPalette:
<GlobalShortcuts />
<ShortcutsPanel />
```

---

## Step 6 - Add Shortcuts Section to Settings Page

In `src/app/(workspace)/settings/page.tsx`, add a Shortcuts nav item and section:

```tsx
// Add to navItems:
{ id: 'shortcuts', label: 'Shortcuts', icon: <Keyboard className="h-4 w-4" /> },

// Add section content:
{activeSection === 'shortcuts' && (
  <div className="space-y-6">
    <div>
      <h2 className="text-base font-semibold text-text-primary mb-1">Keyboard shortcuts</h2>
      <p className="text-xs text-text-muted">Press <Kbd>?</Kbd> anywhere to see this list as an overlay</p>
    </div>
    {Object.entries(groupShortcuts()).map(([cat, shortcuts]) => (
      <div key={cat} className="border-t border-border pt-4">
        <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-text-muted">{cat}</h3>
        <div className="space-y-2">
          {shortcuts.map((s) => (
            <div key={s.id} className="flex items-center justify-between py-1.5">
              <div>
                <p className="text-sm text-text-primary">{s.label}</p>
                <p className="text-[11px] text-text-muted mt-0.5">{s.description}</p>
              </div>
              <div className="flex items-center gap-0.5 shrink-0 ml-4">
                {s.keys.map((k, i) => (
                  <span key={i} className="flex items-center gap-0.5">
                    {i > 0 && <span className="text-[10px] text-text-muted">+</span>}
                    <Kbd>{k}</Kbd>
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    ))}
  </div>
)}
```

Import `groupShortcuts` from `@/lib/shortcuts` and `Kbd` from `@/components/ui/Kbd`.

---

## Verification

After this prompt:
1. Pressing `?` anywhere (outside an input) opens the shortcuts panel
2. The panel shows all shortcuts grouped by category (Navigation, Chat, Panels, UI, Notes)
3. Escape closes the shortcuts panel
4. Clicking the backdrop closes the panel
5. Ctrl+M opens/closes the Memory panel
6. Ctrl+Shift+S opens/closes the Skills panel
7. Ctrl+Shift+N opens/closes the Notes panel
8. Ctrl+Shift+T cycles through Dark / Light / Midnight / Forest themes live
9. `[` collapses/expands the sidebar (dispatches toggle-sidebar event which AppSidebar listens to)
10. Ctrl+Alt+N creates a new session and navigates to it
11. `G` then `L` navigates to /library within 1 second
12. `G` then `S` navigates to /settings
13. `G` then `R` navigates to /research
14. `G` then `T` navigates to /tasks
15. Settings page has a Shortcuts tab showing the same list with descriptions
16. TypeScript builds without errors
