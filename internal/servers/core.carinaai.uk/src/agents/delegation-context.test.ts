import { afterEach, describe, expect, it } from 'vitest';
import {
  beginParentTurn,
  canDelegate,
  createChildAbortController,
  endParentTurn,
  getDelegationDepth,
  getMaxDelegationDepth,
  isSubagentSession,
  resetDelegationState,
  setDelegationDepth,
  setSubagentRole,
} from './delegation-context.js';

describe('delegation-context', () => {
  const originalDepth = process.env.CARINA_MAX_DELEGATION_DEPTH;

  afterEach(() => {
    resetDelegationState();
    if (originalDepth === undefined) delete process.env.CARINA_MAX_DELEGATION_DEPTH;
    else process.env.CARINA_MAX_DELEGATION_DEPTH = originalDepth;
  });

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

  it('leaf subagents cannot delegate even with depth budget', () => {
    process.env.CARINA_MAX_DELEGATION_DEPTH = '2';
    setDelegationDepth('parent:sub:leaf', 1);
    setSubagentRole('parent:sub:leaf', 'leaf');
    expect(canDelegate('parent:sub:leaf')).toBe(false);
  });

  it('orchestrator subagents can delegate when depth budget allows', () => {
    process.env.CARINA_MAX_DELEGATION_DEPTH = '2';
    setDelegationDepth('parent:sub:orch', 1);
    setSubagentRole('parent:sub:orch', 'orchestrator');
    expect(getMaxDelegationDepth()).toBe(2);
    expect(canDelegate('parent:sub:orch')).toBe(true);
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
