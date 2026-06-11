import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
describe('commitment inference', () => {
  let tmp = '';

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'carina-infer-'));
    vi.resetModules();
    process.env.CARINA_HOME = tmp;
    process.env.CARINA_COMMITMENTS_ENABLED = 'true';
  });

  afterEach(async () => {
    delete process.env.CARINA_HOME;
    delete process.env.CARINA_COMMITMENTS_ENABLED;
    const { clearDeliveryRegistryForTests } = await import('../agents/cron-delivery-registry.js');
    clearDeliveryRegistryForTests();
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('creates a scoped commitment after a qualifying turn', async () => {
    const { bindSessionDelivery } = await import('../agents/cron-delivery-registry.js');
    bindSessionDelivery('sess-abc', {
      channel: 'telegram',
      conversationId: 'chat-9',
    });
    const { maybeInferCommitments } = await import('./inference.js');
    const { listCommitments } = await import('./store.js');

    await maybeInferCommitments({
      sessionId: 'sess-abc',
      agentId: 'main',
      platform: 'telegram',
      userMessage: 'I have a job interview tomorrow and I am really nervous about it.',
      assistantText: 'You have prepared well. Get some rest tonight.',
    });

    const rows = listCommitments({ status: 'pending' });
    expect(rows).toHaveLength(1);
    expect(rows[0].conversationId).toBe('chat-9');
    expect(rows[0].agentId).toBe('main');
    expect(new Date(rows[0].dueAt).getTime()).toBeGreaterThan(Date.now());
  });

  it('does nothing when disabled', async () => {
    process.env.CARINA_COMMITMENTS_ENABLED = 'false';
    vi.resetModules();
    const { maybeInferCommitments } = await import('./inference.js');
    const { listCommitments } = await import('./store.js');

    await maybeInferCommitments({
      sessionId: 'sess-x',
      agentId: 'main',
      userMessage: 'I have a job interview tomorrow and I am nervous.',
      assistantText: 'Good luck tomorrow.',
    });

    expect(listCommitments()).toHaveLength(0);
  });
});
