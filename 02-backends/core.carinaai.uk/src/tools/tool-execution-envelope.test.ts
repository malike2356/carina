import { describe, expect, it } from 'vitest';
import { toolFailure, toolSuccess } from './tool-execution-envelope.js';

describe('tool execution envelope', () => {
  it('returns truthful success with provenance', () => {
    const result = toolSuccess({ tool: 'gmail', action: 'draft', workspaceId: 'w1', workerId: 'aiva', data: { id: 'd1' } });
    expect(result.ok).toBe(true);
    expect(result.provenance.workspaceId).toBe('w1');
  });

  it('classifies failures without claiming success', () => {
    const result = toolFailure({ tool: 'calendar', action: 'create', workspaceId: 'w1', workerId: 'aiva', error: new Error('request timed out') });
    expect(result.ok).toBe(false);
    expect(result.retryable).toBe(true);
    expect(result.failureClass).toBe('timeout');
    expect(result.userSummary).not.toMatch(/completed successfully/i);
  });
});
