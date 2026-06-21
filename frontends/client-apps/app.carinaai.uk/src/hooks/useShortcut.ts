'use client';

import { useEffect } from 'react';

type Modifier = 'ctrlKey' | 'metaKey' | 'shiftKey' | 'altKey';

interface ShortcutOptions {
  keys: string[];
  handler: (event: KeyboardEvent) => void;
  enabled?: boolean;
  allowInInput?: boolean;
}

const modifiers: Record<string, Modifier> = {
  Ctrl: 'ctrlKey',
  Meta: 'metaKey',
  Shift: 'shiftKey',
  Alt: 'altKey',
};

function matches(event: KeyboardEvent, keys: string[]): boolean {
  const requiredMods = keys.filter((key) => modifiers[key]);
  const mainKey = keys.find((key) => !modifiers[key]);
  if (!mainKey) return false;

  if (event.key.toLowerCase() !== mainKey.toLowerCase()) return false;

  for (const modifier of Object.values(modifiers)) {
    const required = requiredMods.some((key) => modifiers[key] === modifier);
    if (mainKey === '?' && modifier === 'shiftKey') continue;
    if (event[modifier] !== required) return false;
  }

  return true;
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable;
}

export function useShortcut({
  keys,
  handler,
  enabled = true,
  allowInInput = false,
}: ShortcutOptions) {
  useEffect(() => {
    if (!enabled) return;

    function onKeyDown(event: KeyboardEvent) {
      if (!allowInInput && isEditableTarget(event.target)) return;
      if (!matches(event, keys)) return;
      event.preventDefault();
      handler(event);
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [keys.join('+'), enabled, allowInInput, handler]);
}
