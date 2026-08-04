import { describe, expect, it } from 'vitest';
import {
  aivaWorkerMemoryScope,
  aivaWorkerSessionPrefix,
  isAivaSessionId,
  parseAivaWorkerIdFromSession,
  sessionBelongsToAivaWorker,
} from './session-isolation.js';

const WORKER = 'cbfccc8e-5406-47b2-a325-edb107793043';

describe('aiva session isolation', () => {
  it('parses worker id from session ids', () => {
    expect(parseAivaWorkerIdFromSession(`aiva-${WORKER}-web-contact-1`)).toBe(WORKER);
    expect(parseAivaWorkerIdFromSession(`aiva-${WORKER}-conv-aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee`)).toBe(WORKER);
    expect(parseAivaWorkerIdFromSession('cli-main')).toBeNull();
  });

  it('builds worker-scoped SQL', () => {
    expect(aivaWorkerSessionPrefix(WORKER)).toBe(`aiva-${WORKER}-`);
    expect(aivaWorkerMemoryScope(WORKER)).toEqual({
      sql: 'session_id LIKE $1',
      params: [`aiva-${WORKER}-%`],
    });
  });

  it('checks worker membership', () => {
    expect(isAivaSessionId(`aiva-${WORKER}-web-x`)).toBe(true);
    expect(sessionBelongsToAivaWorker(`aiva-${WORKER}-web-x`, WORKER)).toBe(true);
    expect(sessionBelongsToAivaWorker('aiva-00000000-0000-4000-8000-000000000000-web-x', WORKER)).toBe(false);
  });
});
