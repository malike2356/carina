import { atom } from 'nanostores';
export const $messages = atom([]);
export const $streamingMessageId = atom(null);
export const $isStreaming = atom(false);
export const $currentTurnId = atom(null);
export const $streamRequest = atom(null);
export const $pendingApproval = atom(null);
