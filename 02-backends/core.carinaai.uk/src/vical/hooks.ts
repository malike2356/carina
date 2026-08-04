import type { VcalDomainHook, VcalHookListener } from './types.js';

const listeners = new Set<VcalHookListener>();

export function onVcalHook(listener: VcalHookListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function emitVcalHook(hook: VcalDomainHook): void {
  for (const listener of listeners) {
    try {
      listener(hook);
    } catch {
      // Side-effect listeners must not break lifecycle.
    }
  }
}
