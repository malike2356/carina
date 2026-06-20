'use client';

import { useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useShortcut } from '@/hooks/useShortcut';

const THEME_ORDER = ['dark', 'light', 'midnight', 'forest'] as const;

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
}

export function GlobalShortcuts() {
  const router = useRouter();

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
      const index = THEME_ORDER.indexOf(current as (typeof THEME_ORDER)[number]);
      const next = THEME_ORDER[(index + 1) % THEME_ORDER.length];
      document.dispatchEvent(new CustomEvent('set-theme', { detail: next }));
      void fetch('/api/workspace/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme: next }),
      });
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
