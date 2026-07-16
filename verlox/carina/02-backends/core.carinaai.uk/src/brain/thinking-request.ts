let activeThinkingExtras: Record<string, unknown> | null = null;

export function setThinkingRequestExtras(extras: Record<string, unknown> | null): void {
  activeThinkingExtras = extras;
}

export function getThinkingRequestExtras(): Record<string, unknown> | null {
  return activeThinkingExtras;
}

export function clearThinkingRequestExtras(): void {
  activeThinkingExtras = null;
}
