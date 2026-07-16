'use client';

import { useCallback, useEffect, useState } from 'react';
import { EDITOR_ENGINE_STORAGE_KEY, type EditorEngine } from './types';

export function useEditorEngine(defaultEngine: EditorEngine = 'mdx') {
  const [engine, setEngineState] = useState<EditorEngine>(defaultEngine);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(EDITOR_ENGINE_STORAGE_KEY);
      if (stored === 'mdx' || stored === 'tiptap') {
        setEngineState(stored);
      }
    } catch {
      // ignore storage errors
    }
    setHydrated(true);
  }, []);

  const setEngine = useCallback((next: EditorEngine) => {
    setEngineState(next);
    try {
      localStorage.setItem(EDITOR_ENGINE_STORAGE_KEY, next);
    } catch {
      // ignore storage errors
    }
  }, []);

  return { engine, setEngine, hydrated };
}
