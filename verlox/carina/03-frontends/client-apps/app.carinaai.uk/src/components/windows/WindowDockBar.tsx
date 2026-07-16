'use client';

import { WINDOW_DEFINITIONS } from '@/lib/window-manager/definitions';
import { useWindowManager } from '@/lib/window-manager/WindowManagerContext';

export function WindowDockBar() {
  const { windows, restoreWindow } = useWindowManager();
  const minimized = windows.filter((windowState) => windowState.minimized);

  if (minimized.length === 0) return null;

  return (
    <div className="fixed bottom-3 left-14 z-50 flex max-w-[calc(100vw-5rem)] flex-wrap gap-1.5">
      {minimized.map((windowState) => (
        <button
          key={windowState.id}
          type="button"
          onClick={() => restoreWindow(windowState.id)}
          className="rounded-md border border-border bg-surface/95 px-2.5 py-1 text-xs text-text-secondary shadow-lg backdrop-blur hover:text-text-primary"
        >
          {WINDOW_DEFINITIONS[windowState.id].title}
        </button>
      ))}
    </div>
  );
}
