import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

describe('session-scope', () => {
  let tmpHome: string;

  beforeEach(() => {
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'carina-scope-'));
    vi.stubEnv('CARINA_HOME', tmpHome);
    vi.stubEnv('CARINA_PROFILE', 'default');
    vi.resetModules();
  });

  afterEach(() => {
    fs.rmSync(tmpHome, { recursive: true, force: true });
    vi.unstubAllEnvs();
  });

  it('keeps default profile session ids unprefixed', async () => {
    const { storageSessionId } = await import('./session-scope.js');
    expect(storageSessionId('abc-123')).toBe('abc-123');
  });

  it('prefixes non-default profile session ids', async () => {
    vi.stubEnv('CARINA_PROFILE', 'work');
    vi.resetModules();
    const { storageSessionId } = await import('./session-scope.js');
    expect(storageSessionId('abc-123')).toBe('profile:work:abc-123');
  });

  it('allocates tracked sessions with lineage timestamps', async () => {
    const { allocateGatewaySession } = await import('./session-scope.js');
    const { getSessionChain } = await import('./session-lineage.js');
    const parent = allocateGatewaySession();
    const child = allocateGatewaySession(parent);
    const chain = getSessionChain(child);
    expect(chain.map((e) => e.sessionId)).toEqual([child, parent]);
  });

  it('tracks child subagent sessions', async () => {
    const { trackChildSession } = await import('./session-scope.js');
    const { getSessionParent } = await import('./session-lineage.js');
    trackChildSession('parent:sub:1', 'parent');
    expect(getSessionParent('parent:sub:1')).toBe('parent');
  });
});
