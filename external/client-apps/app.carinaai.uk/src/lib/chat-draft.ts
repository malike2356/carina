export function chatDraftKey(sessionId: string): string {
  const id = sessionId.trim();
  return `carina.chat.draft:${id || 'default'}`;
}

export function readChatDraft(sessionId: string): string {
  if (typeof window === 'undefined') return '';
  const key = chatDraftKey(sessionId);
  return window.localStorage.getItem(key) ?? '';
}

export function writeChatDraft(sessionId: string, value: string): void {
  if (typeof window === 'undefined') return;
  const key = chatDraftKey(sessionId);
  const text = value.trim();
  if (!text) {
    window.localStorage.removeItem(key);
    return;
  }
  window.localStorage.setItem(key, value);
}

export function clearChatDraft(sessionId: string): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(chatDraftKey(sessionId));
}
