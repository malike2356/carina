import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('thread ownership', () => {
  let tmpHome: string;

  beforeEach(() => {
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'carina-thread-'));
    vi.stubEnv('CARINA_HOME', tmpHome);
    vi.stubEnv('CARINA_THREAD_OWNERSHIP', 'true');
    vi.stubEnv('CARINA_INSTANCE_ID', 'inst-a');
    vi.resetModules();
  });

  afterEach(() => {
    fs.rmSync(tmpHome, { recursive: true, force: true });
    vi.unstubAllEnvs();
  });

  it('acquires and blocks a second agent on the same thread', async () => {
    const {
      tryAcquireThreadOwnership,
      handoffThreadOwnership,
      releaseThreadOwnership,
      listOwnershipAudit,
    } = await import('./thread-ownership.js');

    const first = tryAcquireThreadOwnership({
      channel: 'slack',
      conversationId: 'C1',
      threadId: 'T1',
      agentId: 'agent-a',
    });
    expect(first.ok).toBe(true);

    const second = tryAcquireThreadOwnership({
      channel: 'slack',
      conversationId: 'C1',
      threadId: 'T1',
      agentId: 'agent-b',
    });
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.reason).toMatch(/agent-a/);

    handoffThreadOwnership(first.record.key, 'agent-b', 'shift change');
    const third = tryAcquireThreadOwnership({
      channel: 'slack',
      conversationId: 'C1',
      threadId: 'T1',
      agentId: 'agent-b',
    });
    expect(third.ok).toBe(true);

    releaseThreadOwnership(first.record.key);
    expect(listOwnershipAudit().some((a) => a.action === 'handoff')).toBe(true);
  });

  it('is a no-op when disabled via env', async () => {
    vi.stubEnv('CARINA_THREAD_OWNERSHIP', 'false');
    vi.resetModules();
    const { threadOwnershipEnabled } = await import('./thread-ownership.js');
    expect(threadOwnershipEnabled()).toBe(false);
  });
});
