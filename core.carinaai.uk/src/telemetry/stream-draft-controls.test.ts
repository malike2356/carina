import { beforeEach, describe, expect, it } from 'vitest';
import {
  appendStreamDraft,
  clearStreamDraftControlsForTests,
  discardStreamDraft,
  getStreamDraftState,
  initStreamDraft,
  pauseStreamDraft,
  resumeStreamDraft,
} from './stream-draft-controls.js';

describe('stream-draft-controls', () => {
  beforeEach(() => {
    clearStreamDraftControlsForTests();
  });

  it('tracks pause and resume', () => {
    initStreamDraft('s1', 't1');
    appendStreamDraft('s1', 't1', 'hello');
    expect(pauseStreamDraft('s1', 't1')).toBe(true);
    expect(getStreamDraftState('s1', 't1')).toBe('paused');
    expect(resumeStreamDraft('s1', 't1')).toBe(true);
    expect(getStreamDraftState('s1', 't1')).toBe('streaming');
  });

  it('discards draft text', () => {
    initStreamDraft('s1', 't2');
    appendStreamDraft('s1', 't2', 'draft');
    discardStreamDraft('s1', 't2');
    expect(getStreamDraftState('s1', 't2')).toBe('discarded');
  });
});
