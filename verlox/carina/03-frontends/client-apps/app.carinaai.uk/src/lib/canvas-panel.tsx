'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  clampWidth,
  readStoredCanvasPanelWidth,
  titleFromContent,
} from '@/lib/canvas-panel-utils';
import type { CanvasPanelLanguage, CanvasPanelPayload } from '@/lib/canvas-panel-types';

export type { CanvasPanelLanguage, CanvasPanelPayload } from '@/lib/canvas-panel-types';
export { clampWidth, titleFromContent, MIN_WIDTH } from '@/lib/canvas-panel-utils';

type CanvasPanelState = CanvasPanelPayload & {
  open: boolean;
  widthPx: number;
};

const WIDTH_STORAGE_KEY = 'carina-canvas-panel-width-v1';
const DEFAULT_WIDTH = 420;

type CanvasPanelContextValue = {
  state: CanvasPanelState;
  openPanel: (payload: CanvasPanelPayload) => void;
  closePanel: () => void;
  setWidth: (width: number) => void;
};

const CLOSED_STATE: CanvasPanelState = {
  open: false,
  content: '',
  language: 'artifact',
  title: 'Artifact',
  widthPx: DEFAULT_WIDTH,
};

const CanvasPanelContext = createContext<CanvasPanelContextValue | null>(null);

export function dispatchOpenCanvasPanel(payload: CanvasPanelPayload) {
  if (typeof document === 'undefined') return;
  document.dispatchEvent(new CustomEvent('open-canvas-panel', { detail: payload }));
}

export function stashCanvasPopout(payload: CanvasPanelPayload): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem('carina-canvas-popout-v1', JSON.stringify(payload));
  } catch {
    // ignore
  }
}

export function readCanvasPopout(): CanvasPanelPayload | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem('carina-canvas-popout-v1');
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CanvasPanelPayload;
    if (!parsed?.content) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function CanvasPanelProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<CanvasPanelState>(CLOSED_STATE);

  const openPanel = useCallback((payload: CanvasPanelPayload) => {
    setState({
      open: true,
      content: payload.content,
      language: payload.language,
      title: payload.title?.trim() || titleFromContent(payload.content, payload.language),
      widthPx: readStoredCanvasPanelWidth(),
    });
  }, []);

  const closePanel = useCallback(() => {
    setState((current) => ({ ...current, open: false }));
  }, []);

  const setWidth = useCallback((width: number) => {
    const next = clampWidth(width);
    setState((current) => ({ ...current, widthPx: next }));
    try {
      localStorage.setItem(WIDTH_STORAGE_KEY, String(next));
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    function onOpen(event: Event) {
      const detail = (event as CustomEvent<CanvasPanelPayload>).detail;
      if (!detail?.content) return;
      openPanel(detail);
    }
    document.addEventListener('open-canvas-panel', onOpen);
    return () => document.removeEventListener('open-canvas-panel', onOpen);
  }, [openPanel]);

  const value = useMemo(
    () => ({ state, openPanel, closePanel, setWidth }),
    [state, openPanel, closePanel, setWidth],
  );

  return <CanvasPanelContext.Provider value={value}>{children}</CanvasPanelContext.Provider>;
}

export function useCanvasPanel() {
  const ctx = useContext(CanvasPanelContext);
  if (!ctx) {
    throw new Error('useCanvasPanel must be used within CanvasPanelProvider');
  }
  return ctx;
}

export function useOptionalCanvasPanel() {
  return useContext(CanvasPanelContext);
}
