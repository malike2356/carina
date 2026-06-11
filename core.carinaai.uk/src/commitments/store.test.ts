import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('commitment store', () => {
  let tmp = '';

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'carina-commit-'));
    vi.resetModules();
    process.env.CARINA_HOME = tmp;
  });

  afterEach(() => {
    delete process.env.CARINA_HOME;
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  async function store() {
    return import('./store.js');
  }

  it('adds and lists pending commitments', async () => {
    const mod = await store();
    const row = mod.addCommitment({
      kind: 'check_in',
      agentId: 'main',
      sessionId: 'sess-1',
      channel: 'telegram',
      conversationId: '123',
      threadId: null,
      dueAt: new Date(Date.now() + 60_000),
      dueLatestAt: new Date(Date.now() + 3600_000),
      checkInText: 'How did it go?',
      sourceSummary: 'interview',
      confidence: 0.9,
    });
    expect(row.id).toMatch(/^cm_/);
    expect(mod.listCommitments({ status: 'pending' })).toHaveLength(1);
  });

  it('dismisses commitments by id', async () => {
    const mod = await store();
    const row = mod.addCommitment({
      kind: 'care',
      agentId: 'main',
      sessionId: 'sess-2',
      channel: null,
      conversationId: null,
      threadId: null,
      dueAt: new Date(Date.now() + 60_000),
      dueLatestAt: new Date(Date.now() + 3600_000),
      checkInText: 'Checking in.',
      sourceSummary: 'stress',
      confidence: 0.8,
    });
    expect(mod.dismissCommitments([row.id])).toBe(1);
    expect(mod.listCommitments({ status: 'pending' })).toHaveLength(0);
    expect(mod.listCommitments({ status: 'dismissed' })).toHaveLength(1);
  });
});
