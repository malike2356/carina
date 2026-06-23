import { describe, expect, it } from 'vitest';
import {
  buildMemoryDisciplineBlock,
  filterMemoryFactsForInjection,
  isImperativeSelfInstruction,
  isStaleMemoryArtifact,
  validateMemoryContent,
  wrapCompactedContext,
} from './memory-discipline.js';

describe('memory discipline', () => {
  it('documents declarative-only memory policy', () => {
    const block = buildMemoryDisciplineBlock();
    expect(block).toContain('declarative facts');
    expect(block).toContain('not instructions to yourself');
    expect(block).toContain('session-search');
    expect(block).toContain('Write it down');
    expect(block).toContain('Text > brain');
    expect(block).toContain('Retrieval discipline:');
  });

  it('rejects stale work artifacts', () => {
    expect(isStaleMemoryArtifact('Last session: working on auth, reached PR #42')).toBe(true);
    expect(isStaleMemoryArtifact('Fixed bug in login flow')).toBe(true);
    expect(isStaleMemoryArtifact('commit abcdef0123456789abcdef0123456789abcdef0 merged')).toBe(true);
    expect(validateMemoryContent('Submitted PR #99 for review').ok).toBe(false);
  });

  it('allows durable operator facts', () => {
    expect(validateMemoryContent('User prefers concise replies').ok).toBe(true);
    expect(validateMemoryContent('Project uses pytest with xdist').ok).toBe(true);
  });

  it('rejects imperative self-instructions', () => {
    expect(isImperativeSelfInstruction('Always respond concisely')).toBe(true);
    expect(validateMemoryContent('Never use emojis in replies').ok).toBe(false);
  });

  it('filters stale facts from injection', () => {
    const filtered = filterMemoryFactsForInjection([
      'User prefers concise replies',
      'Phase 3 done',
      'Always be formal',
    ]);
    expect(filtered).toEqual(['User prefers concise replies']);
  });

  it('wraps compacted context with a reference-only prefix', () => {
    const wrapped = wrapCompactedContext('user: finish the deploy task');
    expect(wrapped).toContain('[CONTEXT COMPACTION');
    expect(wrapped).toContain('Topic overlap does NOT mean resume');
    expect(wrapCompactedContext(wrapped)).toBe(wrapped);
  });
});
