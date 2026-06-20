import { atom } from 'nanostores';
import type { SessionInfo } from '../lib/gateway-client.js';

export const $currentSessionId = atom<string | null>(null);
export const $sessions = atom<SessionInfo[]>([]);
export const $sessionLoading = atom(false);
