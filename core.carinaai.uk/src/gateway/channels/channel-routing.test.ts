import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import type { ChannelMessage } from './channel-adapter.interface.js';

function sample(overrides: Partial<ChannelMessage> = {}): ChannelMessage {
  return {
    id: '1',
    channel: 'slack',
    externalUserId: 'U1',
    conversationId: 'C1',
    text: 'hi',
    timestamp: new Date(),
    isDirect: false,
    isMention: true,
    isCommand: false,
    threadId: 't1',
    ...overrides,
  };
}

describe('channel-routing', () => {
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    saved.CARINA_CHANNEL_PEER_SCOPING = process.env.CARINA_CHANNEL_PEER_SCOPING;
    saved.CARINA_THREAD_OWNERSHIP = process.env.CARINA_THREAD_OWNERSHIP;
    delete process.env.CARINA_CHANNEL_PEER_SCOPING;
    delete process.env.CARINA_THREAD_OWNERSHIP;
  });

  afterEach(() => {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  it('uses legacy session key when peer scoping is off', async () => {
    const { buildSessionExternalKey } = await import('./channel-routing.js');
    expect(buildSessionExternalKey(sample())).toBe('C1:U1');
    expect(buildSessionExternalKey(sample({ isDirect: true, conversationId: 'U1' }))).toBe('U1');
  });

  it('scopes by channel and peer when peer scoping is on', async () => {
    process.env.CARINA_CHANNEL_PEER_SCOPING = 'true';
    process.env.CARINA_THREAD_OWNERSHIP = 'true';
    const { buildSessionExternalKey } = await import('./channel-routing.js');
    expect(buildSessionExternalKey(sample())).toBe('slack:C1:U1:t:t1');
  });

  it('buildRoutingContext carries guild and team ids', async () => {
    const { buildRoutingContext } = await import('./channel-routing.js');
    const ctx = buildRoutingContext(sample({ guildId: 'g1', teamId: 'T1' }));
    expect(ctx.guildId).toBe('g1');
    expect(ctx.teamId).toBe('T1');
    expect(ctx.peerKind).toBe('group');
  });

  it('buildInboundRoutingMeta reports ownership disabled by default', async () => {
    const { buildInboundRoutingMeta } = await import('./channel-routing.js');
    const meta = buildInboundRoutingMeta(sample(), 'agent-a');
    expect(meta.ownershipState).toBe('disabled');
    expect(meta.threadId).toBe('t1');
  });
});
