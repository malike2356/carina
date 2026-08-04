import { describe, expect, it } from 'vitest';
import {
  appendIncognitoTurn,
  clearIncognitoBuffer,
  getIncognitoHistory,
  isIncognitoSessionMarked,
  markIncognitoSession,
} from './incognito-buffer.js';
import { isWorkerIncognito } from '../../workers/incognito.js';

describe('incognito buffer', () => {
  it('stores turns only while marked', () => {
    const sessionId = 'aiva-worker-telegram-1';
    markIncognitoSession(sessionId, true);
    expect(isIncognitoSessionMarked(sessionId)).toBe(true);
    appendIncognitoTurn(sessionId, 'user', 'hello');
    appendIncognitoTurn(sessionId, 'assistant', 'hi');
    expect(getIncognitoHistory(sessionId, 10)).toHaveLength(2);
    markIncognitoSession(sessionId, false);
    expect(isIncognitoSessionMarked(sessionId)).toBe(false);
    expect(getIncognitoHistory(sessionId, 10)).toHaveLength(0);
  });

  it('clears buffer explicitly', () => {
    const sessionId = 'aiva-worker-web-app';
    markIncognitoSession(sessionId, true);
    appendIncognitoTurn(sessionId, 'user', 'secret');
    clearIncognitoBuffer(sessionId);
    expect(getIncognitoHistory(sessionId, 10)).toHaveLength(0);
  });
});

describe('isWorkerIncognito', () => {
  it('defaults off', () => {
    expect(isWorkerIncognito(undefined)).toBe(false);
    expect(isWorkerIncognito({})).toBe(false);
    expect(isWorkerIncognito({ privacy: { incognito: false } })).toBe(false);
  });

  it('reads privacy.incognito', () => {
    expect(isWorkerIncognito({ privacy: { incognito: true } })).toBe(true);
  });
});
