export type ResearchProgressPhase =
  | 'plan'
  | 'search'
  | 'extract'
  | 'verify'
  | 'synthesize'
  | 'quality_gate'
  | 'escalate'
  | 'retain'
  | 'done'
  | 'error';

export type ResearchProgressEvent = {
  phase: ResearchProgressPhase;
  message: string;
  detail?: Record<string, unknown>;
  at: string;
};

export type ResearchProgressHandler = (event: ResearchProgressEvent) => void;

export function emitResearchProgress(
  phase: ResearchProgressPhase,
  message: string,
  handler?: ResearchProgressHandler,
  detail?: Record<string, unknown>,
): void {
  handler?.({
    phase,
    message,
    detail,
    at: new Date().toISOString(),
  });
}

/** Legacy string progress lines for CLI and simple SSE consumers. */
export function legacyProgressLine(event: ResearchProgressEvent): string {
  const prefix = event.phase.toUpperCase().replace('_', ' ');
  return `[${prefix}] ${event.message}`;
}

export function researchProgressToSse(event: ResearchProgressEvent): string {
  return `data: ${JSON.stringify({ type: 'progress', ...event })}\n\n`;
}
