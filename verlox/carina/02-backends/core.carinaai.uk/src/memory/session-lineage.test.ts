import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('session-lineage', () => {
  let tmpHome: string;

  beforeEach(() => {
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'carina-lineage-'));
    vi.stubEnv('CARINA_HOME', tmpHome);
    vi.resetModules();
  });

  afterEach(() => {
    fs.rmSync(tmpHome, { recursive: true, force: true });
    vi.unstubAllEnvs();
  });

  it('records a continuation and retrieves parent', async () => {
    const { recordSessionContinuation, getSessionParent } = await import('./session-lineage.js');
    recordSessionContinuation('child-1', 'parent-1');
    expect(getSessionParent('child-1')).toBe('parent-1');
    expect(getSessionParent('parent-1')).toBeNull();
  });

  it('builds a chain from child to root', async () => {
    const { recordSessionContinuation, getSessionChain } = await import('./session-lineage.js');
    recordSessionContinuation('c', 'b');
    recordSessionContinuation('b', 'a');
    const chain = getSessionChain('c');
    expect(chain.map((e) => e.sessionId)).toEqual(['c', 'b', 'a']);
  });

  it('returns single-element chain for session with no parent', async () => {
    const { recordNewSession, getSessionChain } = await import('./session-lineage.js');
    recordNewSession('orphan');
    const chain = getSessionChain('orphan');
    expect(chain).toHaveLength(1);
    expect(chain[0]?.sessionId).toBe('orphan');
  });

  it('finds children of a session', async () => {
    const { recordSessionContinuation, getSessionChildren } = await import('./session-lineage.js');
    recordSessionContinuation('child-a', 'parent-x');
    recordSessionContinuation('child-b', 'parent-x');
    recordSessionContinuation('child-c', 'parent-y');
    const children = getSessionChildren('parent-x');
    expect(children.sort()).toEqual(['child-a', 'child-b']);
    expect(getSessionChildren('parent-y')).toEqual(['child-c']);
  });

  it('does not loop on circular references', async () => {
    const { recordSessionContinuation, getSessionChain } = await import('./session-lineage.js');
    recordSessionContinuation('s2', 's1');
    recordSessionContinuation('s1', 's2');
    const chain = getSessionChain('s1');
    expect(chain.length).toBeLessThan(5);
  });

  it('timestamps are recorded', async () => {
    const { recordSessionContinuation, getSessionChain } = await import('./session-lineage.js');
    recordSessionContinuation('ts-child', 'ts-parent');
    const chain = getSessionChain('ts-child');
    const child = chain.find((e) => e.sessionId === 'ts-child');
    expect(child?.timestamp).toBeTruthy();
    expect(() => new Date(child!.timestamp!)).not.toThrow();
  });

  it('recordNewSession is idempotent', async () => {
    const { recordNewSession } = await import('./session-lineage.js');
    recordNewSession('dup-session');
    const t1 = JSON.parse(
      fs.readFileSync(path.join(tmpHome, 'session-lineage.json'), 'utf-8'),
    ).timestamps['dup-session'];
    recordNewSession('dup-session');
    const t2 = JSON.parse(
      fs.readFileSync(path.join(tmpHome, 'session-lineage.json'), 'utf-8'),
    ).timestamps['dup-session'];
    expect(t1).toBe(t2);
  });

  it('generateSessionId returns a valid uuid', async () => {
    const { generateSessionId } = await import('./session-lineage.js');
    const id = generateSessionId();
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('getLineageRoot returns oldest ancestor', async () => {
    const { recordSessionContinuation, getLineageRoot } = await import('./session-lineage.js');
    recordSessionContinuation('child', 'parent');
    recordSessionContinuation('parent', 'root');
    expect(getLineageRoot('child')).toBe('root');
    expect(getLineageRoot('solo')).toBe('solo');
  });

  it('persists across module reloads', async () => {
    const { recordSessionContinuation } = await import('./session-lineage.js');
    recordSessionContinuation('reload-child', 'reload-parent');
    vi.resetModules();
    const { getSessionParent } = await import('./session-lineage.js');
    expect(getSessionParent('reload-child')).toBe('reload-parent');
  });
});
