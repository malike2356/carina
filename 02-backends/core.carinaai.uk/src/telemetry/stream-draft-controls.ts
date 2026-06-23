export type StreamDraftState = 'streaming' | 'paused' | 'discarded' | 'completed';

type DraftSession = {
  state: StreamDraftState;
  draftText: string;
  updatedAt: number;
};

const sessions = new Map<string, DraftSession>();

function key(sessionId: string, turnId: string): string {
  return `${sessionId}:${turnId}`;
}

export function initStreamDraft(sessionId: string, turnId: string): void {
  sessions.set(key(sessionId, turnId), {
    state: 'streaming',
    draftText: '',
    updatedAt: Date.now(),
  });
}

export function appendStreamDraft(sessionId: string, turnId: string, chunk: string): void {
  const entry = sessions.get(key(sessionId, turnId));
  if (!entry || entry.state === 'discarded') return;
  entry.draftText += chunk;
  entry.updatedAt = Date.now();
}

export function pauseStreamDraft(sessionId: string, turnId: string): boolean {
  const entry = sessions.get(key(sessionId, turnId));
  if (!entry || entry.state !== 'streaming') return false;
  entry.state = 'paused';
  entry.updatedAt = Date.now();
  return true;
}

export function resumeStreamDraft(sessionId: string, turnId: string): boolean {
  const entry = sessions.get(key(sessionId, turnId));
  if (!entry || entry.state !== 'paused') return false;
  entry.state = 'streaming';
  entry.updatedAt = Date.now();
  return true;
}

export function discardStreamDraft(sessionId: string, turnId: string): boolean {
  const entry = sessions.get(key(sessionId, turnId));
  if (!entry) return false;
  entry.state = 'discarded';
  entry.draftText = '';
  entry.updatedAt = Date.now();
  return true;
}

export function completeStreamDraft(sessionId: string, turnId: string): string {
  const id = key(sessionId, turnId);
  const entry = sessions.get(id);
  if (!entry) return '';
  entry.state = 'completed';
  const text = entry.draftText;
  sessions.delete(id);
  return text;
}

export function getStreamDraftState(sessionId: string, turnId: string): StreamDraftState | null {
  return sessions.get(key(sessionId, turnId))?.state ?? null;
}

export function isStreamDraftPaused(sessionId: string, turnId: string): boolean {
  return getStreamDraftState(sessionId, turnId) === 'paused';
}

export function getStreamDraftPreview(sessionId: string, turnId: string): string {
  return sessions.get(key(sessionId, turnId))?.draftText ?? '';
}

export function clearStreamDraftControlsForTests(): void {
  sessions.clear();
}

export async function waitWhileStreamPaused(sessionId: string, turnId: string): Promise<void> {
  while (isStreamDraftPaused(sessionId, turnId)) {
    await new Promise((resolve) => setTimeout(resolve, 120));
  }
}
