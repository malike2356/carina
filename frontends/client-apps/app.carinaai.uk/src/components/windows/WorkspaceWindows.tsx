'use client';

import { useEffect } from 'react';
import { WINDOW_DEFINITIONS } from '@/lib/window-manager/definitions';
import { useWindowManager } from '@/lib/window-manager/WindowManagerContext';
import { WindowContent } from '@/components/windows/WindowContent';
import { WindowShell } from '@/components/windows/WindowShell';
import { WindowDockBar } from '@/components/windows/WindowDockBar';

export function WorkspaceWindows() {
  const {
    windows,
    focusedId,
    closeWindow,
    minimizeWindow,
    focusWindow,
    maximizeWindow,
    restoreWindowSize,
  } = useWindowManager();

  useEffect(() => {
    // Clear stale localStorage keys from older builds
    try {
      const toDelete: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (
          key &&
          (key.startsWith('carina-winpos') ||
            key.startsWith('carina-dock-left-') ||
            key.startsWith('carina-dock-right-') ||
            key.startsWith('carina-winsize') ||
            key === 'carina-open-windows-v3')
        ) {
          toDelete.push(key);
        }
      }
      toDelete.forEach((k) => localStorage.removeItem(k));
    } catch {
      // ignore
    }
  }, []);

  return (
    <>
      <div className="carina-window-layer pointer-events-none fixed inset-0">
        {windows.map((windowState, index) => {
          const definition = WINDOW_DEFINITIONS[windowState.id];
          return (
            <WindowShell
              key={windowState.id}
              windowId={windowState.id}
              definition={definition}
              zIndex={windowState.zIndex}
              minimized={windowState.minimized}
              focused={focusedId === windowState.id}
              maximized={windowState.maximized}
              onClose={() => closeWindow(windowState.id)}
              onMinimize={() => minimizeWindow(windowState.id)}
              onFocus={() => focusWindow(windowState.id)}
              onMaximize={() => maximizeWindow(windowState.id)}
              onRestoreSize={() => restoreWindowSize(windowState.id)}
            >
              <WindowContent windowId={windowState.id} />
            </WindowShell>
          );
        })}
      </div>

      <WindowDockBar />
    </>
  );
}
