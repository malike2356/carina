export type MemoryInjectionMode = 'off' | 'minimal' | 'full';

export function memoryInjectionMode(): MemoryInjectionMode {
  const raw = process.env.CARINA_MEMORY_INJECTION?.trim().toLowerCase();
  if (raw === 'off' || raw === 'minimal' || raw === 'full') return raw;
  return 'full';
}

export function memoryInjectionEnabled(): boolean {
  return memoryInjectionMode() !== 'off';
}

export function memoryInjectionIncludesSemantic(): boolean {
  return memoryInjectionMode() === 'full';
}
