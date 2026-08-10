import { describe, expect, it } from 'vitest';
import { assertEngineContextBoundary, buildEngineContextCheckpoint } from './engine-context-contract.js';

describe('Aiva engine context contract', () => {
  it('preserves canonical scope and creates deterministic idempotency keys', () => {
    const input = { tenantId: 't1', workspaceId: 'w1', workerId: 'aiva', contactId: 'c1', conversationId: 'conv1', channel: 'telegram', turnNumber: 4, messageId: 'm4', sourceEngine: 'keprix', targetEngine: 'carina' };
    const a = buildEngineContextCheckpoint(input);
    const b = buildEngineContextCheckpoint(input);
    expect(a.idempotencyKey).toBe(b.idempotencyKey);
    expect(a.conversationId).toBe('conv1');
    expect(() => assertEngineContextBoundary(a, { tenantId: 't1', workspaceId: 'w1', conversationId: 'conv1' })).not.toThrow();
  });

  it('rejects cross-tenant or cross-conversation handoffs', () => {
    const checkpoint = buildEngineContextCheckpoint({ tenantId: 't1', workspaceId: 'w1', workerId: 'aiva', contactId: 'c1', conversationId: 'conv1', channel: 'web', turnNumber: 1, messageId: 'm1', sourceEngine: 'carina', targetEngine: 'keprix' });
    expect(() => assertEngineContextBoundary(checkpoint, { tenantId: 't2', workspaceId: 'w1', conversationId: 'conv1' })).toThrow(/boundary mismatch/);
    expect(() => assertEngineContextBoundary(checkpoint, { tenantId: 't1', workspaceId: 'w1', conversationId: 'conv2' })).toThrow(/boundary mismatch/);
  });
});
