import { atom } from 'nanostores';
export const $composerDraft = atom('');
export const $composerAttachments = atom([]);
export const $composerMode = atom('text');
export const $composerCodeLang = atom('');
export const $composerQueue = atom([]);
export const $composerQueueMode = atom(false);
export const $composerVoiceEnabled = atom(true);
