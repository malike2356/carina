export type ChatErrorCode =
  | 'NO_BYOK_KEYS'
  | 'CORE_PROXY_FAILED'
  | 'PROVIDER_ERROR'
  | 'CHAT_FAILED';

export interface ChatErrorPayload {
  error: string;
  code?: ChatErrorCode;
}

export class ChatStreamError extends Error {
  readonly code: ChatErrorCode;

  constructor(message: string, code: ChatErrorCode) {
    super(message);
    this.name = 'ChatStreamError';
    this.code = code;
  }
}

export function chatErrorPayload(message: string, code: ChatErrorCode): ChatErrorPayload {
  return { error: message, code };
}

export function formatChatErrorForDisplay(payload: ChatErrorPayload): string {
  if (payload.code === 'NO_BYOK_KEYS') {
    return `${payload.error} Go to Settings > Keys: /settings/keys`;
  }
  if (payload.code === 'CORE_PROXY_FAILED') {
    return 'Carina could not reach the agent backend. Check Settings or try again.';
  }
  return payload.error;
}

export function isNoByokKeysMessage(message: string): boolean {
  return message.includes('Add at least one provider key');
}
