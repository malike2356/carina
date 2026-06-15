import { describe, expect, it } from 'vitest';
import { findWatchMatches, formatWatchMessage } from './process-watch.js';

describe('process-watch', () => {
  it('matches output lines against regex rules', () => {
    const rules = [{ pattern: 'BUILD SUCCESS', once: true }];
    const matched = new Set<string>();
    const hits = findWatchMatches(rules, ['compiling...', 'BUILD SUCCESS'], matched);
    expect(hits).toHaveLength(1);
    expect(hits[0]?.line).toBe('BUILD SUCCESS');
    expect(matched.has('BUILD SUCCESS:i')).toBe(true);
  });

  it('skips already matched once rules', () => {
    const rules = [{ pattern: 'error', once: true }];
    const matched = new Set(['error:i']);
    const hits = findWatchMatches(rules, ['error: disk full'], matched);
    expect(hits).toHaveLength(0);
  });

  it('formats watch notification messages', () => {
    const msg = formatWatchMessage(
      { pattern: 'done', message: 'Build finished' },
      'done',
      'npm run build',
    );
    expect(msg).toContain('Build finished');
    expect(msg).toContain('npm run build');
  });
});
