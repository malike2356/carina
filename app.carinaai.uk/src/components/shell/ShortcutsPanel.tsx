'use client';

import { useEffect, useState } from 'react';
import { Keyboard, X } from 'lucide-react';
import { Kbd } from '@/components/ui/Kbd';
import { groupShortcuts } from '@/lib/shortcuts';

export function ShortcutsPanel() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function togglePanel() {
      setOpen((current) => !current);
    }

    document.addEventListener('open-shortcuts-panel', togglePanel);
    return () => document.removeEventListener('open-shortcuts-panel', togglePanel);
  }, []);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' || event.key === '?') {
        event.preventDefault();
        setOpen(false);
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  if (!open) return null;

  const grouped = groupShortcuts();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        onClick={() => setOpen(false)}
        aria-label="Close keyboard shortcuts"
      />
      <div className="relative z-10 flex max-h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-2xl">
        <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2">
            <Keyboard className="h-4 w-4 text-text-muted" />
            <h2 className="text-sm font-semibold text-text-primary">Keyboard shortcuts</h2>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-text-muted transition-colors hover:text-text-secondary"
            aria-label="Close keyboard shortcuts"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-6 overflow-y-auto p-5 sm:grid-cols-2">
          {Object.entries(grouped).map(([category, shortcuts]) => (
            <section key={category}>
              <h3 className="mb-2.5 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                {category}
              </h3>
              <div className="space-y-1.5">
                {shortcuts.map((shortcut) => (
                  <div key={shortcut.id} className="flex items-center justify-between gap-4">
                    <span className="text-xs text-text-secondary">{shortcut.label}</span>
                    <span className="flex shrink-0 items-center gap-0.5">
                      {shortcut.keys.map((key, index) => (
                        <span key={`${shortcut.id}-${key}-${index}`} className="flex items-center gap-0.5">
                          {index > 0 && <span className="text-[10px] text-text-muted">+</span>}
                          <Kbd>{key}</Kbd>
                        </span>
                      ))}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>

        <div className="shrink-0 border-t border-border px-5 py-2.5">
          <p className="text-[10px] text-text-muted">
            Press <Kbd>?</Kbd> or <Kbd>Esc</Kbd> to close.
          </p>
        </div>
      </div>
    </div>
  );
}
