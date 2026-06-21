export type MemoryInjectionMode = 'off' | 'minimal' | 'full';

import { shouldInjectCrossSessionRecall } from './retrieval-discipline.js';

export function memoryInjectionMode(): MemoryInjectionMode {
  const raw = process.env.CARINA_MEMORY_INJECTION?.trim().toLowerCase();
  if (raw === 'off' || raw === 'minimal' || raw === 'full') return raw;
  return 'minimal';
}

export function memoryInjectionEnabled(): boolean {
  return memoryInjectionMode() !== 'off';
}

/** Whether to auto-inject cross-session episodic similarity hits for this turn. */
export function memoryInjectionIncludesSemantic(userMessage = ''): boolean {
  if (memoryInjectionMode() === 'off' || memoryInjectionMode() === 'minimal') return false;
  if (process.env.CARINA_MEMORY_AUTO_SEMANTIC === 'true') return true;
  return shouldInjectCrossSessionRecall(userMessage);
}
