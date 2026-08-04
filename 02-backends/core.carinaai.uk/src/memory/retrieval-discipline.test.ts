import { describe, expect, it } from 'vitest';
import {
  buildRetrievalDisciplineBlock,
  buildSessionRecallHint,
  matchSessionRecallTriggers,
  shouldInjectCrossSessionRecall,
} from './retrieval-discipline.js';

describe('retrieval discipline', () => {
  it('documents on-demand retrieval policy', () => {
    const block = buildRetrievalDisciplineBlock();
    expect(block).toContain('Retrieval discipline:');
    expect(block).toContain('session-search');
    expect(block).toContain('memory(action="search")');
  });

  it('matches prior-session references', () => {
    const matches = matchSessionRecallTriggers('Can we continue where we left off yesterday?');
    expect(matches.length).toBeGreaterThan(0);
    expect(shouldInjectCrossSessionRecall('What did we decide last time?')).toBe(true);
  });

  it('does not match ordinary task messages', () => {
    expect(shouldInjectCrossSessionRecall('Fix the login bug in auth.ts')).toBe(false);
    expect(buildSessionRecallHint('Deploy the API')).toBeNull();
  });

  it('builds a runtime recall hint when triggers match', () => {
    const hint = buildSessionRecallHint('Do you remember what we discussed earlier?');
    expect(hint).toContain('Retrieval hint:');
    expect(hint).toContain('session-search');
  });

  it('prefers this-conversation evidence for CV / know-about-me follow-ups', () => {
    const knowMe = buildSessionRecallHint('from my cvs, what do you know about me?');
    expect(knowMe).toContain('THIS conversation');
    expect(knowMe).toContain('just-read documents');

    const readAll = buildSessionRecallHint('read all');
    expect(readAll).toContain('Continue the current thread');
  });
});
