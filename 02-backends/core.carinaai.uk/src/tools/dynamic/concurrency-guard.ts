let generationLock = false;
let currentGeneration: { label: string; startedAt: number; requestId: string } | null = null;

const MAX_GENERATION_TIME_MS = 120_000;

export function acquireGenerationLock(label: string, requestId: string): boolean {
  if (generationLock && currentGeneration) {
    if (Date.now() - currentGeneration.startedAt > MAX_GENERATION_TIME_MS) {
      console.warn(`Force-releasing stale generation lock: ${currentGeneration.label}`);
      releaseGenerationLock();
    } else {
      return false;
    }
  }

  generationLock = true;
  currentGeneration = { label, startedAt: Date.now(), requestId };
  return true;
}

export function releaseGenerationLock(): void {
  generationLock = false;
  currentGeneration = null;
}

export function getGenerationLockStatus(): { locked: boolean; currentLabel?: string; elapsedMs?: number } {
  if (!generationLock || !currentGeneration) return { locked: false };
  return {
    locked: true,
    currentLabel: currentGeneration.label,
    elapsedMs: Date.now() - currentGeneration.startedAt,
  };
}
