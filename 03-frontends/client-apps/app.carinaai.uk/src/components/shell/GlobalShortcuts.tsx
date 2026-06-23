'use client';

import { useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useShortcut } from '@/hooks/useShortcut';
import { useOptionalCanvasPanel } from '@/lib/canvas-panel';
import { useOptionalWindowManager } from '@/lib/window-manager/WindowManagerContext';

import { MULTI_THEME_IDS } from '@/lib/themes';
import {
  normalizeThemeId,
  persistThemePreference,
  readCookieThemePreference,
  readStoredThemePreference,
} from '@/lib/theme-runtime';

const THEME_ORDER = MULTI_THEME_IDS;

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
}

export function GlobalShortcuts() {
  const router = useRouter();
  const windowManager = useOptionalWindowManager();
  const canvasPanel = useOptionalCanvasPanel();

  useShortcut({
    keys: ['Ctrl', 'W'],
    handler: useCallback(() => {
      if (!windowManager?.focusedId) return;
      windowManager.closeWindow(windowManager.focusedId);
    }, [windowManager]),
  });

  useShortcut({
    keys: ['Ctrl', 'Shift', 'W'],
    handler: useCallback(() => {
      windowManager?.closeAllWindows();
    }, [windowManager]),
  });

  useShortcut({
    keys: ['Ctrl', ','],
    handler: useCallback(() => {
      router.push('/settings');
    }, [router]),
  });

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
      const stored =
        readStoredThemePreference() ??
        readCookieThemePreference() ?? { themeId: 'default', mode: 'dark' as const };
      const index = THEME_ORDER.indexOf(normalizeThemeId(stored.themeId));
      const nextTheme = THEME_ORDER[(index + 1) % THEME_ORDER.length] ?? 'default';
      const next = { ...stored, themeId: nextTheme };
      void persistThemePreference(next, { syncApi: true });
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
      const response = await fetch('/api/sessions', { method: 'POST' });
      const data = await response.json();
      if (data.data?.id) router.push(`/chat/${data.data.id}`);
    }, [router]),
  });

  useShortcut({
    keys: ['/'],
    handler: useCallback(() => {
      document.querySelector<HTMLTextAreaElement>('textarea[data-chat-input="true"]')?.focus();
    }, []),
  });

  useShortcut({
    keys: ['Ctrl', 'Shift', 'C'],
    handler: useCallback(() => {
      document.dispatchEvent(new CustomEvent('copy-last-response'));
    }, []),
  });

  useShortcut({
    keys: ['Ctrl', '`'],
    handler: useCallback(() => {
      document.dispatchEvent(new CustomEvent('open-panel', { detail: 'terminal' }));
    }, []),
  });

  useShortcut({
    keys: ['Escape'],
    handler: useCallback(() => {
      if (!canvasPanel?.state.open) return;
      canvasPanel.closePanel();
    }, [canvasPanel]),
  });

  return <SequenceShortcuts />;
}

function SequenceShortcuts() {
  const router = useRouter();

  useEffect(() => {
    let pendingG = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    function clearPending() {
      pendingG = false;
      if (timer) clearTimeout(timer);
      timer = null;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (isEditableTarget(event.target)) return;

      if (pendingG) {
        const key = event.key.toLowerCase();
        clearPending();
        if (key === 'l') router.push('/library');
        if (key === 's') router.push('/settings');
        if (key === 'r') router.push('/research');
        if (key === 't') router.push('/tasks');
        return;
      }

      if (event.key.toLowerCase() === 'g' && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) {
        pendingG = true;
        timer = setTimeout(clearPending, 1000);
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => {
      clearPending();
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [router]);

  return null;
}
