let activeMaxCompletionTokens: number | null = null;

export function setMaxCompletionTokens(maxTokens: number | null): void {
  if (maxTokens == null || !Number.isFinite(maxTokens) || maxTokens <= 0) {
    activeMaxCompletionTokens = null;
    return;
  }
  activeMaxCompletionTokens = Math.floor(maxTokens);
}

export function getMaxCompletionTokens(fallback = 8192): number {
  return activeMaxCompletionTokens ?? fallback;
}

export function clearMaxCompletionTokens(): void {
  activeMaxCompletionTokens = null;
}
