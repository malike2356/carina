import { atom } from 'nanostores';
import type { Attachment } from '../lib/composer-types.js';

export const $composerDraft = atom('');
export const $composerAttachments = atom<Attachment[]>([]);
export const $composerMode = atom<'text' | 'code'>('text');
export const $composerCodeLang = atom('');
export const $composerQueue = atom<string[]>([]);
export const $composerQueueMode = atom(false);
export const $composerVoiceEnabled = atom(true);
