import { describe, expect, it } from 'vitest';
import { lintPackSkill } from './skill-lint.js';

describe('skill-lint', () => {
  it('accepts a well-formed skill', () => {
    const result = lintPackSkill({
      name: 'workspace-notes',
      description: 'Manage workspace notes and follow-ups for the operator.',
      trigger: ['notes', 'workspace tasks'],
      steps: '1. Use notes-manage to list open items.\n2. Summarize blockers for the operator.',
      toolsUsed: ['notes-manage'],
    }, 'operator-daily');
    expect(result.ok).toBe(true);
    expect(result.issues.filter((i) => i.level === 'error')).toHaveLength(0);
  });

  it('rejects invalid skill names and short steps', () => {
    const result = lintPackSkill({
      name: 'Bad Name',
      description: 'short',
      trigger: [],
      steps: 'too short',
    });
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.code === 'name.format')).toBe(true);
    expect(result.issues.some((i) => i.code === 'steps.short')).toBe(true);
  });
});
