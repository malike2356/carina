import { describe, expect, it } from 'vitest';
import {
  beginParentTurn,
  canDelegate,
  createChildAbortController,
  endParentTurn,
  getDelegationDepth,
  isSubagentSession,
  setDelegationDepth,
} from './delegation-context.js';

describe('delegation-context', () => {
  it('tracks depth per session', () => {
    setDelegationDepth('parent', 0);
    setDelegationDepth('parent:sub:abc', 1);
    expect(getDelegationDepth('parent')).toBe(0);
    expect(getDelegationDepth('parent:sub:abc')).toBe(1);
    expect(canDelegate('parent')).toBe(true);
    expect(canDelegate('parent:sub:abc')).toBe(false);
  });

  it('identifies subagent sessions', () => {
    expect(isSubagentSession('cli-session:sub:123')).toBe(true);
    expect(isSubagentSession('cli-session')).toBe(false);
  });

  it('cancels child when parent turn ends', async () => {
    const parent = 'cancel-test';
    beginParentTurn(parent);
    const child = createChildAbortController(parent);
    expect(child.signal.aborted).toBe(false);
    endParentTurn(parent);
    expect(child.signal.aborted).toBe(true);
  });
});
