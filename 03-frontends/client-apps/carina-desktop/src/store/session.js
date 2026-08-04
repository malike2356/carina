import { atom } from 'nanostores';
export const $currentSessionId = atom(null);
export const $sessions = atom([]);
export const $sessionLoading = atom(false);
