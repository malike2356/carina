'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { usePathname } from 'next/navigation';
import type { ManagedWindowState, WindowDockSide, WorkspaceWindowId } from './types';
import {
  WINDOW_DEFINITIONS,
  defaultWindowMode,
  isDockableWindow,
  isSidePanelId,
  isWindowRouteActive,
  normalizeWindowState,
  panelIdToWindowId,
} from './definitions';

const OPEN_WINDOWS_KEY = 'carina-open-windows-v4';
const BASE_Z = 40;

interface WindowManagerContextValue {
  windows: ManagedWindowState[];
  openWindow: (id: WorkspaceWindowId) => void;
  closeWindow: (id: WorkspaceWindowId) => void;
  toggleWindow: (id: WorkspaceWindowId) => void;
  focusWindow: (id: WorkspaceWindowId) => void;
  minimizeWindow: (id: WorkspaceWindowId) => void;
  restoreWindow: (id: WorkspaceWindowId) => void;
  maximizeWindow: (id: WorkspaceWindowId) => void;
  restoreWindowSize: (id: WorkspaceWindowId) => void;
  setWindowMode: (id: WorkspaceWindowId, mode: 'docked' | 'floating') => void;
  setWindowDock: (id: WorkspaceWindowId, dock: WindowDockSide | null) => void;
  closeAllWindows: () => void;
  isOpen: (id: WorkspaceWindowId) => boolean;
  focusedId: WorkspaceWindowId | null;
}

const WindowManagerContext = createContext<WindowManagerContextValue | null>(null);

function dedupeWindowIds(ids: WorkspaceWindowId[]): WorkspaceWindowId[] {
  const seen = new Set<WorkspaceWindowId>();
  const result: WorkspaceWindowId[] = [];
  for (const id of ids) {
    if (seen.has(id)) continue;
    seen.add(id);
    result.push(id);
  }
  return result;
}

function dedupeWindowStates(states: ManagedWindowState[]): ManagedWindowState[] {
  const byId = new Map<WorkspaceWindowId, ManagedWindowState>();
  for (const state of states) {
    const existing = byId.get(state.id);
    if (!existing || state.zIndex >= existing.zIndex) {
      byId.set(state.id, state);
    }
  }
  return [...byId.values()];
}

function readStoredOpenWindows(): WorkspaceWindowId[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(OPEN_WINDOWS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const valid = parsed.filter(
      (id): id is WorkspaceWindowId => id in WINDOW_DEFINITIONS && !isSidePanelId(id as WorkspaceWindowId),
    );
    return dedupeWindowIds(valid);
  } catch {
    return [];
  }
}

function writeStoredOpenWindows(ids: WorkspaceWindowId[]) {
  try {
    localStorage.setItem(
      OPEN_WINDOWS_KEY,
      JSON.stringify(dedupeWindowIds(ids.filter((id) => !isSidePanelId(id)))),
    );
  } catch {
    // ignore
  }
}

function makeWindow(id: WorkspaceWindowId, zIndex: number): ManagedWindowState {
  return normalizeWindowState({
    id,
    minimized: false,
    maximized: false,
    mode: defaultWindowMode(id),
    zIndex,
    dock: null,
  });
}

export function WindowManagerProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [windows, setWindows] = useState<ManagedWindowState[]>([]);
  const zCounter = useRef(BASE_Z);
  const cascade = useRef(0);
  const hydrated = useRef(false);

  useEffect(() => {
    if (hydrated.current) return;
    hydrated.current = true;
    const stored = readStoredOpenWindows();
    if (stored.length === 0) return;
    // Restore at most one window (the last opened) to enforce single-window policy
    const last = stored[stored.length - 1];
    setWindows([makeWindow(last, BASE_Z + 1)]);
    zCounter.current = BASE_Z + 2;
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    writeStoredOpenWindows(windows.map((w) => w.id));
  }, [windows]);

  useEffect(() => {
    setWindows((current) => {
      const next = current.filter((w) => !isWindowRouteActive(w.id, pathname));
      return next.length === current.length ? current : next;
    });
  }, [pathname]);

  const focusWindow = useCallback((id: WorkspaceWindowId) => {
    zCounter.current += 1;
    setWindows((current) =>
      current.map((w) =>
        w.id === id ? { ...w, zIndex: zCounter.current, minimized: false } : w,
      ),
    );
  }, []);

  const openWindow = useCallback(
    (id: WorkspaceWindowId) => {
      zCounter.current += 1;
      setWindows(() => [makeWindow(id, zCounter.current)]);
    },
    [],
  );

  const closeWindow = useCallback((id: WorkspaceWindowId) => {
    setWindows((current) => current.filter((w) => w.id !== id));
  }, []);

  const toggleWindow = useCallback(
    (id: WorkspaceWindowId) => {
      setWindows((current) => {
        const existing = current.find((w) => w.id === id);
        if (existing && !existing.minimized) {
          // Already open and visible: close it
          return current.filter((w) => w.id !== id);
        }
        // Close everything else, open only this window
        zCounter.current += 1;
        return [makeWindow(id, zCounter.current)];
      });
    },
    [],
  );

  useEffect(() => {
    function onOpenPanel(event: Event) {
      const panel = (event as CustomEvent).detail as string;
      const id = panelIdToWindowId(panel);
      if (id) toggleWindow(id);
    }

    function onOpenWindow(event: Event) {
      const id = (event as CustomEvent).detail as WorkspaceWindowId;
      if (id in WINDOW_DEFINITIONS) toggleWindow(id);
    }

    document.addEventListener('open-panel', onOpenPanel);
    document.addEventListener('open-window', onOpenWindow);
    return () => {
      document.removeEventListener('open-panel', onOpenPanel);
      document.removeEventListener('open-window', onOpenWindow);
    };
  }, [toggleWindow]);

  const minimizeWindow = useCallback((id: WorkspaceWindowId) => {
    setWindows((current) => current.map((w) => (w.id === id ? { ...w, minimized: true } : w)));
  }, []);

  const restoreWindow = useCallback((id: WorkspaceWindowId) => {
    focusWindow(id);
  }, [focusWindow]);

  const maximizeWindow = useCallback((id: WorkspaceWindowId) => {
    zCounter.current += 1;
    setWindows((current) =>
      current.map((w) =>
        w.id === id
          ? { ...w, maximized: true, mode: 'floating', minimized: false, zIndex: zCounter.current }
          : w,
      ),
    );
  }, []);

  const restoreWindowSize = useCallback((id: WorkspaceWindowId) => {
    setWindows((current) =>
      current.map((w) => (w.id === id ? { ...w, maximized: false } : w)),
    );
  }, []);

  const setWindowMode = useCallback((id: WorkspaceWindowId, mode: 'docked' | 'floating') => {
    if (mode === 'docked' && !isDockableWindow(id)) return;
    if (mode === 'floating') zCounter.current += 1;
    setWindows((current) =>
      current.map((w) =>
        w.id === id
          ? normalizeWindowState({
              ...w,
              mode,
              maximized: false,
              ...(mode === 'floating' ? { zIndex: zCounter.current } : {}),
            })
          : w,
      ),
    );
  }, []);

  const setWindowDock = useCallback((id: WorkspaceWindowId, dock: WindowDockSide | null) => {
    setWindows((current) => current.map((w) => (w.id === id ? { ...w, dock } : w)));
  }, []);

  const closeAllWindows = useCallback(() => {
    setWindows([]);
  }, []);

  const isOpen = useCallback(
    (id: WorkspaceWindowId) => windows.some((w) => w.id === id && !w.minimized),
    [windows],
  );

  const focusedId = useMemo(() => {
    if (windows.length === 0) return null;
    return [...windows].sort((a, b) => b.zIndex - a.zIndex)[0]?.id ?? null;
  }, [windows]);

  const value = useMemo(
    () => ({
      windows,
      openWindow,
      closeWindow,
      toggleWindow,
      focusWindow,
      minimizeWindow,
      restoreWindow,
      maximizeWindow,
      restoreWindowSize,
      setWindowMode,
      setWindowDock,
      closeAllWindows,
      isOpen,
      focusedId,
    }),
    [
      windows,
      openWindow,
      closeWindow,
      toggleWindow,
      focusWindow,
      minimizeWindow,
      restoreWindow,
      maximizeWindow,
      restoreWindowSize,
      setWindowMode,
      setWindowDock,
      closeAllWindows,
      isOpen,
      focusedId,
    ],
  );

  return <WindowManagerContext.Provider value={value}>{children}</WindowManagerContext.Provider>;
}

export function useWindowManager() {
  const ctx = useContext(WindowManagerContext);
  if (!ctx) {
    throw new Error('useWindowManager must be used within WindowManagerProvider');
  }
  return ctx;
}

export function useOptionalWindowManager() {
  return useContext(WindowManagerContext);
}

export function getWindowCascadeOffset(index: number): { x: number; y: number } {
  const step = 24;
  const offset = (index % 12) * step;
  return { x: 48 + offset, y: 48 + offset };
}
